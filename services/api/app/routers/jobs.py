from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..auth import current_user
from ..config import settings
from ..db import get_db
from ..ingest import queue_analyze, store_capture
from ..models import Job, User
from ..pipeline import prepare_sample, run_analyze_job
from ..schemas import JobOut

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("", response_model=list[JobOut])
def list_jobs(db: Session = Depends(get_db), _: User = Depends(current_user)) -> list[Job]:
    return db.query(Job).order_by(Job.created_at.desc()).limit(50).all()


@router.post("/analyze", response_model=JobOut)
async def analyze(
    background: BackgroundTasks,
    video: UploadFile = File(...),
    gps: UploadFile | None = File(None),
    bus_id: str = Form("GNA-12"),
    route_name: str = Form("Dashcam upload"),
    city: str = Form("greater_noida"),
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> Job:
    gps_bytes = await gps.read() if gps and gps.filename else b""
    used_city_gps = not gps_bytes.strip()
    if used_city_gps:
        _, gps_bytes = prepare_sample(settings.sample_dir, city)
        gps_name = f"{city}_track.csv"
    else:
        gps_name = gps.filename or "track.csv"
    try:
        capture = store_capture(
            db,
            video_bytes=await video.read(),
            gps_bytes=gps_bytes,
            gps_name=gps_name,
            vehicle_id=bus_id,
            route_name=route_name,
            notes="City GPS used because no track was uploaded" if used_city_gps else None,
            video_name=video.filename or "clip.mp4",
            fit_gps_to_video=used_city_gps,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    job = queue_analyze(db, capture)
    background.add_task(run_analyze_job, job.id, Path(capture.video_path), Path(capture.gps_path).read_bytes(), capture.vehicle_id)
    return job


@router.post("/sample", response_model=JobOut)
async def sample_job(
    background: BackgroundTasks,
    bus_id: str = Form("GNA-12"),
    city: str = Form("greater_noida"),
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> Job:
    try:
        video_path, gps_bytes = prepare_sample(settings.sample_dir, city)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not build sample media: {exc}") from exc
    job = Job(kind="sample", status="queued", message="Generating sample route", bus_id=bus_id)
    db.add(job)
    db.commit()
    db.refresh(job)
    background.add_task(run_analyze_job, job.id, Path(video_path), gps_bytes, bus_id)
    return job


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db), _: User = Depends(current_user)) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
