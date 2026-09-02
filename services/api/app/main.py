from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import SessionLocal, init_db
from .routers import auth, buses, captures, incidents, jobs, stats
from .seed import seed_if_empty
from .ws import hub


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.upload_path()
    Path(settings.sample_dir).mkdir(parents=True, exist_ok=True)
    init_db()
    from detect import load_detector

    load_detector()
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Drishti API",
    description="SIH26124 — Mobile urban intelligence from the public transport fleet.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=400)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(incidents.router)
app.include_router(buses.router)
app.include_router(jobs.router)
app.include_router(captures.router)
app.include_router(stats.router)

uploads = settings.upload_path()
app.mount("/uploads", StaticFiles(directory=str(uploads)), name="uploads")


@app.middleware("http")
async def cache_static(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/uploads/"):
        response.headers["Cache-Control"] = "public, max-age=86400"
    return response


@app.get("/")
def root() -> RedirectResponse:
    return RedirectResponse(url="/docs")


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "service": "drishti-api"}


@app.websocket("/api/ws")
async def websocket_feed(ws: WebSocket) -> None:
    await hub.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(ws)
