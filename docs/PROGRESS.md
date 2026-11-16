# Progress

## M0 — Audit and skeleton

- Added the repository audit and milestone log.
- Established package boundaries for shared schemas, web, device services,
  vision, renderer, and Pi setup.
- Removed the former single-file Picamera2/OpenCV-window prototype path.
- Validation: repository structure only; functional milestones are not complete.

## M2 — Device agent and renderer foundations

- Added the Python 3.12 uv-managed agent profile with persisted local sync
  state, explicit Windows/Pi platform adapters, and local HTTP/WS boundaries.
- Added cloud-link and sync abstractions that exchange device metadata only;
  camera frames remain local and Bluetooth is not simulated on Windows.
- Added a browser-safe TypeScript renderer foundation with playlist timing,
  media slots, restrained transitions, Ken Burns interpolation, and
  splash/identify/simulator/debug HUD scaffolding.
- Validation: `uv run --directory device/agent pytest` and
  `pnpm --filter @adsense/renderer build` plus focused renderer tests.
