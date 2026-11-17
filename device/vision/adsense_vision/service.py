from __future__ import annotations

import os
import time

try:
    import cv2
except ImportError:
    cv2 = None

from .attention import AttentionMachine
from .crop import extract_face_crop
from .detector import Detector
from .models import FacesMessage, VisionConfig
from .tracking import IoUTracker


class VisionService:
    def __init__(self, detector: Detector, config: VisionConfig | None = None):
        self.config = config or VisionConfig()
        self.detector = detector
        self.tracker = IoUTracker(max_faces=self.config.max_faces)
        from .attention import AttentionConfig
        self.attention = AttentionMachine(AttentionConfig(
            dwell_seconds=self.config.dwell_seconds,
            looking_reset_seconds=self.config.looking_reset_seconds,
        ))
        self._last_detection_ms = -1
        self._last_fps_time = time.monotonic()
        self._frame_count = 0
        self.current_fps = 0.0
        self.last_analysis_ms = 0.0

    def process(self, frame, timestamp_ms: int | None = None) -> FacesMessage:
        start_time = time.monotonic()
        timestamp_ms = timestamp_ms or int(time.time() * 1000)
        if (
            self._last_detection_ms >= 0
            and timestamp_ms - self._last_detection_ms < 1000 / self.config.max_hz
        ):
            return self.message(timestamp_ms)
        self._last_detection_ms = timestamp_ms

        # Mirror frame for selfie view by default
        if self.config.mirror and cv2 is not None and frame is not None:
            frame = cv2.flip(frame, 1)

        detections = self.detector.detect(frame)
        filtered = [
            detection
            for detection in detections
            if detection.box[3] >= self.config.min_face_height
        ]
        tracks = self.tracker.update(filtered, timestamp_ms)
        self.attention.update(tracks, timestamp_ms)

        # Extract crops for active faces detected in the current frame
        for track in tracks:
            if track.last_seen_ms == timestamp_ms and frame is not None:
                track.crop_jpeg = extract_face_crop(frame, track.box)

        faces = tuple(
            self._face_from_track(track)
            for track in tracks
            if track.last_seen_ms == timestamp_ms
        )

        self.last_analysis_ms = (time.monotonic() - start_time) * 1000.0
        self._frame_count += 1
        now = time.monotonic()
        if now - self._last_fps_time >= 1.0:
            self.current_fps = round(self._frame_count / (now - self._last_fps_time), 1)
            self._frame_count = 0
            self._last_fps_time = now

        return FacesMessage(timestamp_ms, faces)

    def message(self, timestamp_ms: int) -> FacesMessage:
        return FacesMessage(timestamp_ms, tuple(
            self._face_from_track(track)
            for track in self.tracker.tracks
            if timestamp_ms - track.last_seen_ms <= 600
        ))

    @staticmethod
    def _face_from_track(track):
        from .models import Face
        x, y, w, h = track.box
        return Face(
            id=track.id,
            x=x,
            y=y,
            w=w,
            h=h,
            yaw=track.yaw,
            pitch=track.pitch,
            looking=track.looking,
            score=track.score,
            yaw_ratio=track.yaw_ratio,
            pitch_ratio=track.pitch_ratio,
            crop_jpeg=track.crop_jpeg,
        )
