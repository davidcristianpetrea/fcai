from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol
from urllib.request import Request, urlopen
import json


class CloudLink(Protocol):
    def pair_request(self) -> dict[str, Any]: ...
    def pair_status(self, device_id: str, code: str) -> dict[str, Any]: ...
    def claim(self, code: str) -> dict[str, Any]: ...
    def sync(self, payload: dict[str, Any], token: str = "") -> dict[str, Any]: ...


@dataclass
class HttpCloudLink:
    base_url: str = "https://adsense.davidpetrea.ro"
    timeout: float = 10.0

    def sync(self, payload: dict[str, Any], token: str = "") -> dict[str, Any]:
        if not self.base_url:
            return {"ok": False, "reason": "cloud_not_configured"}
        request = Request(
            f"{self.base_url.rstrip('/')}/api/device/sync",
            data=json.dumps(payload).encode(),
            headers={"content-type": "application/json", **({"authorization": f"Bearer {token}"} if token else {})},
            method="POST",
        )
        with urlopen(request, timeout=self.timeout) as response:
            return json.loads(response.read())

    def pair_request(self) -> dict[str, Any]:
        request = Request(f"{self.base_url.rstrip('/')}/api/device/pair-request", method="POST")
        with urlopen(request, timeout=self.timeout) as response:
            return json.loads(response.read())

    def pair_status(self, device_id: str, code: str) -> dict[str, Any]:
        request = Request(f"{self.base_url.rstrip('/')}/api/device/pair-status?deviceId={device_id}&code={code}")
        with urlopen(request, timeout=self.timeout) as response:
            return json.loads(response.read())
    def claim(self, code: str) -> dict[str, Any]:
        if not self.base_url:
            return {"ok": False, "reason": "cloud_not_configured"}
        request = Request(
            f"{self.base_url.rstrip('/')}/api/device/claim",
            data=json.dumps({"code": code}).encode(),
            headers={"content-type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=self.timeout) as response:
            return json.loads(response.read())

