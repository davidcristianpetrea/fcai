from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None


@dataclass(frozen=True)
class Detection:
    box: tuple[float, float, float, float]
    score: float
    yaw: float = 0.0
    pitch: float = 0.0


class Detector(Protocol):
    def detect(self, frame: np.ndarray) -> list[Detection]:
        ...


class MediaPipeFaceDetector:
    """MediaPipe Tasks face detector wrapper.

    Head-pose extraction is intentionally kept behind the detector boundary: the
    Face Landmarker model asset is deployment-provided and can be added without
    changing the tracker, protocol, or attention state machine.
    """

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
            detections.append(Detection(
                box=(
                    max(0.0, box.origin_x / width),
                    max(0.0, box.origin_y / height),
                    min(1.0, box.width / width),
                    min(1.0, box.height / height),
                ),
                score=score,
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
            Detection((x / width, y / height, w / width, h / height), 0.5)
            for x, y, w, h in faces
        ]

