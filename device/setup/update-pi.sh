#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/adsense}"
cd "${APP_DIR}"
git pull --ff-only
uv sync --directory device/agent --python 3.12
uv sync --directory device/vision --python 3.12
sudo systemctl restart adsense-agent.service adsense-vision.service adsense-kiosk.service
