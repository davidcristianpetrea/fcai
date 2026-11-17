from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from .camera import C920Camera, CameraConfig
from .detector import MediaPipeFaceDetector, OpenCVFallbackDetector
from .models import VisionConfig
from .service import VisionService
from .model import ensure_model


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the AdSense on-device vision service.")
    parser.add_argument("--camera-index", type=int, default=-1)
    parser.add_argument("--data-dir", default="data")
    parser.add_argument("--ws-host", default="127.0.0.1")
    parser.add_argument("--ws-port", type=int, default=8766)
    parser.add_argument("--dwell-seconds", type=float, default=2.0)
    parser.add_argument("--max-hz", type=float, default=20.0)
    parser.add_argument("--debug", action="store_true", help="Print yaw/pitch ratios per face for threshold tuning")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        detector = MediaPipeFaceDetector(str(ensure_model(Path(args.data_dir))))
        detector_name = "mediapipe"
    except Exception as error:
        print(f"vision: MediaPipe unavailable, using Haar fallback: {error}", flush=True)
        detector = OpenCVFallbackDetector()
        detector_name = "haar"
    camera = C920Camera(CameraConfig(index=args.camera_index))
    service = VisionService(
        detector,
        VisionConfig(dwell_seconds=args.dwell_seconds, max_hz=args.max_hz),
    )

    async def run() -> None:
        import websockets
        clients: set = set()

        async def handler(connection):
            clients.add(connection)
            try:
                await connection.wait_closed()
            finally:
                clients.discard(connection)

        server = await websockets.serve(handler, args.ws_host, args.ws_port)
        print(f"vision: {detector_name} camera 1280x720 MJPG ws://{args.ws_host}:{args.ws_port}", flush=True)
        try:
            while True:
                frame = camera.analysis_frame(camera.read())
                message = service.process(frame)
                payload = json.dumps(message.as_dict(), separators=(",", ":"))
                if args.debug:
                    for face in message.faces:
                        print(
                            f"[debug] face #{face.id}: yaw_ratio={face.yaw_ratio:.3f} "
                            f"pitch_ratio={face.pitch_ratio:.3f} yaw={face.yaw:.1f}deg "
                            f"pitch={face.pitch:.1f}deg looking={face.looking} "
                            f"size=({face.w:.3f},{face.h:.3f})",
                            flush=True,
                        )
                print(payload, flush=True)
                if clients:
                    await asyncio.gather(*(client.send(payload) for client in tuple(clients)), return_exceptions=True)
                await asyncio.sleep(0)
        finally:
            server.close()
            await server.wait_closed()
            camera.close()

    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        camera.close()
