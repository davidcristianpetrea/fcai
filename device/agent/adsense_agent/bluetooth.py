from __future__ import annotations

import platform
from dataclasses import dataclass
from typing import Protocol


class NotSupported(RuntimeError):
    """Raised when a real Bluetooth transport is unavailable on this host."""


class BluetoothTransport(Protocol):
    async def start(self) -> None: ...
    async def stop(self) -> None: ...


@dataclass
class BlessBluetoothTransport:
    service_uuid: str
    control_characteristic_uuid: str
    notify_characteristic_uuid: str

    async def start(self) -> None:
        if platform.system() != "Linux":
            raise NotSupported("BLE transport requires Raspberry Pi Linux with BlueZ")
        try:
            from bless import BlessServer
        except ImportError as error:
            raise NotSupported("install bless on the Raspberry Pi to enable BLE") from error
        self._server = BlessServer(name="AdSense Display")
        await self._server.start()

    async def stop(self) -> None:
        server = getattr(self, "_server", None)
        if server is not None:
            await server.stop()


def create_bluetooth_transport(platform_name: str) -> BluetoothTransport:
    if platform_name != "raspberry-pi":
        raise NotSupported("Bluetooth is only supported by the Raspberry Pi agent")
    from .generated_protocol import (
        BLE_CONTROL_CHARACTERISTIC_UUID,
        BLE_NOTIFY_CHARACTERISTIC_UUID,
        BLE_SERVICE_UUID,
    )
    return BlessBluetoothTransport(BLE_SERVICE_UUID, BLE_CONTROL_CHARACTERISTIC_UUID, BLE_NOTIFY_CHARACTERISTIC_UUID)
