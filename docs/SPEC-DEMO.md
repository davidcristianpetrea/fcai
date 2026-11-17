# Task: make the AdSense smart display demo-ready by tomorrow (live demo for judges, running on a Raspberry Pi 5)

You are taking over a repo built quickly by another AI. Much of it works, but its behavior and visual quality do not match the concept below. Read the relevant code BEFORE changing it. Never invent APIs; check library docs/types when unsure. Work on branch `main`. Commit and push after each numbered item, with a clear message. Do NOT break what already works: TV-code pairing, device sync, media playback, uploads, login.

Save this whole prompt as `docs/SPEC-DEMO.md` first, so it stays in the repo as the reference.

## What the product is
A small box (Raspberry Pi 5 + Logitech C920/C922 USB webcam) mounted on any TV. It plays standby media (videos/photos/GIFs). When a person LOOKS at the TV, it shows an interactive template that leads to an offer screen with a QR code. The QR opens a sign-up page on the person's phone (name, email, consent) that stores leads. Everything is managed from the website https://adsense.davidpetrea.ro (Romanian by default, English selectable). The TV text is in Romanian by default.

## Architecture (already in place; keep it)
- `apps/web`: Node 22 + Hono + SQLite (better-sqlite3), React/Vite dashboard, public `/offer` page. Hosted on a CloudPanel server, run with pm2 as `adsense-web` on port 3000, behind Cloudflare.
- `device/agent` (Python 3.12, uv): pairing, sync with the server, local HTTP server on 127.0.0.1:8765 that serves the TV app (`device/renderer/public`) and cached media.
- `device/vision` (Python 3.12, uv, MediaPipe + OpenCV): camera + face detection. Publishes JSON face messages on WebSocket 127.0.0.1:8766 (the TV app connects to it).
- `device/renderer`: the TV app, running fullscreen in Chromium (cage kiosk) on the Pi.
- `device/setup`: `install-pi.sh`, `update-pi.sh`, systemd units `adsense-agent`, `adsense-vision`, `adsense-kiosk`.

## Facts learned on the real hardware (respect these)
1. Cloudflare blocks the default Python `urllib` User-Agent (403, "error code: 1010"). Every device HTTP request must send a real User-Agent (e.g. `AdSense-Display/<version>`). A POST with no body must send `b"{}"` + `Content-Type: application/json`.
2. SQLite upsert: NOT NULL columns are checked even when `ON CONFLICT DO UPDATE` would apply. Every INSERT into `devices` must include `created_at` and `updated_at`.
3. **Port conflict:** the agent's own WebSocket defaulted to 8766, the same port as vision. Whichever started second crashed, and the camera turned off. The Pi is currently patched with a systemd drop-in `ADSENSE_AGENT_WS_PORT=8767`. Make **8767 the default in `device/agent/adsense_agent/config.py`**, keep vision on 8766, and check `start.ps1` and the units for the same conflict.
4. Pi: Raspberry Pi OS Lite 64-bit (Debian trixie). uv-managed Python 3.12 in `/opt/uv-python`. App in `/opt/adsense`, state in `/var/lib/adsense`, services run as user `adsense`, which must be in the `video` group. Camera at `/dev/video0` (C922, MJPG 1280x720). `device/vision` requires `websockets` and `mediapipe>=0.10.35`, with uv lock environments for linux/aarch64 and win32/AMD64.
5. The Pi is CPU-only (no usable GPU video decode in Chromium). Animate only `transform`/`opacity` on the TV, use one `requestAnimationFrame` loop, and target ≥30 fps on the Pi.

## P0 — demo-critical, do in this order

### 1. Real "looking" detection (today any face triggers; yaw/pitch are always 0.0)
- Compute head direction cheaply from the 6 keypoints MediaPipe FaceDetector already returns (right eye, left eye, nose tip, mouth center, right ear tragion, left ear tragion):
  - `eye_mid = midpoint(eyes)`, `eye_dist = |left_eye − right_eye|`
  - `yaw_ratio = (nose.x − eye_mid.x) / eye_dist` (≈0 when facing the camera)
  - `pitch_ratio = (nose.y − eye_mid.y) / (mouth.y − eye_mid.y)` (≈0.5–0.6 when facing the camera)
  - `looking = |yaw_ratio| ≤ YAW_MAX and PITCH_MIN ≤ pitch_ratio ≤ PITCH_MAX`
  - Start with YAW_MAX = 0.18, PITCH_MIN = 0.35, PITCH_MAX = 0.75, as named constants that can be overridden by env var.
  - Also send `yaw`/`pitch` as approximate degrees for debugging.
- Each track's "looking" timer resets only after more than 400 ms of not looking.
- Faces smaller than 7% of frame height are ignored.
- Add a debug mode: `adsense-vision --debug` prints yaw/pitch ratios per face, so thresholds can be tuned on site.

### 2. Attention state machine — no more offer loops
The current behavior repeatedly re-triggers the offer while someone keeps looking. Implement a pure, unit-tested state machine in the renderer:
`STANDBY → TRIGGERING → OFFER → EXITING → STANDBY`, plus cooldown.
- **Trigger:** a track has looked continuously for ≥ `dwellSeconds` (config, default 3), and no cooldown is active.
- **OFFER:** stays as long as ANY face is present, looking or not, because people look down at their phone to scan. Never exits before `offerMinSeconds` (default 20).
- **Exit:** after `exitAfterNobodySeconds` (default 6) with no faces at all; then a cooldown of `cooldownSeconds` (default 8).
- **No re-trigger by the same person:** a track id that already triggered an offer can't trigger again until it has left the frame for > 3 s.
- Write tests for: one person keeps looking for 2 minutes → exactly ONE offer cycle. Person looks away to scan → the offer stays. Everyone leaves → standby after 6 s.

### 3. Face blending (replace the ugly light-blue ring circle)
The client wants something like Google Meet's background effects: the person's live image blended softly into the video, in a soft region a bit bigger than the face. No visible circle, no ring, no border.
- **Step A (must ship):**
  - In vision, cut a square crop around each face, about 2.4× the face height, centered slightly below the face center so it includes hair, neck and the top of the shoulders. Send it as JPEG (320–384 px), as now.
  - In the renderer, composite it through a **soft feathered ellipse mask**: alpha 1.0 out to ~55% of the radius, falling smoothly to 0 at 100% (smoothstep curve). Use an offscreen canvas with a radial gradient and `destination-in`.
  - No stroke, no glow, no colored edge.
  - Size: blend height ≈ 2.4× the on-screen face height, clamped to 18–40% of screen height.
  - Smooth position and size with a One Euro filter so there is zero jitter.
  - Fade/scale in over 250 ms. Hold 600 ms after the face is lost, then fade out over 300 ms. At most 4 people.
- **Step B (only if Step A is done and the Pi stays ≥15 fps analysis):** add MediaPipe selfie/person segmentation (image segmenter, selfie model, model auto-downloaded like the face model) and multiply the person mask into the feathered ellipse, so the edge follows the person's outline like Google Meet. Send the mask with the crop (grayscale PNG, or a combined RGBA format). Put it behind a config flag and fall back to Step A automatically if it's too slow. Measure and report the fps on the Pi.
- The camera image is mirrored (selfie view) by default.
- Camera frames never leave the device and are never written to disk.

### 4. QR code must work
- Generate the QR on the TV with a proper library:
  - error correction level M, 4-module quiet zone;
  - ALWAYS dark modules on a white rounded card, regardless of the background color;
  - size ≈ 40% of the screen's short side (S/M/L = 32/40/48%).
- URL: the configured QR link, default `https://adsense.davidpetrea.ro/offer`. If it's on our domain, append `?d=<deviceId>&src=tv`. Never output "undefined" or a localhost URL.
- `/offer` must load on a phone over mobile data, show the display's headline, and save name + email + consent. The lead must appear in the dashboard Leads page.
- Add an automated test: render the offer screen, then decode the QR from a screenshot (e.g. with OpenCV `QRCodeDetector` or `jsQR`) and assert the decoded URL is correct.

### 5. Templates must match the concept
- **Recruit:**
  1. When the trigger fires, the offer's background color closes in around each face blend like the Looney Tunes "That's all folks" iris: holes centered on each face blend shrink from full screen down to slightly larger than the blend, over ~1000 ms, easeInOutCubic with a small overshoot that settles.
  2. Then the offer content fades in over ~400 ms (QR card scales 0.92→1, text staggered 80 ms).
  3. Exit is the reverse: content fades out, then the holes expand back.
- **Side locking (Recruit):**
  - At trigger time, the QR/text panel goes on the side OPPOSITE the people (mean face x < 0.5 → content on the right), and that side is LOCKED until the offer ends.
  - The face blends follow each person's real position but are clamped inside the people half (minus a 3% margin). They slide along the boundary and NEVER cover the QR or text.
  - Multiple people are pushed apart so blends don't overlap, and shrink if needed.
- **Simple:** a soft reveal of the offer (background fades in, the content panel slides 40 px in from its side, QR card scales 0.94→1). Face blends fade out.
- **Offer layout:**
  - 50/50 split: a content panel (headline, subtext, QR card, caption) and a media panel (the configured offer media, cover-fit, crossfade).
  - The background color comes from the config.
  - Text color is chosen automatically for contrast.
  - Inter font bundled locally, with correct Romanian diacritics.
- The TV must NEVER show debug text (e.g. "STANDBY"). Debug info only behind `?debug=1`.

### 6. Standby transitions actually work
The setting is saved, but nothing changes on the TV, and "Auto" does nothing. Implement in the renderer and apply from the synced config:
- **crossfade:** easeInOutSine.
- **zoom dissolve:** outgoing scales 1→1.06 and fades out; incoming scales 1.04→1 and fades in.
- **push:** incoming moves 100%→0, outgoing 0→−30% and dims to 0.6.
- **soft wipe:** a 15% feathered edge.
- **dip to black.**
- **auto:** random, never the same transition twice in a row.
- Speed: fast/normal/slow = 0.5/0.9/1.4 s.
- Photos use Ken Burns (zoom 1.00↔1.10 plus a slow pan, linear easing) over their duration.
- Preload the next item so there's never a black flash.
- New config applies at the next item boundary.

## P1 — website checkup and fixes
7. **Displays:** add "Elimină ecranul" with a confirmation dialog ("Sigur vrei să elimini acest ecran? Acțiunea nu poate fi anulată."). It must actually delete it on the server; the device then returns to its pairing-code screen on its next sync.
8. **Settings must apply end-to-end:** template, look time, face toggle, transitions, durations, offer text/colors/QR/media. After "Salvează și publică", show a toast, then the status "Se sincronizează…", then "Actualizat pe ecran ✓" once the device reports the applied version.
9. **Audit every dashboard page and fix what you find:**
   - Remove placeholders and dead buttons. No "undefined" values; use schema defaults.
   - Proper Romanian with diacritics everywhere; no English labels in RO mode.
   - Online/offline status is accurate (online if the last contact was < 30 s ago).
   - Works on phone, iPad and laptop.
   - Leads page: list, search, CSV export, delete.
   Report what you fixed.

## P2 — visual polish (only after P0 and P1 work)
10. Make the TV offer screen and the dashboard look clean and modern:
    - TV: one accent color, generous spacing, 12–24 px radii, large legible type for the TV.
    - Website: a calm, consistent design.

## Rules for finishing
- Run all tests (`pnpm test`, plus the agent and vision unit tests). Add tests for the state machine, side locking, looking computation and QR decode.
- Add a renderer simulator: `?sim=1` with fake faces controlled by the mouse/keyboard, so templates can be tested without a camera.
- At the end, give me:
  - (a) a short list of what changed;
  - (b) exact deploy commands for the server and the Pi;
  - (c) a 10-step test checklist I can do on the Pi tonight.
- Be honest about anything you couldn't verify.

The pi is at 192.168.1.220 user dp pass dpadmin
The web server is at 192.168.0.100 user davidpetrea-adsense pass rootserver19527
