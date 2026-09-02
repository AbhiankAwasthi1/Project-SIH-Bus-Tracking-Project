# Sample capture

`gps.csv` is a 15-second trail along Ashram Road, Ahmedabad.

`sample_route.mp4` is generated on first **Run sample route** (or `POST /api/jobs/sample`). The clip plants potholes, a crack, waterlogging, and congestion so the OpenCV detector can complete the laptop demo without custom YOLO weights.

To use your own dashcam:

1. Export a matching GPS CSV with columns `t,lat,lng` (`t` is seconds from video start).
2. Upload both files on the Bus Simulator page.
