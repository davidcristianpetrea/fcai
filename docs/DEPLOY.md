# Deployment and operations

Deployment is intentionally not automated by the M5/M7 foundations. Provide
the real Worker bindings, device URL, and secrets through the deployment
environment; never commit them to this repository.

## Service lifecycle

The Pi templates run the agent and Cage/Chromium under systemd with restart
policies. Inspect status and logs with:

```sh
systemctl status adsense-agent.service adsense-kiosk.service
journalctl -u adsense-agent.service -u adsense-kiosk.service -f
```

## Watchdog and offline behavior

Treat the local sync state as the source of truth while offline. The agent
must continue serving its local boundary and retry cloud synchronization
without blocking rendering. Use systemd restart-on-failure for process crashes,
and add an external hardware watchdog only after validating the board's
watchdog policy.

## Camera hot re-plug

The C920 reader retries once after a failed frame and reopens V4L2. If the
camera remains unavailable, preserve the last valid display state, report the
failure through the HUD/log boundary, and inspect `v4l2-ctl` plus `dmesg`.
Do not silently treat missing camera data as a successful attention event.
