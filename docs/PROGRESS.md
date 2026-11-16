# Progress

## M0 — Audit and skeleton

- Added the repository audit and milestone log.
- Established package boundaries for shared schemas, web, device services,
  vision, renderer, and Pi setup.
- Removed the former single-file Picamera2/OpenCV-window prototype path.
- Validation: repository structure only; functional milestones are not complete.

## M1 — Shared contract and Cloudflare Worker core

- Added the shared Zod contract, constants, Romanian/English strings, generated
  JSON Schema, and Python-consumable test vectors under `packages/shared`.
- Added the Hono Worker core with Static Assets fallback, public health/config
  routes, signed bearer-session verification, Durable Object class, D1 migration
  foundation, R2/D1/Durable Object Wrangler bindings, and focused tests.
- Deliberately unimplemented: session issuance/identity integration, device
  onboarding and management, offer CRUD/delivery, redemption processing, device
  sockets, vision, and renderer code. These return explicit `501` responses or
  remain outside the M1 boundary.
- Wrangler resource IDs and the session secret must be supplied per deployment;
  placeholder IDs in `apps/web/wrangler.jsonc` are not production credentials.
- Validation: shared generation/typecheck/tests and web typecheck/tests in the
  cloud worktree.

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
- Added API status handling that treats Worker `501` responses as reserved
  milestone functionality rather than inventing backend behavior.
- Validation: shared and web typechecks/tests plus the Vite production build.
