from __future__ import annotations

import asyncio
import json
from pathlib import Path
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from threading import Thread
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from websockets.asyncio.server import Server, serve


@dataclass
class LocalBoundary:
    host: str
    http_port: int
    websocket_port: int
    state: Callable[[], dict[str, Any]]
    on_message: Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]
    renderer_dir: Path | None = None
    media_dir: Path | None = None

    def start_http(self) -> ThreadingHTTPServer:
        state = self.state
        renderer_dir = self.renderer_dir
        media_dir = self.media_dir

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                if self.path == "/health":
                    body = {"ok": True}
                    content_type = "application/json"
                elif self.path == "/api/state":
                    body = state()
                    content_type = "application/json"
                elif self.path.startswith("/media/"):
                    self._serve_file((media_dir or Path.cwd()) / self.path.removeprefix("/media/"))
                    return
                elif self.path == "/" or (renderer_dir and (renderer_dir / self.path.lstrip("/")).is_file()):
                    relative = "index.html" if self.path == "/" else self.path.lstrip("/")
                    file_path = (renderer_dir or Path.cwd()) / relative
                    self._serve_file(file_path)
                    return
                else:
                    self.send_error(404)
                    return
                encoded = json.dumps(body).encode() if isinstance(body, dict) else body
                self.send_response(200)
                self.send_header("content-type", content_type)
                self.send_header("content-length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)

            def _serve_file(self, file_path: Path) -> None:
                try:
                    payload = file_path.read_bytes()
                except OSError:
                    self.send_error(404)
                    return
                content_type = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css"}.get(file_path.suffix, "application/octet-stream")
                self.send_response(200)
                self.send_header("content-type", content_type)
                self.send_header("content-length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def log_message(self, *_args: object) -> None:
                return

        server = ThreadingHTTPServer((self.host, self.http_port), Handler)
        Thread(target=server.serve_forever, daemon=True).start()
        return server

    async def start_websocket(self) -> Server:
        async def handler(connection: Any) -> None:
            async for message in connection:
                response = await self.on_message(json.loads(message))
                await connection.send(json.dumps(response))

        return await serve(handler, self.host, self.websocket_port)
