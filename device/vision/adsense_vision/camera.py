from __future__ import annotations

import platform
import time
from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class CameraConfig:
    index: int = 0
    width: int = 1280
    height: int = 720
    fps: int = 30


class C920Camera:
    def __init__(self, config: CameraConfig):
        self.config = config
        self.capture: cv2.VideoCapture | None = None
        self.open()

    def open(self) -> None:
        backend = cv2.CAP_DSHOW if platform.system() == "Windows" else cv2.CAP_V4L2
        capture = cv2.VideoCapture(self.config.index, backend)
        if not capture.isOpened() and platform.system() == "Windows":
            capture.release()
            capture = cv2.VideoCapture(self.config.index, cv2.CAP_MSMF)
        if not capture.isOpened():
            capture.release()
            raise RuntimeError(f"C920 camera {self.config.index} could not be opened")
        capture.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
        capture.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.width)
        capture.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.height)
        capture.set(cv2.CAP_PROP_FPS, self.config.fps)
        self.capture = capture

    def read(self) -> np.ndarray:
        if self.capture is None:
            self.open()
        ok, frame = self.capture.read()
        if not ok or frame is None:
            self.close()
            time.sleep(0.05)
            self.open()
            ok, frame = self.capture.read()
        if not ok or frame is None:
            raise RuntimeError("C920 did not return a frame after reconnect")
        return frame

    def analysis_frame(self, frame: np.ndarray, width: int = 640, height: int = 360) -> np.ndarray:
        return cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)

    def close(self) -> None:
        if self.capture is not None:
            self.capture.release()
            self.capture = None

