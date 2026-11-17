# Platform migration audit

## Cloudflare-specific code removed or replaced

The original web foundation depended on these Cloudflare-only pieces:

- `apps/web/wrangler.jsonc`: Wrangler entrypoint, Static Assets, D1, R2,
  Durable Object, migration, and cron bindings. Removed.
- `apps/web/src/env.ts`: `D1Database`, `R2Bucket`, `DurableObjectNamespace`,
  and `Fetcher` bindings. Replaced with process environment configuration.
- `apps/web/src/device-hub.ts`: `DurableObjectState` health placeholder.
  Replaced with an in-process `Map<deviceId, WebSocket>`.
- `apps/web/src/index.ts`: Worker `fetch` export, `context.env.ASSETS`,
  Cloudflare bindings, and explicit Worker-only routes. Replaced by
  `apps/web/server/index.ts`, running Hono through `@hono/node-server`.
- `apps/web/package.json`: Wrangler and `@cloudflare/workers-types`.
  Removed; Node dependencies are `@hono/node-server`, `ws`,
  `better-sqlite3`, and `dotenv`.
- Cloudflare deployment docs, D1/R2 resource creation, presigned URL language,
  and Worker cron instructions. Replaced with CloudPanel, local SQLite,
  streamed disk uploads, and a setInterval scheduler.

## Portable code retained

- Hono route structure and Zod validation.
- `packages/shared` schemas, constants, generated JSON, i18n, and protocol
  fixtures.
- `apps/web/migrations/0001_initial.sql`; D1 uses SQLite, so the schema is
  reused by the startup migration runner with local additions for assets,
  upload tokens, rate limits, and offer references.
- Signed bearer session logic, now implemented with Node's `crypto` HMAC.
- The React/Vite SPA, public offer/privacy routes, dashboard navigation, and
  device/vision/Bluetooth code.

## Current repository

Before M0, the repository contained a single `restaurant_tv_poc.py` script, a
small unittest module, two Python dependency lists, and a README. The script
combined camera capture, OpenCV Haar face/eye detection, a heuristic attention
check, a display state machine, OpenCV rendering, a QR generator, and a Flask
offer endpoint in one process.

## Reusable work

- The interaction state-machine timing and redemption behavior are useful
  starting points for the agent/renderer split.
- The face/eye detection logic is a useful fallback and test fixture while the
  MediaPipe vision service is introduced.
- The local offer endpoint and QR generation establish the basic device-to-phone
  flow, but their protocol must move to the shared schemas and public Node app.
- The Windows USB camera adapter is useful as a development-only capture
  implementation.

## Replaced work

- The old OpenCV-window display template is removed. TV output belongs to the
  renderer running in Chromium and must not contain debug or console UI.
- All Picamera2 code is removed. Production and development both use the Logitech
  C920 through OpenCV; platform-specific capture belongs behind the vision
  service adapter.
- The old single-file Flask/local-server architecture is removed. The public
  website and API belong in the self-hosted Node app; the device-local server
  remains reserved for the agent/renderer and vision sockets.
- The old prototype dependency files are replaced by the package-specific
  dependency manifests introduced by later milestones.

## M0 boundary

M0 only establishes the repository boundaries and records these decisions. It
does not claim that cloud, Bluetooth, renderer, or vision functionality exists
yet. Each later milestone must leave the repository buildable and must append a
verified entry to `docs/PROGRESS.md`.
