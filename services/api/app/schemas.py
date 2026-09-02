from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str
    email: str
    role: str


class IncidentOut(BaseModel):
    id: str
    type: str
    severity: str
    status: str
    lat: float
    lng: float
    confidence: float
    sighting_count: int
    first_seen: datetime
    last_seen: datetime
    evidence_url: str | None = None
    source_bus_id: str | None = None
    city: str = "greater_noida"

    model_config = {"from_attributes": True}


class IncidentPatch(BaseModel):
    status: str | None = None
    notes: str | None = None


class DetectionIn(BaseModel):
    type: str
    confidence: float = Field(ge=0, le=1)
    severity: str | None = None
    lat: float
    lng: float
    bus_id: str = "AMTS-102"
    timestamp: datetime | None = None
    evidence_path: str | None = None
    capture_id: str | None = None


class BusOut(BaseModel):
    id: str
    route_name: str
    last_lat: float | None
    last_lng: float | None
    last_seen: datetime | None
    city: str = "greater_noida"

    model_config = {"from_attributes": True}


class JobOut(BaseModel):
    id: str
    kind: str
    status: str
    message: str
    progress: int
    bus_id: str | None
    capture_id: str | None = None
    hit_count: int = 0

    model_config = {"from_attributes": True}

    @field_validator("hit_count", mode="before")
    @classmethod
    def _hit_count(cls, value: int | None) -> int:
        return value or 0


class CaptureOut(BaseModel):
    id: str
    vehicle_id: str
    route_name: str
    notes: str | None
    point_count: int
    video_duration_s: float
    gps_duration_s: float
    distance_m: float
    avg_speed_kmh: float
    warnings: list[str] = []
    status: str
    job_id: str | None
    hit_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class CaptureDetail(CaptureOut):
    incident_ids: list[str] = []


class StatsOut(BaseModel):
    incidents_open: int
    incidents_total: int
    by_type: dict[str, int]
    by_status: dict[str, int]
    captures: int
    detections: int
