from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from .severity import ISSUE_TYPES, score_severity

CUSTOM_NAMES = {
    0: "pothole",
    1: "damaged_road",
    2: "waterlogging",
    3: "blockage",
    4: "congestion",
}

COCO_TO_ISSUE = {
    "car": "congestion",
    "motorcycle": "congestion",
    "bus": "congestion",
    "truck": "congestion",
    "traffic light": "blockage",
}


@dataclass
class Detection:
    type: str
    confidence: float
    severity: str
    bbox: tuple[int, int, int, int]


class Detector:
    def __init__(self) -> None:
        self.yolo = _try_load_yolo()
        self.backend = "yolov8" if self.yolo is not None else "opencv_heuristic"

    def detect(self, frame: np.ndarray) -> list[Detection]:
        if self.yolo is not None:
            return _yolo_detect(self.yolo, frame)
        return _heuristic_detect(frame)


_DETECTOR: Detector | None = None


def load_detector() -> Detector:
    global _DETECTOR
    if _DETECTOR is None:
        _DETECTOR = Detector()
    return _DETECTOR


def detect_frame(frame: np.ndarray) -> list[Detection]:
    return load_detector().detect(frame)


def _try_load_yolo() -> Any:
    weights = Path(os.environ.get("YOLO_WEIGHTS", "models/road_issues.pt"))
    use_coco = os.environ.get("YOLO_USE_COCO", "0") == "1"
    try:
        from ultralytics import YOLO
    except Exception:
        return None

    if weights.exists():
        return YOLO(str(weights))
    if use_coco:
        return YOLO("yolov8n.pt")
    return None


def _yolo_detect(model: Any, frame: np.ndarray) -> list[Detection]:
    h, w = frame.shape[:2]
    area = float(h * w) or 1.0
    results = model.predict(frame, verbose=False, conf=0.35)
    names = getattr(model, "names", CUSTOM_NAMES)
    detections: list[Detection] = []
    for result in results:
        if result.boxes is None:
            continue
        for box in result.boxes:
            cls_id = int(box.cls[0])
            raw_name = str(names.get(cls_id, cls_id)).lower().replace(" ", "_")
            issue = raw_name if raw_name in ISSUE_TYPES else COCO_TO_ISSUE.get(
                str(names.get(cls_id, "")).lower()
            )
            if issue not in ISSUE_TYPES:
                continue
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
            conf = float(box.conf[0])
            ratio = max(0.0, (x2 - x1) * (y2 - y1) / area)
            detections.append(
                Detection(
                    type=issue,
                    confidence=round(conf, 3),
                    severity=score_severity(conf, ratio),
                    bbox=(x1, y1, x2, y2),
                )
            )
    return _nms_by_type(detections)


def _heuristic_detect(frame: np.ndarray) -> list[Detection]:
    """Demo detector for the synthetic sample and rough dashcam stills."""
    h, w = frame.shape[:2]
    area = float(h * w) or 1.0
    detections: list[Detection] = []

    roi_top = int(h * 0.42)
    road = frame[roi_top:, :]
    gray = cv2.cvtColor(road, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (7, 7), 0)
    _, dark = cv2.threshold(blur, 38, 255, cv2.THRESH_BINARY_INV)
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for contour in contours:
        c_area = float(cv2.contourArea(contour))
        if c_area < 420:
            continue
        x, y, bw, bh = cv2.boundingRect(contour)
        if bw < 16 or bh < 12 or bw * bh > area * 0.28:
            continue
        aspect = bw / float(bh)
        if aspect > 3.2 or aspect < 0.35:
            continue
        peri = cv2.arcLength(contour, True) or 1.0
        circularity = 4 * 3.1416 * c_area / (peri * peri)
        if circularity < 0.28:
            continue
        patch = gray[y : y + bh, x : x + bw]
        mean = float(patch.mean()) if patch.size else 255
        if mean > 28:
            continue
        y += roi_top
        ratio = (bw * bh) / area
        conf = max(0.55, min(0.93, (36 - mean) / 36))
        issue = "pothole" if circularity >= 0.38 else "damaged_road"
        detections.append(
            Detection(
                type=issue,
                confidence=round(conf, 3),
                severity=score_severity(conf, ratio),
                bbox=(x, y, x + bw, y + bh),
            )
        )

    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    water = cv2.inRange(hsv, (95, 90, 70), (125, 255, 230))
    water[: int(h * 0.48)] = 0
    water = cv2.morphologyEx(water, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    contours, _ = cv2.findContours(water, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for contour in contours:
        x, y, bw, bh = cv2.boundingRect(contour)
        if bw * bh < 500:
            continue
        ratio = (bw * bh) / area
        detections.append(
            Detection(
                type="waterlogging",
                confidence=0.78,
                severity=score_severity(0.78, ratio),
                bbox=(x, y, x + bw, y + bh),
            )
        )

    orange = cv2.inRange(hsv, (8, 120, 120), (25, 255, 255))
    orange = cv2.morphologyEx(orange, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(orange, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    car_boxes = [cv2.boundingRect(c) for c in contours if cv2.contourArea(c) > 400]
    if len(car_boxes) >= 3:
        xs = [b[0] for b in car_boxes]
        ys = [b[1] for b in car_boxes]
        rights = [b[0] + b[2] for b in car_boxes]
        bottoms = [b[1] + b[3] for b in car_boxes]
        detections.append(
            Detection(
                type="congestion",
                confidence=min(0.9, 0.5 + 0.1 * len(car_boxes)),
                severity="high" if len(car_boxes) >= 5 else "medium",
                bbox=(min(xs), min(ys), max(rights), max(bottoms)),
            )
        )

    gray_full = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray_full, 80, 160)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 40, minLineLength=int(w * 0.25), maxLineGap=8)
    if lines is not None and len(lines) >= 12:
        # dense debris-like edges in the lower third without lane continuity
        lower = edges[int(h * 0.62) :, :]
        if float(lower.mean()) > 18:
            detections.append(
                Detection(
                    type="blockage",
                    confidence=0.55,
                    severity="medium",
                    bbox=(int(w * 0.3), int(h * 0.6), int(w * 0.7), int(h * 0.9)),
                )
            )

    return _nms_by_type(detections)


def _nms_by_type(detections: list[Detection], iou_thresh: float = 0.45) -> list[Detection]:
    kept: list[Detection] = []
    for det in sorted(detections, key=lambda d: d.confidence, reverse=True):
        if any(d.type == det.type and _iou(d.bbox, det.bbox) > iou_thresh for d in kept):
            continue
        kept.append(det)
    return kept


def _iou(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    if inter == 0:
        return 0.0
    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    return inter / float(area_a + area_b - inter)
