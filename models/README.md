# Detection weights

Drop a trained Ultralytics YOLOv8 checkpoint here as `road_issues.pt`.

Expected class order:

0. pothole
1. damaged_road
2. waterlogging
3. blockage
4. congestion

Then install `services/detect/requirements-ml.txt` and set `YOLO_WEIGHTS` to this file. The API and map do not change.
