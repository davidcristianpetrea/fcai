from __future__ import annotations

import argparse
import time

import cv2
import numpy as np

from .camera import C920Camera, CameraConfig
from .detector import MediaPipeFaceDetector, OpenCVFallbackDetector
from .models import VisionConfig
from .service import VisionService


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Windows/Pi restaurant display demo.")
    parser.add_argument("--camera-index", type=int, default=0)
    parser.add_argument("--model")
    parser.add_argument("--fallback", action="store_true")
    parser.add_argument("--dwell-seconds", type=float, default=2.0)
    parser.add_argument("--offer-seconds", type=float, default=3.0)
    parser.add_argument("--offer-url", default="https://adsense.davidpetrea.ro/offer")
    return parser.parse_args()


def draw_face(frame: np.ndarray, face) -> None:
    height, width = frame.shape[:2]
    x, y, w, h = [int(value * width) for value in (face.x, face.y, face.w, face.h)]
    cv2.rectangle(frame, (x, y), (x + w, y + h), (64, 224, 180), 2)
    cv2.putText(frame, f"face {face.id}", (x, max(20, y - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (64, 224, 180), 2)


def offer_screen(size: tuple[int, int], url: str) -> np.ndarray:
    width, height = size
    screen = np.full((height, width, 3), (245, 247, 251), dtype=np.uint8)
    cv2.rectangle(screen, (0, 0), (width // 2, height), (16, 24, 39), -1)
    cv2.putText(screen, "OFERTA", (48, 90), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (128, 225, 189), 3)
    cv2.putText(screen, "20% reducere", (48, 160), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2)
    cv2.putText(screen, "Scaneaza codul QR", (width // 2 + 40, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (23, 32, 51), 2)
    cv2.putText(screen, url, (width // 2 + 40, 145), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (85, 100, 124), 1)
    return screen


def main() -> None:
    args = parse_args()
    if args.fallback == bool(args.model):
        raise SystemExit("Choose exactly one detector: --model MODEL or --fallback")
    detector = OpenCVFallbackDetector() if args.fallback else MediaPipeFaceDetector(args.model)
    camera = C920Camera(CameraConfig(index=args.camera_index))
    service = VisionService(detector, VisionConfig(dwell_seconds=args.dwell_seconds))
    phase = "standby"
    phase_started = time.monotonic()
    try:
        while True:
            frame = camera.read()
            message = service.process(camera.analysis_frame(frame))
            for face in message.faces:
                draw_face(frame, face)
            looking = any(face.looking for face in message.faces)
            if phase == "standby" and looking:
                phase = "offer"
                phase_started = time.monotonic()
            elif phase == "offer" and time.monotonic() - phase_started >= args.offer_seconds:
                phase = "standby"
            preview = frame.copy()
            cv2.putText(preview, f"PHASE: {phase.upper()}", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (64, 224, 180), 2)
            cv2.putText(preview, f"FACES: {len(message.faces)}", (20, 68), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
            cv2.imshow("Camera and telemetry", preview)
            screen = offer_screen((1280, 720), args.offer_url) if phase == "offer" else np.full((720, 1280, 3), (16, 24, 39), dtype=np.uint8)
            if phase == "standby":
                cv2.putText(screen, "STANDBY", (490, 380), cv2.FONT_HERSHEY_SIMPLEX, 2.2, (128, 225, 189), 4)
            cv2.imshow("Restaurant TV preview", screen)
            if cv2.waitKey(1) & 0xFF == 27:
                break
    finally:
        camera.close()
        cv2.destroyAllWindows()
