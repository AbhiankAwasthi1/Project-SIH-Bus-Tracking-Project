import json

from .models import Capture, Incident


def incident_to_dict(incident: Incident) -> dict:
    evidence = f"/uploads/{incident.evidence_path}" if incident.evidence_path else None
    return {
        "id": incident.id,
        "type": incident.type,
        "severity": incident.severity,
        "status": incident.status,
        "lat": incident.lat,
        "lng": incident.lng,
        "confidence": incident.confidence,
        "sighting_count": incident.sighting_count,
        "first_seen": incident.first_seen.isoformat() if incident.first_seen else None,
        "last_seen": incident.last_seen.isoformat() if incident.last_seen else None,
        "evidence_url": evidence,
        "source_bus_id": incident.source_bus_id,
        "city": getattr(incident, "city", None) or "greater_noida",
    }


def capture_to_dict(capture: Capture, incident_ids: list[str] | None = None) -> dict:
    try:
        warnings = json.loads(capture.warnings or "[]")
    except json.JSONDecodeError:
        warnings = [capture.warnings] if capture.warnings else []
    payload = {
        "id": capture.id,
        "vehicle_id": capture.vehicle_id,
        "route_name": capture.route_name,
        "notes": capture.notes,
        "point_count": capture.point_count,
        "video_duration_s": capture.video_duration_s,
        "gps_duration_s": capture.gps_duration_s,
        "distance_m": capture.distance_m,
        "avg_speed_kmh": capture.avg_speed_kmh,
        "warnings": warnings,
        "status": capture.status,
        "job_id": capture.job_id,
        "hit_count": capture.hit_count,
        "created_at": capture.created_at,
    }
    if incident_ids is not None:
        payload["incident_ids"] = incident_ids
    return payload
