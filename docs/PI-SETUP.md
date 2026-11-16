# Raspberry Pi OS Lite setup

M5 targets a Raspberry Pi 5 running Raspberry Pi OS Lite 64-bit. The setup
script installs Cage, Chromium, ffmpeg/ffprobe, V4L2 tools, Python, and the
service templates. It is idempotent: the `adsense` service account, directories,
packages, and systemd units can be applied repeatedly.

```sh
sudo bash device/setup/setup-pi.sh
sudo install -d -o adsense -g adsense /opt/adsense
```

The script does not copy application code, create credentials, or start a
deployment. Set `ADSENSE_DISPLAY_URL` in the service environment for the
display endpoint. Keep cloud secrets in the target's secret-management
mechanism, never in this repository.

Copy the repository to `/opt/adsense`, create the agent environment, and install
the systemd units' expected executable before starting them:

```sh
rsync -a --delete ./ adsense@PI_HOST:/opt/adsense/
ssh adsense@PI_HOST 'python3 -m venv /opt/adsense/.venv && \
  /opt/adsense/.venv/bin/pip install -e /opt/adsense/device/agent'
ssh adsense@PI_HOST 'sudo mkdir -p /etc/systemd/system/adsense-agent.service.d && \
  printf "[Service]\nEnvironment=ADSENSE_CLOUD_BASE_URL=https://YOUR_WORKER_DOMAIN\n" | \
  sudo tee /etc/systemd/system/adsense-agent.service.d/environment.conf >/dev/null && \
  sudo systemctl daemon-reload'
ssh adsense@PI_HOST 'sudo systemctl start adsense-agent.service adsense-kiosk.service'
```

Set `ADSENSE_DISPLAY_URL` in the kiosk service's corresponding environment
drop-in before starting it. The setup script installs the service and kiosk
scaffolding; it does not upload the application or provision Cloudflare
resources.

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
