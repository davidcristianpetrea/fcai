#!/usr/bin/env bash
set -euo pipefail

URL="${ADSENSE_DISPLAY_URL:-http://127.0.0.1:8765/}"
PROFILE="${ADSENSE_CHROMIUM_PROFILE:-/var/lib/adsense/chromium}"

mkdir -p "${PROFILE}"
exec /usr/bin/chromium-browser \
  --kiosk \
  --no-first-run \
  --disable-translate \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=Translate,MediaRouter \
  --autoplay-policy=no-user-gesture-required \
  --user-data-dir="${PROFILE}" \
  "${URL}"
