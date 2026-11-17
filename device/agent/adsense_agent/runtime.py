from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any
from pathlib import Path

from .boundary import LocalBoundary
from .cloud import HttpCloudLink
from .config import AgentConfig
from .platform import PlatformAdapter, create_platform_adapter
from .sync import SyncStore


@dataclass
class AgentRuntime:
    config: AgentConfig
    platform: PlatformAdapter | None = None

    def __post_init__(self) -> None:
        self.platform = self.platform or create_platform_adapter(self.config.platform)
        self.store = SyncStore(self.config.data_dir / "state.json")
        self.cloud = HttpCloudLink(self.config.cloud_base_url)
        self.http_server = None
        self.websocket_server = None

    def state(self) -> dict[str, Any]:
        return {
            "device_id": self.config.device_id,
            "platform": self.platform.identify(),
            "sync": self.store.read(),
        }

    async def handle_message(self, message: dict[str, Any]) -> dict[str, Any]:
        if message.get("type") == "sync":
            payload = {key: value for key, value in message.items() if key != "type"}
            self.store.merge(payload)
            return {"type": "sync_ack", "state": self.state()}
        if message.get("type") == "identify":
            return {"type": "identify", **self.state()}
        return {"type": "error", "error": "unsupported_message"}

    async def start(self) -> None:
        if self.config.link_code and self.config.cloud_base_url:
            claimed = await asyncio.to_thread(self.cloud.claim, self.config.link_code)
            if claimed.get("token"):
                self.store.merge({"device_token": claimed["token"], "device_config": claimed.get("config", {})})
        elif self.config.cloud_base_url and not self.store.read().get("device_token"):
            pairing = self.store.read().get("pairing")
            if not pairing:
                try:
                    pairing = await asyncio.to_thread(self.cloud.pair_request)
                except Exception:
                    pairing = {"deviceId": self.config.device_id, "code": "------", "expiresAt": 0, "offline": True}
                self.store.merge({"pairing": pairing})
            if not pairing.get("offline"):
                asyncio.create_task(self._pairing_loop())
        if self.store.read().get("device_token"):
            asyncio.create_task(self._sync_loop())
        boundary = LocalBoundary(
            self.config.host,
            self.config.http_port,
            self.config.websocket_port,
            self.state,
            self.handle_message,
            renderer_dir=Path(__file__).resolve().parents[2] / "renderer" / "public",
        )
        self.http_server = boundary.start_http()
        self.websocket_server = await boundary.start_websocket()

    async def _pairing_loop(self) -> None:
        while not self.store.read().get("device_token"):
            pairing = self.store.read().get("pairing", {})
            try:
                status = await asyncio.to_thread(self.cloud.pair_status, pairing["deviceId"], pairing["code"])
                self.store.merge({"pairing": status})
                if status.get("paired") and status.get("token"):
                    self.store.merge({"device_id": status["deviceId"], "device_token": status["token"], "device_config": status.get("config", {}), "pairing": status})
                    return
            except Exception:
                pass
            await asyncio.sleep(3)

    async def _sync_loop(self) -> None:
        while True:
            current = self.store.read()
            token = current.get("device_token")
            if not token:
                await asyncio.sleep(3)
                continue
            try:
                synced = await asyncio.to_thread(self.cloud.sync, {"device_id": current.get("device_id", self.config.device_id)}, token)
                self.store.merge({"device_config": synced.get("config", {}), "display_name": synced.get("name", self.config.device_id), "last_sync": synced})
            except Exception:
                pass
            await asyncio.sleep(5)

    async def stop(self) -> None:
        if self.websocket_server:
            self.websocket_server.close()
            await self.websocket_server.wait_closed()
        if self.http_server:
            self.http_server.shutdown()

    def run(self) -> None:
        async def serve_forever() -> None:
            await self.start()
            try:
                await asyncio.Future()
            finally:
                await self.stop()

        try:
            asyncio.run(serve_forever())
        except KeyboardInterrupt:
            return
