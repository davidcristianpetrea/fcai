# Restaurant TV proof of concept

This is the first Raspberry Pi 5 proof of concept for the sidewalk-facing restaurant
display. It uses the Camera Module v2.1, Picamera2, and OpenCV.

## Install on Raspberry Pi OS Bookworm

```bash
sudo apt update
sudo apt install -y python3-picamera2 python3-opencv opencv-data python3-pip
python3 -m venv --system-site-packages .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

The `--system-site-packages` option lets the virtual environment use the Raspberry
Pi camera bindings installed by apt.

## Run

```bash
python restaurant_tv_poc.py
```

Two windows open:

- **Restaurant TV Preview** shows the standby screen, camera/robot interaction,
  QR offer, and small state countdown in the upper-right corner.
- **Camera + Telemetry** shows the live camera, face box, eye/frontal heuristic,
  state, and FPS.

The looking threshold is configurable:

```bash
python restaurant_tv_poc.py --look-seconds 2.0 --robot-seconds 3.0 --return-seconds 2.0
```

The QR code points to `http://<pi-local-ip>:5000/offer`. Visit it from a phone on
the same network during the offer state. The page says **galati teknologiy** and
signals the application to return to standby after the configured transition.
Press `q` or `Esc` in either OpenCV window to stop the prototype.

The current “looking” detector is intentionally a lightweight prototype heuristic:
the largest detected face must appear frontal and have at least one detected eye.
It should be replaced with a more robust pose/gaze model before deployment.
