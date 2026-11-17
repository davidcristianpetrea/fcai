from __future__ import annotations

import asyncio
import json
import time
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
        if self.config.link_code and self.config.cloud_base_url and not self.store.read().get("device_token"):
            try:
                claimed = await asyncio.to_thread(self.cloud.claim, self.config.link_code)
                if claimed.get("token"):
                    self.store.merge({"device_id": claimed.get("deviceId", self.config.device_id), "device_token": claimed["token"], "device_config": claimed.get("config", {})})
            except Exception as error:
                print(f"agent: claim failed: {error}", flush=True)
        if self.config.cloud_base_url and not self.store.read().get("device_token"):
            asyncio.create_task(self._pairing_loop())
        else:
            asyncio.create_task(self._sync_loop())
            asyncio.create_task(self._telemetry_loop())
        boundary = LocalBoundary(
            self.config.host,
            self.config.http_port,
            self.config.websocket_port,
            self.state,
            self.handle_message,
            renderer_dir=Path(__file__).resolve().parents[2] / "renderer" / "public",
            media_dir=self.config.data_dir / "media",
        )
        self.http_server = boundary.start_http()
        self.websocket_server = await boundary.start_websocket()

    async def _pairing_loop(self) -> None:
        while not self.store.read().get("device_token"):
            pairing = self.store.read().get("pairing", {})
            try:
                if not pairing.get("deviceId") or pairing.get("offline") or int(pairing.get("expiresAt", 0)) <= int(time.time() * 1000):
                    pairing = await asyncio.to_thread(self.cloud.pair_request)
                    print(f"agent: pairing code {pairing.get('code', '')}", flush=True)
                try:
                    status = await asyncio.to_thread(self.cloud.pair_status, pairing["deviceId"], pairing["code"])
                except Exception as status_err:
                    # If server returned 404 (e.g. device was deleted or server database wiped), request a new pairing code immediately!
                    if "404" in str(status_err) or "not_found" in str(status_err):
                        print("agent: pair request unknown to server; requesting new code", flush=True)
                        pairing = await asyncio.to_thread(self.cloud.pair_request)
                        print(f"agent: new pairing code {pairing.get('code', '')}", flush=True)
                        status = await asyncio.to_thread(self.cloud.pair_status, pairing["deviceId"], pairing["code"])
                    else:
                        raise status_err
                merged = {**pairing, **status}
                self.store.merge({"pairing": merged})
                if status.get("paired") and status.get("token"):
                    self.store.merge({"device_id": status["deviceId"], "device_token": status["token"], "device_config": status.get("config", {}), "pairing": status})
                    print("agent: paired; starting sync", flush=True)
                    asyncio.create_task(self._sync_loop())
                    asyncio.create_task(self._telemetry_loop())
                    return
                print("agent: pairing pending", flush=True)
            except Exception as error:
                print(f"agent: pairing error: {error}", flush=True)
            await asyncio.sleep(3)

    async def _sync_loop(self) -> None:
        while True:
            current = self.store.read()
            token = current.get("device_token")
            if not token:
                await asyncio.sleep(3)
                continue
            try:
                synced = await asyncio.to_thread(
                    self.cloud.sync,
                    {
                        "device_id": current.get("device_id", self.config.device_id),
                        "applied_config_version": current.get("applied_config_version", 0),
                    },
                    token,
                )
                if synced.get("deleted") or not synced.get("ok", True):
                    print("agent: device deleted or unlinked; resetting to pairing", flush=True)
                    self.store.merge({
                        "device_token": "",
                        "device_id": "",
                        "pairing": {},
                        "device_config": {},
                        "playlist": [],
                        "media": [],
                        "config_version": 0,
                        "applied_config_version": 0,
                    })
                    asyncio.create_task(self._pairing_loop())
                    return
                media_dir = self.config.data_dir / "media"
                media_dir.mkdir(parents=True, exist_ok=True)
                manifest = []
                for item in synced.get("media", []):
                    target = media_dir / item["id"]
                    if not target.is_file() or target.stat().st_size != int(item.get("size_bytes") or 0):
                        await asyncio.to_thread(self.cloud.download_media, item["id"], token, target)
                    manifest.append({**item, "local": f"/media/{item['id']}"})
                applied_version = int(synced.get("config_version", 0))
                previous_applied = int(current.get("applied_config_version", 0))
                self.store.merge({
                    "device_config": synced.get("config", {}),
                    "display_name": synced.get("name", self.config.device_id),
                    "media": manifest,
                    "playlist": synced.get("playlist", []),
                    "config_version": applied_version,
                    "applied_config_version": applied_version,
                    "last_sync": synced,
                    "last_contact_at": synced.get("last_contact_at"),
                })
                print(f"agent: sync ok; media={len(manifest)} config={applied_version}", flush=True)
                if applied_version > previous_applied:
                    try:
                        await asyncio.to_thread(
                            self.cloud.sync,
                            {
                                "device_id": current.get("device_id", self.config.device_id),
                                "applied_config_version": applied_version,
                            },
                            token,
                        )
                    except Exception:
                        pass
            except Exception as error:
                print(f"agent: sync error: {error}", flush=True)
            await asyncio.sleep(4)

    async def _telemetry_loop(self) -> None:
        import websockets
        while True:
            token = self.store.read().get("device_token")
            device_id = self.store.read().get("device_id", self.config.device_id)
            if not token or not device_id:
                await asyncio.sleep(2)
                continue
            try:
                # Connect to local vision websocket on port 8766
                async with websockets.connect(f"ws://{self.config.host}:8766") as ws:
                    print("agent: connected to vision ws for cloud telemetry stream", flush=True)
                    last_sent_ms = 0
                    async for raw in ws:
                        token = self.store.read().get("device_token")
                        device_id = self.store.read().get("device_id", self.config.device_id)
                        if not token or not device_id:
                            break
                        now = time.time() * 1000
                        # Send telemetry ~3-4 times per second (every 250ms)
                        if now - last_sent_ms < 250:
                            continue
                        last_sent_ms = now
                        try:
                            msg = json.loads(raw)
                            if msg.get("t") == "faces":
                                telemetry_payload = {
                                    "device_id": device_id,
                                    "timestamp": msg.get("ts", int(now)),
                                    "faces": msg.get("faces", []),
                                    "camera_frame": msg.get("camera_frame"),
                                }
                                res = await asyncio.to_thread(self.cloud.send_telemetry, telemetry_payload, token)
                        except Exception as loop_err:
                            print(f"agent telemetry send error: {loop_err}", flush=True)
            except Exception as conn_err:
                print(f"agent telemetry connect error: {conn_err}", flush=True)
                await asyncio.sleep(2)

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
