from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Capture, DetectionRow, Incident, User
from ..schemas import StatsOut

router = APIRouter(prefix="/api", tags=["stats"])


@router.get("/stats", response_model=StatsOut)
def stats(db: Session = Depends(get_db), _: User = Depends(current_user)) -> StatsOut:
    total = db.query(Incident).count()
    open_count = db.query(Incident).filter(Incident.status != "repaired").count()
    by_type = {row[0]: row[1] for row in db.query(Incident.type, func.count(Incident.id)).group_by(Incident.type)}
    by_status = {row[0]: row[1] for row in db.query(Incident.status, func.count(Incident.id)).group_by(Incident.status)}
    return StatsOut(
        incidents_open=open_count,
        incidents_total=total,
        by_type=by_type,
        by_status=by_status,
        captures=db.query(Capture).count(),
        detections=db.query(DetectionRow).count(),
    )
