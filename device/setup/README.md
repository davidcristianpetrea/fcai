# Raspberry Pi setup

The idempotent Pi setup script, systemd units, kiosk configuration, and boot
configuration will be added in M5. This directory is intentionally separate from
the Python agent and vision packages.

M6 Bluetooth onboarding is Pi-only and requires Linux BlueZ, a working adapter,
and the agent's optional `pi` dependencies (`uv sync --extra pi` from
`device/agent`). Windows raises `NotSupported` and does not emulate BLE.
Configure a deployment-provided PSK or pairing secret before sending Wi-Fi
credentials, and never log the credential payload.
