# M5/M7 demo checklist

This checklist is for a local demonstration; it does not claim that a
production deployment has occurred.

1. Run the agent and renderer locally with `NullIndicator`.
2. Show the identify/splash state and then the playlist renderer in Chromium.
3. On a Pi, verify `systemctl status` for the agent and kiosk units.
4. Connect the C920 and record `v4l2-ctl --list-devices` output.
5. Unplug and reconnect the camera, then confirm the vision reader retries.
6. Stop network access and confirm local rendering and persisted sync state.
7. Restore network access and verify synchronization resumes without exposing
   credentials in logs or source files.
