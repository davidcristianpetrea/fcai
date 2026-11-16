# Progress

## M0 — Audit and skeleton

- Added the repository audit and milestone log.
- Established package boundaries for shared schemas, web, device services,
  vision, renderer, and Pi setup.
- Removed the former single-file Picamera2/OpenCV-window prototype path.
- Validation: repository structure only; functional milestones are not complete.

## M1 — Shared contract and web foundation

- Added the shared Zod contract, constants, Romanian/English strings, generated
  JSON Schema, and Python-consumable test vectors under `packages/shared`.
- Added the portable Hono routes and React/Vite SPA. The deployable runtime is
  now a single Node.js 22 process with SQLite, local streamed media, and an
  in-process device socket map behind CloudPanel/nginx.
- Added startup SQL migrations, WAL mode, nightly SQLite backups retaining
  seven copies, HMAC upload tokens, 90 MB streamed upload enforcement, range
  media downloads, login/session issuance, and device heartbeat handling.
- Cloudflare Workers, D1, R2, Durable Objects, KV, Queues, and Wrangler are no
  longer used. Cloudflare remains optional DNS/proxy infrastructure.
- Validation: Python device/vision suites pass; frontend/server validation
  requires Node.js 22 and pnpm on the build host.

## M2 — Device agent and renderer foundations

- Added the Python 3.12 uv-managed agent profile with persisted local sync
  state, explicit Windows/Pi platform adapters, and local HTTP/WS boundaries.
- Added cloud-link and sync abstractions that exchange device metadata only;
  camera frames remain local and Bluetooth is not simulated on Windows.
- Added a browser-safe TypeScript renderer foundation with playlist timing,
  media slots, restrained transitions, Ken Burns interpolation, and
  splash/identify/simulator/debug HUD scaffolding.
- Validation: agent tests and Python compilation pass. Renderer validation is
  pending a machine with pnpm/node dependencies.

## M3 — Vision foundations

- Added the C920 OpenCV adapter with Windows DirectShow/MSMF fallback, Pi V4L2,
  MJPG capture configuration, 640x360 analysis resizing, and hot-replug retry.
- Added normalized face/message models, IoU tracking, and the pure attention
  state machine with dwell, looking-reset, minimum-offer, exit, and cooldown
  rules.
- Added the MediaPipe Tasks detector boundary, rate-capped vision service, and
  renderer-side face bubble clamping/separation utilities.
- Added an executable headless `adsense-vision` CLI that emits normalized face
  telemetry and supports either a deployment-provided MediaPipe model or the
  OpenCV fallback for development.
- Validation: seven vision/tracking/attention/service tests pass and Python
  compilation passes. A deployment-provided MediaPipe model asset is still
  required for live MediaPipe inference.

## M4 — AdSense smart-display web foundation

- Added the React/Vite/TypeScript dashboard shell in `apps/web` with responsive
  navigation for displays, configuration, media, leads, statistics, help, and
  account foundations.
- Added Romanian-default shared i18n with an English switch, accessible login
  shell, public `/offer` and `/privacy` pages, and explicit unsupported
  Bluetooth/browser messaging.
- Added API status handling that treats reserved `501` responses as incomplete
  milestone functionality rather than inventing backend behavior.
- Validation: shared and web typechecks/tests plus the Vite production build.

## M6 — Bluetooth foundations

- Added shared BLE UUIDs, protocol version, message types, and onboarding
  schemas. `packages/shared` generates Python-consumable constants; generated
  artifacts are not hand-maintained.
- Added binary frame encoding/decoding, MTU-safe chunking/reassembly, monotonic
  replay counters, PBKDF2-HMAC-SHA256 and HKDF-SHA256 key derivation,
  HMAC-SHA256 verification, and AES-GCM payload protection.
- Added a real BlueZ/bless transport boundary for Raspberry Pi Linux only.
  Windows raises `NotSupported`; it does not simulate Bluetooth.
- Wi-Fi passwords are redacted before diagnostic output. Live onboarding still
  requires real Pi hardware, BlueZ, and a deployment-provided pairing/PSK.
- Validation: focused Python Bluetooth tests and shared generation/typechecks.

## M5 — Raspberry Pi setup foundations

- Added an idempotent Raspberry Pi OS Lite bootstrap, systemd agent/kiosk
  templates, Cage/Chromium kiosk launcher, and C920/V4L2 setup notes.
- Added offline, watchdog, and camera hot-replug operational guidance without
  claiming deployment.

## M7 — Operations and Windows development foundations

- Added argument-list-only ffmpeg/ffprobe command wrappers and
  NullIndicator/HudIndicator abstractions with focused tests.
- Added Windows development, deployment, and demo documentation. GPIO code and
  secrets remain out of scope.
