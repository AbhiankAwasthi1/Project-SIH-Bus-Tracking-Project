import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(32), default="authority")


class Bus(Base):
    __tablename__ = "buses"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    route_name: Mapped[str] = mapped_column(String(200))
    last_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    city: Mapped[str] = mapped_column(String(32), default="greater_noida", index=True)


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    type: Mapped[str] = mapped_column(String(32), index=True)
    severity: Mapped[str] = mapped_column(String(16), default="medium")
    status: Mapped[str] = mapped_column(String(16), default="detected", index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    sighting_count: Mapped[int] = mapped_column(Integer, default=1)
    first_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    evidence_path: Mapped[str | None] = mapped_column(String(400), nullable=True)
    source_bus_id: Mapped[str | None] = mapped_column(String(64), ForeignKey("buses.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str] = mapped_column(String(32), default="greater_noida", index=True)


class DetectionRow(Base):
    __tablename__ = "detections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    incident_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("incidents.id"), nullable=True)
    type: Mapped[str] = mapped_column(String(32))
    confidence: Mapped[float] = mapped_column(Float)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    bus_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    capture_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Capture(Base):
    __tablename__ = "captures"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    vehicle_id: Mapped[str] = mapped_column(String(64), default="CAMPUS-01")
    route_name: Mapped[str] = mapped_column(String(200), default="Campus route")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_path: Mapped[str] = mapped_column(String(400))
    gps_path: Mapped[str] = mapped_column(String(400))
    point_count: Mapped[int] = mapped_column(Integer, default=0)
    video_duration_s: Mapped[float] = mapped_column(Float, default=0.0)
    gps_duration_s: Mapped[float] = mapped_column(Float, default=0.0)
    distance_m: Mapped[float] = mapped_column(Float, default=0.0)
    avg_speed_kmh: Mapped[float] = mapped_column(Float, default=0.0)
    warnings: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="stored")
    job_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    hit_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    kind: Mapped[str] = mapped_column(String(32), default="analyze")
    status: Mapped[str] = mapped_column(String(16), default="queued")
    message: Mapped[str] = mapped_column(String(400), default="")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    bus_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    capture_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    hit_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
