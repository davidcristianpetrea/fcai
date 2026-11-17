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
            self._face_from_track(track, timestamp_ms)
            for track in tracks
            if track.last_seen_ms == timestamp_ms
        )

        camera_frame = self.annotate_frame(frame, tracks, timestamp_ms)

        self.last_analysis_ms = (time.monotonic() - start_time) * 1000.0
        self._frame_count += 1
        now = time.monotonic()
        if now - self._last_fps_time >= 1.0:
            self.current_fps = round(self._frame_count / (now - self._last_fps_time), 1)
            self._frame_count = 0
            self._last_fps_time = now

        return FacesMessage(timestamp_ms, faces, camera_frame)

    def annotate_frame(self, frame, tracks, timestamp_ms: int) -> str | None:
        if frame is None or cv2 is None:
            return None
        try:
            annotated = frame.copy()
            h, w = annotated.shape[:2]

            # Top overlay bar
            cv2.rectangle(annotated, (0, 0), (w, 36), (18, 10, 6), -1)
            active_count = len([t for t in tracks if t.last_seen_ms == timestamp_ms])
            status_text = f"C920 LIVE | {w}x{h} | {self.current_fps:.1f} FPS | {active_count} fete detectate"
            cv2.putText(annotated, status_text, (14, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.60, (245, 158, 11), 2, cv2.LINE_AA)

            for track in tracks:
                if track.last_seen_ms != timestamp_ms:
                    continue
                bx, by, bw, bh = track.box
                x1 = max(0, min(w - 1, int(bx * w)))
                y1 = max(0, min(h - 1, int(by * h)))
                x2 = max(0, min(w - 1, int((bx + bw) * w)))
                y2 = max(0, min(h - 1, int((by + bh) * h)))

                is_looking = getattr(track, "looking", False)
                box_color = (0, 230, 80) if is_looking else (245, 158, 11)  # BGR: green if looking, amber if not

                # Bounding box
                cv2.rectangle(annotated, (x1, y1), (x2, y2), box_color, 2)

                # Corner brackets
                bracket_len = min(22, max(10, int(bw * w * 0.18)))
                cv2.line(annotated, (x1, y1), (x1 + bracket_len, y1), box_color, 3)
                cv2.line(annotated, (x1, y1), (x1, y1 + bracket_len), box_color, 3)
                cv2.line(annotated, (x2, y1), (x2 - bracket_len, y1), box_color, 3)
                cv2.line(annotated, (x2, y1), (x2, y1 + bracket_len), box_color, 3)
                cv2.line(annotated, (x1, y2), (x1 + bracket_len, y2), box_color, 3)
                cv2.line(annotated, (x1, y2), (x1, y2 - bracket_len), box_color, 3)
                cv2.line(annotated, (x2, y2), (x2 - bracket_len, y2), box_color, 3)
                cv2.line(annotated, (x2, y2), (x2, y2 - bracket_len), box_color, 3)

                dwell = 0.0
                if getattr(track, "looking_since_ms", None):
                    dwell = max(0.0, (timestamp_ms - track.looking_since_ms) / 1000.0)

                look_str = f"PRIVIRE: DA ({dwell:.1f}s)" if is_looking else "PRIVIRE: NU"
                label = f"#{track.id} {look_str} | {int(track.score * 100)}%"

                label_y = max(38, y1 - 8)
                label_w = min(w - x1 - 2, 240)
                cv2.rectangle(annotated, (x1, label_y - 20), (x1 + label_w, label_y + 4), (18, 10, 6), -1)
                cv2.rectangle(annotated, (x1, label_y - 20), (x1 + label_w, label_y + 4), box_color, 1)
                cv2.putText(annotated, label, (x1 + 6, label_y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)

            small = cv2.resize(annotated, (640, 360), interpolation=cv2.INTER_AREA)
            _, jpeg = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, 65])
            import base64
            return f"data:image/jpeg;base64,{base64.b64encode(jpeg.tobytes()).decode('ascii')}"
        except Exception:
            return None

    def message(self, timestamp_ms: int) -> FacesMessage:
        return FacesMessage(timestamp_ms, tuple(
            self._face_from_track(track, timestamp_ms)
            for track in self.tracker.tracks
            if timestamp_ms - track.last_seen_ms <= 600
        ))

    @staticmethod
    def _face_from_track(track, timestamp_ms: int = 0):
        from .models import Face
        x, y, w, h = track.box
        dwell = 0.0
        if getattr(track, "looking_since_ms", None) and timestamp_ms > 0:
            dwell = max(0.0, (timestamp_ms - track.looking_since_ms) / 1000.0)
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
            dwell_seconds=dwell,
        )
