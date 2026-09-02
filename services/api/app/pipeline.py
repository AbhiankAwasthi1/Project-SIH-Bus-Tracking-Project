from __future__ import annotations

import asyncio
import uuid
from datetime import datetime
from pathlib import Path

import cv2

from detect import detect_frame, ensure_sample_media, interpolate_gps, parse_gps_track
from detect.severity import score_severity

from .clustering import ClusterSession
from .config import settings
from .db import SessionLocal
from .models import Bus, Capture, Job
from .schemas import DetectionIn
from .serialize import incident_to_dict
from .ws import hub


def crop_evidence(frame, bbox: tuple[int, int, int, int], dest: Path) -> str:
    x1, y1, x2, y2 = bbox
    h, w = frame.shape[:2]
    pad = 12
    x1, y1 = max(0, x1 - pad), max(0, y1 - pad)
    x2, y2 = min(w, x2 + pad), min(h, y2 + pad)
    crop = frame[y1:y2, x1:x2]
    dest.parent.mkdir(parents=True, exist_ok=True)
    payload = crop if crop.size else frame
    cv2.imwrite(str(dest), payload, [int(cv2.IMWRITE_JPEG_QUALITY), settings.jpeg_quality])
    return dest.name


def _shrink(frame):
    h, w = frame.shape[:2]
    max_w = settings.detect_max_width
    if w <= max_w:
        return frame
    scale = max_w / float(w)
    return cv2.resize(frame, (max_w, max(1, int(h * scale))), interpolation=cv2.INTER_AREA)


def _emit(loop: asyncio.AbstractEventLoop, payload: dict) -> None:
    asyncio.run_coroutine_threadsafe(hub.broadcast(payload), loop)


async def run_analyze_job(job_id: str, video_path: Path, gps_raw: bytes, bus_id: str) -> None:
    loop = asyncio.get_running_loop()
    await asyncio.to_thread(_analyze_sync, job_id, video_path, gps_raw, bus_id, loop)


def _analyze_sync(
    job_id: str,
    video_path: Path,
    gps_raw: bytes,
    bus_id: str,
    loop: asyncio.AbstractEventLoop,
) -> None:
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if job is None:
            return
        job.status = "running"
        job.message = "Reading GPS trail"
        if job.capture_id:
            capture = db.get(Capture, job.capture_id)
            if capture:
                capture.status = "running"
        db.commit()
        _emit_progress(loop, job)

        points = parse_gps_track(gps_raw)
        cap = cv2.VideoCapture(str(video_path))
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not cap.isOpened():
            job.status = "failed"
            job.message = "Could not open video"
            db.commit()
            _emit_progress(loop, job)
            return

        fps = cap.get(cv2.CAP_PROP_FPS) or 12.0
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        stride = max(1, settings.frame_stride)
        idx = 0
        hits = 0
        last_progress = -1
        sample_i = 0
        cluster = ClusterSession(db)
        bus = db.get(Bus, bus_id)
        if bus is None:
            bus = Bus(
                id=bus_id,
                route_name="Sample demo",
                last_lat=points[0].lat,
                last_lng=points[0].lng,
            )
            db.add(bus)
            db.commit()

        while True:
            if idx % stride != 0:
                if not cap.grab():
                    break
                idx += 1
                continue

            ok, frame = cap.read()
            if not ok:
                break
            t = idx / fps
            fix = interpolate_gps(points, t)
            bus.last_lat = fix.lat
            bus.last_lng = fix.lng
            bus.last_seen = datetime.utcnow()

            if sample_i % settings.ws_bus_every == 0:
                _emit(
                    loop,
                    {
                        "type": "bus_location",
                        "bus_id": bus_id,
                        "lat": fix.lat,
                        "lng": fix.lng,
                        "t": t,
                    },
                )

            small = _shrink(frame)
            detections = detect_frame(small)
            for det in detections:
                evidence_name = f"{uuid.uuid4().hex}.jpg"
                crop_evidence(small, det.bbox, settings.upload_path() / evidence_name)
                h, w = small.shape[:2]
                ratio = ((det.bbox[2] - det.bbox[0]) * (det.bbox[3] - det.bbox[1])) / float(h * w or 1)
                event = DetectionIn(
                    type=det.type,
                    confidence=det.confidence,
                    severity=det.severity or score_severity(det.confidence, ratio),
                    lat=fix.lat,
                    lng=fix.lng,
                    bus_id=bus_id,
                    timestamp=datetime.utcnow(),
                    evidence_path=evidence_name,
                    capture_id=job.capture_id,
                )
                incident = cluster.upsert(event)
                hits += 1
                if incident.sighting_count == 1 or incident.sighting_count % 3 == 0:
                    _emit(loop, {"type": "incident_upsert", "incident": incident_to_dict(incident)})

            idx += 1
            sample_i += 1
            if total:
                progress = min(99, int(idx / total * 100))
                if progress >= last_progress + settings.progress_every_pct:
                    job.progress = progress
                    job.message = f"Scanned {idx} frames · {hits} hits clustered"
                    last_progress = progress
                    _emit_progress(loop, job)

        cap.release()
        cluster.flush()
        job.status = "done"
        job.progress = 100
        job.hit_count = hits
        job.message = f"Finished · {hits} detections merged into incidents"
        if job.capture_id:
            capture = db.get(Capture, job.capture_id)
            if capture:
                capture.status = "done"
                capture.hit_count = hits
                capture.job_id = job.id
        db.commit()
        _emit_progress(loop, job)
    except Exception as exc:
        job = db.get(Job, job_id)
        if job:
            job.status = "failed"
            job.message = str(exc)[:400]
            if job.capture_id:
                capture = db.get(Capture, job.capture_id)
                if capture:
                    capture.status = "failed"
            db.commit()
            _emit_progress(loop, job)
    finally:
        db.close()


def prepare_sample(sample_dir: str, city: str = "greater_noida") -> tuple[Path, bytes]:
    video, gps = ensure_sample_media(sample_dir, city)
    return video, gps.read_bytes()


def _emit_progress(loop: asyncio.AbstractEventLoop, job: Job) -> None:
    _emit(
        loop,
        {
            "type": "job_progress",
            "job_id": job.id,
            "status": job.status,
            "progress": job.progress,
            "message": job.message,
        },
    )
