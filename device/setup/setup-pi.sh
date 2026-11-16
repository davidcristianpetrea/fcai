#!/usr/bin/env bash
set -euo pipefail

# Idempotent Raspberry Pi OS Lite bootstrap. Run as root on a supported Pi.
APP_USER="${APP_USER:-adsense}"
APP_DIR="${APP_DIR:-/opt/adsense}"
CONFIG_DIR="${CONFIG_DIR:-/etc/adsense}"
SETUP_DIR="${SETUP_DIR:-${APP_DIR}/device/setup}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SETUP_DIR="${SETUP_DIR//\$\{SCRIPT_DIR\}/${SCRIPT_DIR}}"
if [[ "${SETUP_DIR}" == "${APP_DIR}/device/setup" && -d "${SCRIPT_DIR}/systemd" ]]; then
  SETUP_DIR="${SCRIPT_DIR}"
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root (for example: sudo bash device/setup/setup-pi.sh)." >&2
  exit 1
fi

install -d -m 0755 "${APP_DIR}" "${CONFIG_DIR}"

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "/home/${APP_USER}" \
    --shell /usr/sbin/nologin "${APP_USER}"
fi

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install --yes \
  cage chromium-browser ffmpeg v4l-utils python3 python3-venv \
  fonts-dejavu ca-certificates

install -d -o "${APP_USER}" -g "${APP_USER}" -m 0750 "${APP_DIR}" "${CONFIG_DIR}"
install -d -o "${APP_USER}" -g "${APP_USER}" -m 0750 "${CONFIG_DIR}/state"

if [[ -d "${SETUP_DIR}/systemd" ]]; then
  install -m 0644 "${SETUP_DIR}/systemd/adsense-agent.service" \
    /etc/systemd/system/adsense-agent.service
  install -m 0644 "${SETUP_DIR}/systemd/adsense-kiosk.service" \
    /etc/systemd/system/adsense-kiosk.service
fi

systemctl daemon-reload
systemctl enable adsense-agent.service adsense-kiosk.service
echo "Pi packages and service templates installed. Deploy application files, then start the services explicitly."
