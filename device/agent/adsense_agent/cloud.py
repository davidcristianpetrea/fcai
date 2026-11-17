from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import json
USER_AGENT = "AdSense-Display/0.1.0"


class CloudLink(Protocol):
    def pair_request(self) -> dict[str, Any]: ...
    def pair_status(self, device_id: str, code: str) -> dict[str, Any]: ...
    def download_media(self, asset_id: str, token: str, destination) -> None: ...
    def claim(self, code: str) -> dict[str, Any]: ...
    def sync(self, payload: dict[str, Any], token: str = "") -> dict[str, Any]: ...


@dataclass
class HttpCloudLink:
    base_url: str = "https://adsense.davidpetrea.ro"
    timeout: float = 10.0

    def _request(self, url: str, *, data: bytes | None = None, token: str = "", method: str = "GET") -> Request:
        headers = {"User-Agent": USER_AGENT}
        if data is not None:
            headers["content-type"] = "application/json"
        if token:
            headers["authorization"] = f"Bearer {token}"
        return Request(url, data=data, headers=headers, method=method)

    def sync(self, payload: dict[str, Any], token: str = "") -> dict[str, Any]:
        if not self.base_url:
            return {"ok": False, "reason": "cloud_not_configured"}
        request = self._request(f"{self.base_url.rstrip('/')}/api/device/sync", data=json.dumps(payload).encode(), token=token, method="POST")
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return json.loads(response.read())
        except HTTPError as e:
            if e.code in (401, 404):
                try:
                    data = json.loads(e.read())
                    if isinstance(data, dict):
                        return data
                except Exception:
                    pass
                return {"ok": False, "deleted": True, "error": "device_deleted"}
            raise

    def pair_request(self) -> dict[str, Any]:
        request = self._request(f"{self.base_url.rstrip('/')}/api/device/pair-request", data=b"{}", method="POST")
        with urlopen(request, timeout=self.timeout) as response:
            return json.loads(response.read())

    def pair_status(self, device_id: str, code: str) -> dict[str, Any]:
        request = self._request(f"{self.base_url.rstrip('/')}/api/device/pair-status?deviceId={device_id}&code={code}")
        with urlopen(request, timeout=self.timeout) as response:
            return json.loads(response.read())

    def download_media(self, asset_id: str, token: str, destination) -> None:
        request = self._request(f"{self.base_url.rstrip('/')}/api/device/media/{asset_id}", token=token)
        with urlopen(request, timeout=self.timeout) as response, destination.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
    def claim(self, code: str) -> dict[str, Any]:
        if not self.base_url:
            return {"ok": False, "reason": "cloud_not_configured"}
        request = self._request(f"{self.base_url.rstrip('/')}/api/device/claim", data=json.dumps({"code": code}).encode(), method="POST")
        with urlopen(request, timeout=self.timeout) as response:
            return json.loads(response.read())

