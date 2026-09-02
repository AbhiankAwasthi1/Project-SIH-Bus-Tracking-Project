from __future__ import annotations

import csv
from pathlib import Path

import cv2
import numpy as np

ROUTES = {
    "ahmedabad": [
        (0.0, 23.02680, 72.57120),
        (3.0, 23.02710, 72.57128),
        (6.0, 23.02740, 72.57136),
        (9.0, 23.02770, 72.57144),
        (12.0, 23.02800, 72.57152),
        (15.0, 23.02830, 72.57160),
    ],
    "greater_noida": [
        (0.0, 28.47280, 77.50890),
        (3.0, 28.47310, 77.50900),
        (6.0, 28.47340, 77.50910),
        (9.0, 28.47370, 77.50920),
        (12.0, 28.47400, 77.50930),
        (15.0, 28.47430, 77.50940),
    ],
}


def ensure_sample_media(sample_dir: str | Path, city: str = "greater_noida") -> tuple[Path, Path]:
    folder = Path(sample_dir)
    folder.mkdir(parents=True, exist_ok=True)
    video_path = folder / "sample_route.mp4"
    _write_gps(folder / "ahmedabad_gps.csv", ROUTES["ahmedabad"])
    _write_gps(folder / "greater_noida_gps.csv", ROUTES["greater_noida"])
    key = city if city in ROUTES else "greater_noida"
    gps_path = folder / "gps.csv"
    _write_gps(gps_path, ROUTES[key])
    if not video_path.exists():
        _write_video(video_path)
    return video_path, gps_path


def _write_gps(path: Path, route: list[tuple[float, float, float]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["t", "lat", "lng"])
        for t, lat, lng in route:
            writer.writerow([f"{t:.1f}", f"{lat:.6f}", f"{lng:.6f}"])


def _write_video(path: Path) -> None:
    width, height, fps, seconds = 640, 360, 12, 15
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(path), fourcc, fps, (width, height))
    if not writer.isOpened():
        raise RuntimeError(f"Could not open video writer for {path}")

    rng = np.random.default_rng(42)
    total = fps * seconds
    for i in range(total):
        t = i / fps
        frame = _asphalt_frame(width, height, i, rng)
        if 2.2 <= t <= 4.4:
            _pothole(frame, 210 + int((t - 2.2) * 8), 230, 54, 28)
        if 5.0 <= t <= 7.2:
            _pothole(frame, 340, 250, 70, 32)
            _crack(frame, 300, 220)
        if 8.4 <= t <= 10.6:
            _water(frame, 180, 240, 120, 46)
        if 11.4 <= t <= 14.2:
            _cars(frame, count=5 if t > 12.5 else 3)
        writer.write(frame)
    writer.release()


def _asphalt_frame(w: int, h: int, i: int, rng: np.random.Generator) -> np.ndarray:
    noise = rng.integers(38, 62, (h, w, 1), dtype=np.uint8)
    frame = np.repeat(noise, 3, axis=2)
    sky = np.zeros((int(h * 0.28), w, 3), dtype=np.uint8)
    sky[:, :] = (54, 42, 32)
    frame[: sky.shape[0]] = sky
    horizon = int(h * 0.30)
    cv2.line(frame, (0, horizon), (w, horizon), (70, 68, 64), 2)
    offset = (i * 6) % 40
    for y in range(horizon + 20, h, 28):
        cv2.line(frame, (w // 2 - 4, y + offset // 2), (w // 2 + 4, y + 16 + offset // 2), (30, 200, 220), 3)
    cv2.line(frame, (int(w * 0.18), h), (int(w * 0.42), horizon), (210, 210, 210), 2)
    cv2.line(frame, (int(w * 0.82), h), (int(w * 0.58), horizon), (210, 210, 210), 2)
    return frame


def _pothole(frame: np.ndarray, x: int, y: int, bw: int, bh: int) -> None:
    cv2.ellipse(frame, (x, y), (bw, bh), 12, 0, 360, (12, 12, 12), -1)
    cv2.ellipse(frame, (x - 6, y + 4), (bw // 2, bh // 2), 8, 0, 360, (8, 8, 8), -1)


def _crack(frame: np.ndarray, x: int, y: int) -> None:
    pts = np.array([[x, y], [x + 40, y + 18], [x + 90, y + 10], [x + 140, y + 28]], np.int32)
    cv2.polylines(frame, [pts], False, (18, 18, 18), 5)


def _water(frame: np.ndarray, x: int, y: int, bw: int, bh: int) -> None:
    overlay = frame.copy()
    cv2.ellipse(overlay, (x, y), (bw, bh), -8, 0, 360, (200, 140, 40), -1)
    cv2.addWeighted(overlay, 0.72, frame, 0.28, 0, frame)


def _cars(frame: np.ndarray, count: int) -> None:
    h, w = frame.shape[:2]
    for i in range(count):
        x = 80 + i * 90
        y = int(h * 0.58) + (i % 2) * 18
        cv2.rectangle(frame, (x, y), (x + 54, y + 28), (12, 90, 210), -1)
        cv2.rectangle(frame, (x + 8, y + 4), (x + 28, y + 14), (40, 40, 40), -1)
