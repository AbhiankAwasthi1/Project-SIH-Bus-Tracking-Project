# Drishti — Architecture and Tech Stack

**SIH26124** · AI-Powered Mobile Urban Intelligence Platform Using Public Transport Fleet  
**Sponsor:** Bharat Electronics Limited  
**Product name:** Drishti (city vision)

This document is the single picture for the team, the SIH idea PDF, and the viva. The demo is small. The architecture is built so the same APIs would serve a real bus fleet.

## 1. Goal

One loop, two minutes on stage:

**Bus video + GPS in → AI finds a road issue → one pin appears on the city map with photo, type, and severity.**

The pitch to BEL is larger: public buses become a moving sensor network. Existing routes replace survey vans. The city sees unique incidents, not raw model spam.

## 2. Assumptions

- Mixed college team, laptops only
- No physical bus hardware for the demo
- No dedicated GPU required to run the demo
- Custom YOLO weights can be trained later on Google Colab
- If the dashboard language changes (Next.js or Flutter), the AI and geo-backend stay the same

## 3. Four layers

```
1 Capture          2 Detect              3 Core                 4 Show
-----------        ---------------       -----------------      ----------------
Bus camera    -->  Frame sampler    -->  FastAPI           -->  Authority map
GPS track          YOLOv8 / CV           Dedup cluster          Repair queue
Bus simulator      Type + severity       Postgres + PostGIS     Evidence photo
```

### Layer 1 — Capture (the bus)

**Production:** each bus carries a forward/road camera and GNSS. The on-board unit sends bus ID, route, timestamp, lat/lng, and either a cropped frame or a short clip.

**Demo:** the **Bus Simulator** page. Upload a dashcam video plus a GPS trail (`t,lat,lng` CSV), or run the built-in Ahmedabad sample. Playback pretends a bus is driving. Judges do not need a physical bus.

### Layer 2 — Detect (the AI)

A Python service samples frames and emits one event per hit:

| Field | Meaning |
|---|---|
| `type` | `pothole` · `damaged_road` · `waterlogging` · `blockage` · `congestion` |
| `confidence` | 0–1 |
| `severity` | `low` · `medium` · `high` (box size × confidence) |
| `lat`, `lng` | interpolated from the GPS trail at that video time |
| `timestamp` | ISO time |
| `bus_id` | which vehicle saw it |
| `evidence_frame` | cropped still used on the map |

v1 detects five classes. Missing signs and broken breakers are extra class names later. They do not change the API or the map.

**Detector contract:** look for `models/road_issues.pt` (custom YOLOv8). If it is missing, the service uses an OpenCV heuristic so the laptop demo still completes the loop. Swapping weights does not change layers 3 or 4.

### Layer 3 — Core (the city brain)

This is the part BEL will care about more than the model.

- Accept detection events
- Store **incidents** (map features), not every raw box
- Cluster duplicates: same type within **20 meters**, status not `repaired` → merge
- Keep the highest-confidence evidence photo
- Increment `sighting_count` and `last_seen` (proves the fleet is working)
- Push live updates over WebSocket

### Layer 4 — Show (the authority product)

A web operations console, not a notebook:

- Live city map with colored pins
- Filters: type, severity, status
- Click a pin → photo, bus ID, time, confidence, sighting count
- Status workflow: `detected → verified → assigned → repaired`
- Congestion uses the same incidents table (heatmap-ready)

A citizen “avoid this road” view is a second tab on the same app. It is not a second codebase.

## 4. Locked tech stack

| Layer | Choice | Why |
|---|---|---|
| Detection | Python 3.11 + OpenCV + optional Ultralytics YOLOv8 | Standard SIH vision stack; custom `.pt` drops in |
| API | FastAPI | Same language as the model; OpenAPI docs for the demo |
| Database | PostgreSQL 16 + PostGIS (Docker) or SQLite (laptop) | Production: `ST_DWithin`. Laptop: same 20 m rule via haversine |
| Object store | Local `data/uploads/` | Photos for the demo; path-shaped so S3 can replace it |
| Dashboard | React + Vite + TypeScript + MapLibre GL | Fast to build; MapLibre needs no paid token on stage |
| Live updates | FastAPI WebSocket | Pins appear while the “bus” video is processed |
| Auth | Signed token, roles `authority` / `admin` | Enough for SIH; no OAuth |
| Local run | Docker Compose (db + API + web) | One command for the whole team |
| Training (later) | Google Colab + a small custom dataset | Do not block the app on a perfect model |

**Not in v1:** Kafka, Kubernetes, Redis clusters, Flutter, a custom CNN from scratch, paid Mapbox, on-bus Jetson hardware. Those belong on the *future work* slide.

## 5. Detection-to-map flow

```
BusSimulator                 YOLOv8/CV              FastAPI                 PostGIS              AuthorityMap
     |                            |                     |                      |                      |
     |-- frame + lat/lng/busId -->|                     |                      |                      |
     |                            |-- DetectionEvent -->|                      |                      |
     |                            |                     |-- find within 20m -->|                      |
     |                            |                     |                      |                      |
     |                            |                     |   duplicate: bump sighting_count            |
     |                            |                     |   new: insert status=detected               |
     |                            |                     |----------- websocket incident_upsert ------>|
     |                            |                     |                      |               add/move pin
```

## 6. Data model

### `users`

| Column | Notes |
|---|---|
| id | UUID |
| email | login |
| password_hash | demo hash |
| role | `authority` or `admin` |

### `buses`

| Column | Notes |
|---|---|
| id | string, e.g. `AMTS-102` |
| route_name | display name |
| last_lat, last_lng | last reported fix |
| last_seen | timestamp |

### `incidents` (what the map reads)

| Column | Notes |
|---|---|
| id | UUID |
| type | five v1 classes |
| severity | low / medium / high |
| status | detected / verified / assigned / repaired |
| lat, lng | WGS84 |
| geog | PostGIS `Geography(POINT, 4326)` |
| confidence | best score seen |
| sighting_count | how many times the fleet saw it |
| first_seen, last_seen | |
| evidence_path | thumbnail under `/uploads` |
| source_bus_id | first or latest bus |

### `captures` (field trips)

One row per campus / fleet recording: video path, normalized GPS CSV, duration, distance, GPS warnings, linked job, hit count.

### `detections` (optional raw hits)

Stored for debugging and the viva. The map **only** queries `incidents`. Each raw hit can point at a `capture_id`.

### Clustering rule

If a new detection of the **same type** is within **20 meters** of an open incident (`status != repaired`), merge it.

Talking point: *the city sees unique problems, not 400 boxes on one pothole.*

## 7. Repository layout

```
apps/web                 React dashboard + bus simulator
services/api             FastAPI, clustering, auth, websocket, jobs
services/detect          Detector interface (YOLO or OpenCV)
data/sample              GPS CSV + generated sample video
data/uploads             Evidence stills (gitignored)
infra/docker-compose.yml Database + API + nginx frontend
docs/ARCHITECTURE.md     This file
models/                  Optional custom YOLOv8 weights
```

## 8. HTTP and WebSocket contract

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` | email + password → token |
| GET | `/api/incidents` | list + filters |
| GET | `/api/incidents/{id}` | detail |
| PATCH | `/api/incidents/{id}` | status / verify |
| GET | `/api/buses` | fleet last-known positions |
| POST | `/api/jobs/analyze` | multipart video + GPS CSV/GPX (also stores a capture) |
| POST | `/api/jobs/sample` | generate + run the built-in demo |
| GET | `/api/jobs` | recent jobs |
| GET | `/api/jobs/{id}` | job progress |
| POST | `/api/captures` | field trip: video + GPS + route name + notes |
| GET | `/api/captures` | list campus / fleet captures |
| GET | `/api/captures/{id}` | capture detail + linked incident ids |
| POST | `/api/captures/{id}/analyze` | re-run detection on a stored trip |
| GET | `/api/stats` | incident / capture totals |
| WS | `/api/ws` | `incident_upsert`, `bus_location`, `job_progress` |

Edge-ready production contract: a bus computer only needs `POST /api/detections` with JSON + one thumbnail. The analyze job exists for the laptop demo.

## 9. Demo vs production

| Topic | Demo (what we build) | Production (what we say) |
|---|---|---|
| Capture | Upload video + GPS file | Camera + GNSS on each bus |
| Inference | Laptop CPU, sampled fps | Edge box on the bus; send events, not raw video |
| Bandwidth | Local files | Event JSON + one thumbnail |
| Identity | Dummy bus IDs (`AMTS-102`) | Fleet ID from the transport authority |
| Civic action | Status buttons on the map | Push to municipal grievance API |
| Model | OpenCV heuristic and/or `road_issues.pt` | Fine-tuned YOLOv8 on city footage |

Do not pretend the laptop is a city. Show that the same APIs would serve a fleet.

## 10. Novelty (BEL / SIH talking points)

1. **Fleet as the sensor** — coverage from existing routes, not new survey vans
2. **Incident, not detection** — 20 m clustering + sighting count
3. **Actionable map** — severity, evidence, repair status
4. **Edge-ready contract** — the bus POSTs a small JSON event
5. **Privacy-aware pitch** — store road-surface crops, not passenger-facing video

## 11. Demo script (two minutes)

1. Open the authority map. Seeded Ahmedabad incidents are already visible.
2. Open Bus Simulator → **Run sample route**. A bus marker moves; new pins appear.
3. Click a pothole. Show photo, confidence, sighting count.
4. Change status to `verified` then `assigned`.
5. Say: *three buses seeing the same hole still make one work order.*

## 12. What comes after this document

1. Scaffold API + Postgres + incident CRUD
2. Scaffold map dashboard with live pins
3. Wire detection on sample frames → live pins
4. Clustering, severity, status workflow
5. Freeze the two-minute demo script
