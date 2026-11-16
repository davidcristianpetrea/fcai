# M0 audit

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
  flow, but their protocol must move to the shared schemas and public Worker.
- The Windows USB camera adapter is useful as a development-only capture
  implementation.

## Replaced work

- The old OpenCV-window display template is removed. TV output belongs to the
  renderer running in Chromium and must not contain debug or console UI.
- All Picamera2 code is removed. Production and development both use the Logitech
  C920 through OpenCV; platform-specific capture belongs behind the vision
  service adapter.
- The old single-file Flask/local-server architecture is removed. The public
  website and cloud API belong in the Cloudflare Worker; the device-local server
  is reserved for the agent/renderer and vision sockets.
- The old prototype dependency files are replaced by the package-specific
  dependency manifests introduced by later milestones.

## M0 boundary

M0 only establishes the repository boundaries and records these decisions. It
does not claim that cloud, Bluetooth, renderer, or vision functionality exists
yet. Each later milestone must leave the repository buildable and must append a
verified entry to `docs/PROGRESS.md`.
