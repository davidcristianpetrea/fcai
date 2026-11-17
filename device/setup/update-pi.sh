#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/adsense}"
cd "${APP_DIR}"
BRANCH="$(git branch --show-current)"
git fetch origin "${BRANCH}"
git reset --hard "origin/${BRANCH}"
git clean -fd
export UV_PYTHON_INSTALL_DIR=/opt/uv-python
uv sync --directory device/agent --python 3.12
uv sync --directory device/vision --python 3.12
chown -R adsense:adsense "${APP_DIR}"
sudo systemctl restart adsense-agent.service adsense-vision.service adsense-kiosk.service
