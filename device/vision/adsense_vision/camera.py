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
        try:
            self.open()
        except RuntimeError:
            self.capture = None

    def _indices(self) -> list[int]:
        if self.config.index >= 0:
            return [self.config.index]
        return list(range(10))

    def open(self) -> None:
        backend = cv2.CAP_DSHOW if platform.system() == "Windows" else cv2.CAP_V4L2
        capture = None
        for index in self._indices():
            candidate = cv2.VideoCapture(index, backend)
            if not candidate.isOpened() and platform.system() == "Windows":
                candidate.release()
                candidate = cv2.VideoCapture(index, cv2.CAP_MSMF)
            if candidate.isOpened():
                capture = candidate
                self.config.index = index
                break
            candidate.release()
        if capture is None:
            raise RuntimeError("No UVC camera could be opened")
        capture.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
        capture.set(cv2.CAP_PROP_FRAME_WIDTH, self.config.width)
        capture.set(cv2.CAP_PROP_FRAME_HEIGHT, self.config.height)
        capture.set(cv2.CAP_PROP_FPS, self.config.fps)
        self.capture = capture

    def read(self) -> np.ndarray:
        while True:
            while self.capture is None:
                try:
                    self.open()
                except RuntimeError:
                    print("vision: no UVC camera found; retrying in 3 seconds", flush=True)
                    time.sleep(3)
            ok, frame = self.capture.read()
            if ok and frame is not None:
                return frame
            self.close()
            print("vision: camera read failed; retrying in 3 seconds", flush=True)
            time.sleep(3)
            try:
                self.open()
            except RuntimeError:
                self.capture = None

    def analysis_frame(self, frame: np.ndarray, width: int = 640, height: int = 360) -> np.ndarray:
        return cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)

    def close(self) -> None:
        if self.capture is not None:
            self.capture.release()
            self.capture = None

