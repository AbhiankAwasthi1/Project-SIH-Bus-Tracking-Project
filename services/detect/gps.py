from __future__ import annotations

import csv
import io
import math
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path


@dataclass(frozen=True)
class GpsPoint:
    t: float
    lat: float
    lng: float


@dataclass
class TrackReport:
    points: list[GpsPoint]
    duration_s: float
    distance_m: float
    avg_speed_kmh: float
    warnings: list[str] = field(default_factory=list)


def parse_gps_track(source: str | Path | bytes, filename: str = "") -> list[GpsPoint]:
    raw, name = _as_text(source, filename)
    lowered = name.lower()
    stripped = raw.lstrip()
    if lowered.endswith(".gpx") or stripped.startswith("<"):
        return _normalize(_parse_gpx(raw))
    return _normalize(parse_gps_csv(raw))


def parse_gps_csv(source: str | Path | bytes) -> list[GpsPoint]:
    raw, _ = _as_text(source, "")
    reader = csv.DictReader(io.StringIO(raw.strip()))
    if not reader.fieldnames:
        raise ValueError("GPS CSV has no header")

    fields = {name.strip().lower(): name for name in reader.fieldnames}
    t_key = _pick(fields, ("t", "time", "seconds", "offset", "timestamp", "datetime"))
    lat_key = _pick(fields, ("lat", "latitude"))
    lng_key = _pick(fields, ("lng", "lon", "long", "longitude"))
    if not (t_key and lat_key and lng_key):
        raise ValueError("GPS file must include time, lat, lng columns")

    points: list[GpsPoint] = []
    for row in reader:
        if not row.get(lat_key):
            continue
        points.append(
            GpsPoint(
                t=_parse_time(row[t_key]),
                lat=float(row[lat_key]),
                lng=float(row[lng_key]),
            )
        )
    if len(points) < 2:
        raise ValueError("GPS track needs at least two points")
    points.sort(key=lambda p: p.t)
    return points


def interpolate_gps(points: list[GpsPoint], t: float) -> GpsPoint:
    if t <= points[0].t:
        return points[0]
    if t >= points[-1].t:
        return points[-1]
    for i in range(1, len(points)):
        a, b = points[i - 1], points[i]
        if a.t <= t <= b.t:
            span = b.t - a.t or 1e-6
            u = (t - a.t) / span
            return GpsPoint(
                t=t,
                lat=a.lat + (b.lat - a.lat) * u,
                lng=a.lng + (b.lng - a.lng) * u,
            )
    return points[-1]


def stretch_track(points: list[GpsPoint], duration_s: float) -> list[GpsPoint]:
    if duration_s <= 1 or len(points) < 2:
        return points
    span = points[-1].t - points[0].t or 1.0
    factor = duration_s / span
    origin = points[0].t
    return [
        GpsPoint(t=round((p.t - origin) * factor, 3), lat=p.lat, lng=p.lng)
        for p in points
    ]


def inspect_track(points: list[GpsPoint], video_duration_s: float | None = None) -> TrackReport:
    if len(points) < 2:
        raise ValueError("GPS track needs at least two points")
    duration = max(points[-1].t - points[0].t, 0.0)
    distance = 0.0
    max_speed = 0.0
    for a, b in zip(points, points[1:]):
        step = _haversine_m(a.lat, a.lng, b.lat, b.lng)
        distance += step
        dt = max(b.t - a.t, 1e-6)
        max_speed = max(max_speed, step / dt)

    warnings: list[str] = []
    if duration < 2:
        warnings.append("GPS span is under 2 seconds")
    if distance < 8:
        warnings.append("Track covers less than 8 m — check that the logger was moving")
    if max_speed > 45:
        warnings.append(f"Peak speed {max_speed * 3.6:.0f} km/h looks like a GPS/time sync error")
    if video_duration_s and abs(duration - video_duration_s) > 12:
        warnings.append(
            f"GPS duration {duration:.1f}s vs video {video_duration_s:.1f}s — pins may drift"
        )

    avg = (distance / duration * 3.6) if duration else 0.0
    return TrackReport(
        points=points,
        duration_s=round(duration, 2),
        distance_m=round(distance, 1),
        avg_speed_kmh=round(avg, 1),
        warnings=warnings,
    )


def points_to_csv(points: list[GpsPoint]) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["t", "lat", "lng"])
    for point in points:
        writer.writerow([f"{point.t:.3f}", f"{point.lat:.7f}", f"{point.lng:.7f}"])
    return buf.getvalue()


def _normalize(points: list[GpsPoint]) -> list[GpsPoint]:
    origin = points[0].t
    return [GpsPoint(t=round(p.t - origin, 3), lat=p.lat, lng=p.lng) for p in points]


def _parse_gpx(raw: str) -> list[GpsPoint]:
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as exc:
        raise ValueError("Could not parse GPX") from exc

    rows: list[GpsPoint] = []
    for el in root.iter():
        if not el.tag.endswith("trkpt") and not el.tag.endswith("wpt"):
            continue
        try:
            lat = float(el.attrib["lat"])
            lng = float(el.attrib["lon"])
        except (KeyError, ValueError) as exc:
            raise ValueError("GPX point is missing lat/lon") from exc
        stamp = None
        for child in el:
            if child.tag.endswith("time") and child.text:
                stamp = child.text.strip()
                break
        t = _parse_time(stamp) if stamp else float(len(rows))
        rows.append(GpsPoint(t=t, lat=lat, lng=lng))
    if len(rows) < 2:
        raise ValueError("GPX track needs at least two points")
    rows.sort(key=lambda p: p.t)
    if rows[0].t == rows[-1].t:
        rows = [GpsPoint(t=float(i), lat=p.lat, lng=p.lng) for i, p in enumerate(rows)]
    return rows


def _parse_time(value: str) -> float:
    text = str(value).strip()
    try:
        return float(text)
    except ValueError:
        pass
    iso = text.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(iso)
    except ValueError as exc:
        raise ValueError(f"Unsupported time value: {value}") from exc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def _as_text(source: str | Path | bytes, filename: str) -> tuple[str, str]:
    if isinstance(source, bytes):
        return source.decode("utf-8-sig"), filename
    if isinstance(source, Path):
        return source.read_text(encoding="utf-8-sig"), filename or source.name
    return source, filename


def _pick(fields: dict[str, str], aliases: tuple[str, ...]) -> str | None:
    for alias in aliases:
        if alias in fields:
            return fields[alias]
    return None


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(min(1.0, a)))
