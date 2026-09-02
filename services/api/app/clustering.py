from __future__ import annotations

import math
from datetime import datetime

from sqlalchemy.orm import Session

from .config import settings
from .geo import infer_city
from .models import Bus, DetectionRow, Incident
from .schemas import DetectionIn


SEVERITY_RANK = {"low": 1, "medium": 2, "high": 3}


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


class ClusterSession:
    """Keeps open incidents in memory so a video job does not query the DB per hit."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.open: dict[str, list[Incident]] = {}
        rows = db.query(Incident).filter(Incident.status != "repaired").all()
        for row in rows:
            self.open.setdefault(row.type, []).append(row)
        self.pending = 0

    def upsert(self, event: DetectionIn, touch_bus: bool = False) -> Incident:
        if touch_bus:
            _touch_bus(self.db, event)
        incident = _merge(self.db, event, self.open.get(event.type, []))
        if incident.sighting_count == 1 and incident not in self.open.get(event.type, []):
            self.open.setdefault(event.type, []).append(incident)
        self.pending += 1
        if self.pending >= settings.commit_every:
            self.flush()
        return incident

    def flush(self) -> None:
        if self.pending:
            self.db.commit()
            self.pending = 0


def upsert_detection(db: Session, event: DetectionIn) -> Incident:
    """Single-event path used by POST /api/detections."""
    _touch_bus(db, event)
    open_rows = (
        db.query(Incident)
        .filter(Incident.type == event.type, Incident.status != "repaired")
        .all()
    )
    incident = _merge(db, event, open_rows)
    db.commit()
    db.refresh(incident)
    return incident


def _merge(db: Session, event: DetectionIn, candidates: list[Incident]) -> Incident:
    existing = None
    for row in candidates:
        if haversine_m(row.lat, row.lng, event.lat, event.lng) <= settings.cluster_radius_m:
            existing = row
            break

    now = event.timestamp or datetime.utcnow()
    if existing:
        existing.sighting_count += 1
        existing.last_seen = now
        existing.source_bus_id = event.bus_id
        if event.confidence >= existing.confidence:
            existing.confidence = event.confidence
            if event.evidence_path:
                existing.evidence_path = event.evidence_path
        if event.severity and SEVERITY_RANK.get(event.severity, 0) > SEVERITY_RANK.get(existing.severity, 0):
            existing.severity = event.severity
        incident = existing
    else:
        incident = Incident(
            type=event.type,
            severity=event.severity or "medium",
            status="detected",
            lat=event.lat,
            lng=event.lng,
            confidence=event.confidence,
            sighting_count=1,
            first_seen=now,
            last_seen=now,
            evidence_path=event.evidence_path,
            source_bus_id=event.bus_id,
            city=infer_city(event.lat, event.lng),
        )
        db.add(incident)
        db.flush()

    db.add(
        DetectionRow(
            incident_id=incident.id,
            type=event.type,
            confidence=event.confidence,
            lat=event.lat,
            lng=event.lng,
            bus_id=event.bus_id,
            capture_id=event.capture_id,
            created_at=now,
        )
    )
    return incident


def _touch_bus(db: Session, event: DetectionIn) -> None:
    bus = db.get(Bus, event.bus_id)
    now = event.timestamp or datetime.utcnow()
    if bus is None:
        db.add(
            Bus(
                id=event.bus_id,
                route_name="Unassigned",
                last_lat=event.lat,
                last_lng=event.lng,
                last_seen=now,
                city=infer_city(event.lat, event.lng),
            )
        )
    else:
        bus.last_lat = event.lat
        bus.last_lng = event.lng
        bus.last_seen = now
