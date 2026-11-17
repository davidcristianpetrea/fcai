from __future__ import annotations

import platform
from dataclasses import dataclass


class PlatformAdapter:
    """Host-specific device capabilities; no platform emulation is provided."""

    name = "unknown"
    bluetooth_available = False

    def identify(self) -> dict[str, object]:
        return {"platform": self.name, "bluetooth": self.bluetooth_available}


@dataclass(frozen=True)
class WindowsAdapter(PlatformAdapter):
    name: str = "windows"
    bluetooth_available: bool = False


@dataclass(frozen=True)
class RaspberryPiAdapter(PlatformAdapter):
    name: str = "raspberry-pi"
    bluetooth_available: bool = True


def create_platform_adapter(requested: str = "auto") -> PlatformAdapter:
    if requested == "windows" or (requested == "auto" and platform.system() == "Windows"):
        return WindowsAdapter()
    if requested in {"pi", "raspberry-pi"}:
        return RaspberryPiAdapter()
    if requested == "auto" and platform.machine().startswith(("arm", "aarch")):
        return RaspberryPiAdapter()
    return PlatformAdapter()
