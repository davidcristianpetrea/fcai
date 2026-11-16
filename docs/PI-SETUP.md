# Raspberry Pi OS Lite setup

M5 targets a Raspberry Pi 5 running Raspberry Pi OS Lite 64-bit. The setup
script installs Cage, Chromium, ffmpeg/ffprobe, V4L2 tools, Python, and the
service templates. It is idempotent: the `adsense` service account, directories,
packages, and systemd units can be applied repeatedly.

```sh
sudo bash device/setup/setup-pi.sh
sudo install -d -o adsense -g adsense /opt/adsense
sudo systemctl start adsense-agent.service adsense-kiosk.service
```

The script does not copy application code, create credentials, or start a
deployment. Set `ADSENSE_DISPLAY_URL` in the service environment for the
display endpoint. Keep cloud secrets in the target's secret-management
mechanism, never in this repository.

## Logitech C920 and V4L2

Connect the C920 before boot for first-time diagnosis, then verify the device:

```sh
v4l2-ctl --list-devices
v4l2-ctl --device=/dev/video0 --all
v4l2-ctl --device=/dev/video0 --list-formats-ext
```

The vision adapter uses V4L2, requests MJPEG at 1280x720/30, and downsizes
analysis frames to 640x360. For hot re-plug, check `dmesg`, confirm the new
`/dev/video*` node, and restart only the vision/agent service if capture does
not recover automatically. Do not grant the service more device access than
the camera group requires.
