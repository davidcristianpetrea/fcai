from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

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
        boundary = LocalBoundary(
            self.config.host,
            self.config.http_port,
            self.config.websocket_port,
            self.state,
            self.handle_message,
        )
        self.http_server = boundary.start_http()
        self.websocket_server = await boundary.start_websocket()

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
