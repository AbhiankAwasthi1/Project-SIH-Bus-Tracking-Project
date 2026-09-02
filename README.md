# Drishti — SIH26124

AI-Powered Mobile Urban Intelligence Platform Using Public Transport Fleet.

Buses act as moving cameras. The system detects potholes, damaged roads, waterlogging, blockages, and congestion, then shows **one incident per problem** on a city map.

Architecture and stack: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Quick start (Docker)

From the repo root:

```powershell
docker compose -f infra/docker-compose.yml up --build
```

- Dashboard: http://localhost:8080
- API docs: http://localhost:8000/docs

Login: `authority@drishti.city` / `sih26124`

On the map, open **Bus Simulator** and click **Run sample route**. A synthetic Ahmedabad dashcam is generated on first run, processed, and pins appear live.

## Local development (no Docker)

The API defaults to SQLite so a laptop can run the full loop. Clustering is still 20 m (haversine). Docker Compose uses Postgres + PostGIS when you have Docker.

API (PowerShell):

```powershell
cd services/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PYTHONPATH = "$PWD\.."
$env:UPLOAD_DIR = "$PWD\..\..\data\uploads"
$env:SAMPLE_DIR = "$PWD\..\..\data\sample"
uvicorn app.main:app --reload --port 8000
```

Dashboard:

```powershell
cd apps/web
npm install
npm run dev
```

Vite: http://localhost:5173 (proxies `/api` to the backend).

## Custom YOLO weights

Place a trained Ultralytics file at `models/road_issues.pt` and install extras:

```powershell
pip install -r services/detect/requirements-ml.txt
```

Set `YOLO_WEIGHTS=models/road_issues.pt`. Classes should be:

`pothole`, `damaged_road`, `waterlogging`, `blockage`, `congestion`

Without that file, the OpenCV detector still completes the demo loop on the sample video.

## Demo accounts

| Email | Password | Role |
|---|---|---|
| authority@drishti.city | sih26124 | authority |
| admin@drishti.city | sih26124 | admin |
# Project-SIH-Bus-Tracking
