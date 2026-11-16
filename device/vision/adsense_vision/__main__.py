from __future__ import annotations

import argparse
import json
import time

from .camera import C920Camera, CameraConfig
from .detector import MediaPipeFaceDetector, OpenCVFallbackDetector
from .models import VisionConfig
from .service import VisionService


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the AdSense on-device vision service.")
    parser.add_argument("--camera-index", type=int, default=0)
    parser.add_argument("--model", help="MediaPipe face detector .task model path.")
    parser.add_argument(
        "--fallback",
        action="store_true",
        help="Use the OpenCV Haar detector instead of a MediaPipe model.",
    )
    parser.add_argument("--dwell-seconds", type=float, default=2.0)
    parser.add_argument("--max-hz", type=float, default=20.0)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.fallback == bool(args.model):
        raise SystemExit("Choose exactly one detector: --model MODEL or --fallback")

    detector = (
        OpenCVFallbackDetector()
        if args.fallback
        else MediaPipeFaceDetector(args.model)
    )
    camera = C920Camera(CameraConfig(index=args.camera_index))
    service = VisionService(
        detector,
        VisionConfig(dwell_seconds=args.dwell_seconds, max_hz=args.max_hz),
    )
    try:
        while True:
            frame = camera.analysis_frame(camera.read())
            message = service.process(frame)
            print(json.dumps(message.as_dict(), separators=(",", ":")), flush=True)
    except KeyboardInterrupt:
        pass
    finally:
        camera.close()
