from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None

from .attention import compute_head_pose


@dataclass(frozen=True)
class Detection:
    box: tuple[float, float, float, float]
    score: float
    yaw: float = 0.0
    pitch: float = 0.0
    yaw_ratio: float = 0.0
    pitch_ratio: float = 0.55
    looking: bool = False
    keypoints: tuple[Any, ...] = ()


class Detector(Protocol):
    def detect(self, frame: np.ndarray) -> list[Detection]:
        ...


class MediaPipeFaceDetector:
    """MediaPipe Tasks face detector wrapper with real looking direction computed from 6 keypoints."""

    def __init__(self, model_asset: str, min_detection_confidence: float = 0.5):
        try:
            import mediapipe as mp
            from mediapipe.tasks import python
            from mediapipe.tasks.python import vision
        except ImportError as error:
            raise RuntimeError("Install the pinned MediaPipe vision dependencies with uv") from error
        if not Path(model_asset).is_file():
            raise FileNotFoundError(f"MediaPipe face detector model not found: {model_asset}")
        self._mp = mp
        self._detector = vision.FaceDetector.create_from_options(
            vision.FaceDetectorOptions(
                base_options=python.BaseOptions(model_asset_path=model_asset),
                min_detection_confidence=min_detection_confidence,
            )
        )

    def detect(self, frame: np.ndarray) -> list[Detection]:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image = self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb)
        result = self._detector.detect(image)
        height, width = frame.shape[:2]
        detections: list[Detection] = []
        for detection in result.detections:
            box = detection.bounding_box
            category = detection.categories[0] if detection.categories else None
            score = float(category.score) if category else 0.0

            keypoints = tuple(detection.keypoints) if detection.keypoints else ()
            yaw_ratio, pitch_ratio, yaw_deg, pitch_deg, looking = 0.0, 0.55, 0.0, 0.0, False
            if len(keypoints) >= 4:
                yaw_ratio, pitch_ratio, yaw_deg, pitch_deg, looking = compute_head_pose(list(keypoints))

            detections.append(Detection(
                box=(
                    max(0.0, box.origin_x / width),
                    max(0.0, box.origin_y / height),
                    min(1.0, box.width / width),
                    min(1.0, box.height / height),
                ),
                score=score,
                yaw=round(yaw_deg, 1),
                pitch=round(pitch_deg, 1),
                yaw_ratio=round(yaw_ratio, 3),
                pitch_ratio=round(pitch_ratio, 3),
                looking=looking,
                keypoints=keypoints,
            ))
        return detections


class OpenCVFallbackDetector:
    """Development fallback used only when a MediaPipe model is unavailable."""

    def __init__(self, cascade_path: str | None = None):
        if cv2 is None:
            raise RuntimeError("OpenCV is required for the fallback detector")
        path = cascade_path or cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self.detector = cv2.CascadeClassifier(path)
        if self.detector.empty():
            raise RuntimeError(f"OpenCV face cascade could not be loaded: {path}")

    def detect(self, frame: np.ndarray) -> list[Detection]:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        height, width = frame.shape[:2]
        faces = self.detector.detectMultiScale(gray, 1.15, 5, minSize=(24, 24))
        return [
            Detection(
                box=(x / width, y / height, w / width, h / height),
                score=0.5,
                yaw=0.0,
                pitch=0.0,
                yaw_ratio=0.0,
                pitch_ratio=0.55,
                looking=True,
            )
            for x, y, w, h in faces
        ]
