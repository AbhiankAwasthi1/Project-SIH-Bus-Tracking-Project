from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from .auth import hash_password
from .geo import infer_city
from .models import Bus, Incident, User

AHMEDABAD_BUSES = [
    ("AMTS-102", "Route 102 · Ashram Road", 23.0334, 72.5738),
    ("AMTS-58", "Route 58 · CG Road", 23.0271, 72.5654),
    ("AMTS-144", "Route 144 · SP Ring Road", 23.0188, 72.5810),
]

AHMEDABAD_INCIDENTS = [
    ("pothole", "high", 23.0286, 72.5721, 0.91, 4, "AMTS-102"),
    ("waterlogging", "medium", 23.0224, 72.5698, 0.74, 2, "AMTS-58"),
    ("damaged_road", "medium", 23.0368, 72.5762, 0.68, 3, "AMTS-102"),
    ("congestion", "high", 23.0312, 72.5665, 0.81, 6, "AMTS-144"),
    ("blockage", "low", 23.0196, 72.5794, 0.57, 1, "AMTS-144"),
]

NOIDA_BUSES = [
    ("GNA-12", "Route 12 · Knowledge Park II", 28.4615, 77.4968),
    ("GNA-7", "Route 7 · Pari Chowk", 28.4728, 77.5089),
    ("GNA-21", "Route 21 · Alpha–Gamma", 28.4702, 77.5135),
]

NOIDA_INCIDENTS = [
    ("pothole", "high", 28.4618, 77.4974, 0.89, 5, "GNA-12"),
    ("waterlogging", "medium", 28.4672, 77.5024, 0.76, 3, "GNA-21"),
    ("damaged_road", "medium", 28.4706, 77.5141, 0.71, 2, "GNA-21"),
    ("congestion", "high", 28.4728, 77.5089, 0.84, 8, "GNA-7"),
    ("blockage", "low", 28.4524, 77.5262, 0.58, 1, "GNA-12"),
]


def seed_if_empty(db: Session) -> None:
    if db.query(User).count() == 0:
        db.add(User(email="authority@drishti.city", password_hash=hash_password("sih26124"), role="authority"))
        db.add(User(email="admin@drishti.city", password_hash=hash_password("sih26124"), role="admin"))

    _ensure_fleet(db, AHMEDABAD_BUSES, "ahmedabad")
    _ensure_fleet(db, NOIDA_BUSES, "greater_noida")
    _ensure_incidents(db, AHMEDABAD_INCIDENTS, "ahmedabad")
    _ensure_incidents(db, NOIDA_INCIDENTS, "greater_noida")
    _backfill_city(db)
    db.commit()


def _ensure_fleet(db: Session, rows: list, city: str) -> None:
    now = datetime.utcnow()
    for bus_id, route, lat, lng in rows:
        if db.get(Bus, bus_id) is None:
            db.add(Bus(id=bus_id, route_name=route, last_lat=lat, last_lng=lng, last_seen=now, city=city))


def _ensure_incidents(db: Session, rows: list, city: str) -> None:
    existing = {(row.source_bus_id, round(row.lat, 4), round(row.lng, 4)) for row in db.query(Incident).all()}
    now = datetime.utcnow()
    for i, (itype, severity, lat, lng, conf, count, bus_id) in enumerate(rows):
        key = (bus_id, round(lat, 4), round(lng, 4))
        if key in existing:
            continue
        db.add(
            Incident(
                type=itype,
                severity=severity,
                status="detected" if i < 3 else "verified",
                lat=lat,
                lng=lng,
                confidence=conf,
                sighting_count=count,
                first_seen=now - timedelta(hours=6 - i),
                last_seen=now - timedelta(minutes=20 * i),
                source_bus_id=bus_id,
                city=city,
            )
        )


def _backfill_city(db: Session) -> None:
    for row in db.query(Incident).filter((Incident.city.is_(None)) | (Incident.city == "")).all():
        row.city = infer_city(row.lat, row.lng)
    for row in db.query(Bus).filter((Bus.city.is_(None)) | (Bus.city == "")).all():
        if row.last_lat is not None and row.last_lng is not None:
            row.city = infer_city(row.last_lat, row.last_lng)
        else:
            row.city = "greater_noida"
    # Existing Ahmedabad seed rows created before the city column
    for row in db.query(Incident).all():
        if not row.city:
            row.city = infer_city(row.lat, row.lng)
        elif row.city == "greater_noida" and infer_city(row.lat, row.lng) == "ahmedabad":
            row.city = "ahmedabad"
    for row in db.query(Bus).all():
        if row.last_lat is None or row.last_lng is None:
            continue
        guessed = infer_city(row.last_lat, row.last_lng)
        if row.city != guessed:
            row.city = guessed
