from __future__ import annotations

import json
import uuid
from pathlib import Path

import cv2
from sqlalchemy.orm import Session

from detect import inspect_track, parse_gps_track, points_to_csv, stretch_track

from .config import settings
from .models import Capture, Job


def video_duration_s(path: Path) -> float:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise ValueError("Could not open the video file")
    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
    frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0.0
    cap.release()
    if fps <= 1e-3:
        return 0.0
    return float(frames / fps)


def store_capture(
    db: Session,
    *,
    video_bytes: bytes,
    gps_bytes: bytes,
    gps_name: str,
    vehicle_id: str,
    route_name: str,
    notes: str | None,
    video_name: str = "clip.mp4",
    fit_gps_to_video: bool = False,
) -> Capture:
    capture_id = str(uuid.uuid4())
    folder = settings.upload_path() / "captures" / capture_id
    folder.mkdir(parents=True, exist_ok=True)
    suffix = Path(video_name).suffix or ".mp4"
    video_path = folder / f"video{suffix}"
    video_path.write_bytes(video_bytes)

    points = parse_gps_track(gps_bytes, gps_name)
    duration = video_duration_s(video_path)
    if fit_gps_to_video:
        points = stretch_track(points, duration)
    report = inspect_track(points, duration)
    gps_path = folder / "track.csv"
    gps_path.write_text(points_to_csv(report.points), encoding="utf-8")

    capture = Capture(
        id=capture_id,
        vehicle_id=vehicle_id,
        route_name=route_name,
        notes=notes or None,
        video_path=str(video_path),
        gps_path=str(gps_path),
        point_count=len(report.points),
        video_duration_s=round(duration, 2),
        gps_duration_s=report.duration_s,
        distance_m=report.distance_m,
        avg_speed_kmh=report.avg_speed_kmh,
        warnings=json.dumps(report.warnings),
        status="stored",
    )
    db.add(capture)
    db.commit()
    db.refresh(capture)
    return capture


def queue_analyze(db: Session, capture: Capture, kind: str = "analyze") -> Job:
    job = Job(
        kind=kind,
        status="queued",
        message="Queued field capture",
        bus_id=capture.vehicle_id,
        capture_id=capture.id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    capture.job_id = job.id
    capture.status = "queued"
    db.commit()
    db.refresh(capture)
    return job
