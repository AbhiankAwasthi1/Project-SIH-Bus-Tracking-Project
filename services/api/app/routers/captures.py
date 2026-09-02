from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..ingest import queue_analyze, store_capture
from ..models import Capture, DetectionRow, User
from ..pipeline import run_analyze_job
from ..schemas import CaptureDetail, CaptureOut, JobOut
from ..serialize import capture_to_dict

router = APIRouter(prefix="/api/captures", tags=["captures"])


@router.post("", response_model=CaptureOut)
async def create_capture(
    background: BackgroundTasks,
    video: UploadFile = File(...),
    gps: UploadFile = File(...),
    vehicle_id: str = Form("CAMPUS-01"),
    route_name: str = Form("Campus route"),
    notes: str = Form(""),
    analyze: bool = Form(True),
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> dict:
    try:
        capture = store_capture(
            db,
            video_bytes=await video.read(),
            gps_bytes=await gps.read(),
            gps_name=gps.filename or "track.csv",
            vehicle_id=vehicle_id.strip() or "CAMPUS-01",
            route_name=route_name.strip() or "Campus route",
            notes=notes.strip(),
            video_name=video.filename or "clip.mp4",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if analyze:
        job = queue_analyze(db, capture)
        background.add_task(run_analyze_job, job.id, Path(capture.video_path), Path(capture.gps_path).read_bytes(), capture.vehicle_id)
        db.refresh(capture)
    return capture_to_dict(capture)


@router.get("", response_model=list[CaptureOut])
def list_captures(db: Session = Depends(get_db), _: User = Depends(current_user)) -> list[dict]:
    rows = db.query(Capture).order_by(Capture.created_at.desc()).all()
    return [capture_to_dict(row) for row in rows]


@router.get("/{capture_id}", response_model=CaptureDetail)
def get_capture(capture_id: str, db: Session = Depends(get_db), _: User = Depends(current_user)) -> dict:
    capture = db.get(Capture, capture_id)
    if capture is None:
        raise HTTPException(status_code=404, detail="Capture not found")
    incident_ids = [
        row.incident_id
        for row in db.query(DetectionRow).filter(DetectionRow.capture_id == capture_id).all()
        if row.incident_id
    ]
    return capture_to_dict(capture, incident_ids=list(dict.fromkeys(incident_ids)))


@router.post("/{capture_id}/analyze", response_model=JobOut)
async def reanalyze(
    capture_id: str,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> JobOut:
    capture = db.get(Capture, capture_id)
    if capture is None:
        raise HTTPException(status_code=404, detail="Capture not found")
    job = queue_analyze(db, capture)
    background.add_task(
        run_analyze_job,
        job.id,
        Path(capture.video_path),
        Path(capture.gps_path).read_bytes(),
        capture.vehicle_id,
    )
    return job
