from __future__ import annotations

import asyncio
import json
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

    def start_http(self) -> ThreadingHTTPServer:
        state = self.state

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                if self.path != "/health" and self.path != "/api/state":
                    self.send_error(404)
                    return
                body = {"ok": True} if self.path == "/health" else state()
                encoded = json.dumps(body).encode()
                self.send_response(200)
                self.send_header("content-type", "application/json")
                self.send_header("content-length", str(len(encoded)))
                self.end_headers()
                self.wfile.write(encoded)

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
