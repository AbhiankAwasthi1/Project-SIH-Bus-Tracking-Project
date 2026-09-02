from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import current_user
from ..clustering import upsert_detection
from ..db import get_db
from ..models import Incident, User
from ..schemas import DetectionIn, IncidentOut, IncidentPatch
from ..serialize import incident_to_dict
from ..ws import hub

router = APIRouter(prefix="/api", tags=["incidents"])

ALLOWED_STATUS = {"detected", "verified", "assigned", "repaired"}


@router.get("/incidents", response_model=list[IncidentOut])
def list_incidents(
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
    type: Annotated[str | None, Query()] = None,
    severity: Annotated[str | None, Query()] = None,
    status: Annotated[str | None, Query()] = None,
) -> list[dict]:
    q = db.query(Incident)
    if type:
        q = q.filter(Incident.type == type)
    if severity:
        q = q.filter(Incident.severity == severity)
    if status:
        q = q.filter(Incident.status == status)
    return [incident_to_dict(row) for row in q.order_by(Incident.last_seen.desc()).all()]


@router.get("/incidents/{incident_id}", response_model=IncidentOut)
def get_incident(
    incident_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> dict:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident_to_dict(incident)


@router.patch("/incidents/{incident_id}", response_model=IncidentOut)
async def patch_incident(
    incident_id: str,
    body: IncidentPatch,
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> dict:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    if body.status:
        if body.status not in ALLOWED_STATUS:
            raise HTTPException(status_code=400, detail="Invalid status")
        incident.status = body.status
    if body.notes is not None:
        incident.notes = body.notes
    db.commit()
    db.refresh(incident)
    payload = incident_to_dict(incident)
    await hub.broadcast({"type": "incident_upsert", "incident": payload})
    return payload


@router.post("/detections", response_model=IncidentOut)
async def create_detection(
    body: DetectionIn,
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
) -> dict:
    incident = upsert_detection(db, body)
    payload = incident_to_dict(incident)
    await hub.broadcast({"type": "incident_upsert", "incident": payload})
    return payload
