#!/usr/bin/env bash
set -euo pipefail

APP_USER="${APP_USER:-adsense}"
APP_DIR="${APP_DIR:-/opt/adsense}"
STATE_DIR="${STATE_DIR:-/var/lib/adsense}"
REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ruleaza: sudo bash device/setup/install-pi.sh" >&2
  exit 1
fi

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y cage chromium ffmpeg v4l-utils curl git NetworkManager
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/home/${APP_USER}" --shell /usr/sbin/nologin "${APP_USER}"
fi
curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh
uv python install 3.12
uv sync --directory "${REPO_DIR}/device/agent" --python 3.12
uv sync --directory "${REPO_DIR}/device/vision" --python 3.12
install -d -o "${APP_USER}" -g "${APP_USER}" "${STATE_DIR}" /var/lib/adsense/chromium
install -m 0644 "${REPO_DIR}/device/setup/systemd/adsense-agent.service" /etc/systemd/system/adsense-agent.service
install -m 0644 "${REPO_DIR}/device/setup/systemd/adsense-vision.service" /etc/systemd/system/adsense-vision.service
install -m 0644 "${REPO_DIR}/device/setup/systemd/adsense-kiosk.service" /etc/systemd/system/adsense-kiosk.service
install -m 0755 "${REPO_DIR}/device/setup/chromium-kiosk.sh" /opt/adsense/chromium-kiosk.sh
sed -i 's/^#\?country=.*/country=RO/' /etc/wpa_supplicant/wpa_supplicant.conf 2>/dev/null || true
if command -v raspi-config >/dev/null 2>&1; then raspi-config nonint do_wifi_country RO || true; fi
sed -i 's/$/ quiet loglevel=0 vt.global_cursor_default=0 video=HDMI-A-1:1920x1080@60/' /boot/firmware/cmdline.txt 2>/dev/null || true
systemctl daemon-reload
systemctl enable adsense-agent.service adsense-vision.service adsense-kiosk.service
systemctl set-default multi-user.target
systemctl reboot
