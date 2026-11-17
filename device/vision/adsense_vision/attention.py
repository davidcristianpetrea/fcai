from __future__ import annotations

import os
from dataclasses import dataclass
from enum import Enum
from typing import Any

from .models import Track

YAW_MAX = float(os.getenv("ADSENSE_YAW_MAX", "0.18"))
PITCH_MIN = float(os.getenv("ADSENSE_PITCH_MIN", "0.35"))
PITCH_MAX = float(os.getenv("ADSENSE_PITCH_MAX", "0.75"))


def compute_head_pose(
    keypoints: list[Any],
    yaw_max: float = YAW_MAX,
    pitch_min: float = PITCH_MIN,
    pitch_max: float = PITCH_MAX,
) -> tuple[float, float, float, float, bool]:
    """Compute head direction cheaply from MediaPipe FaceDetector keypoints.
    0: right eye
    1: left eye
    2: nose tip
    3: mouth center
    4: right ear tragion
    5: left ear tragion

    Returns (yaw_ratio, pitch_ratio, yaw_deg, pitch_deg, looking)
    """
    if len(keypoints) < 4:
        return 0.0, 0.55, 0.0, 0.0, False

    def get_coords(point: Any) -> tuple[float, float]:
        if hasattr(point, "x") and hasattr(point, "y"):
            return float(point.x), float(point.y)
        return float(point[0]), float(point[1])

    re_x, re_y = get_coords(keypoints[0])
    le_x, le_y = get_coords(keypoints[1])
    nose_x, nose_y = get_coords(keypoints[2])
    mouth_x, mouth_y = get_coords(keypoints[3])

    eye_mid_x = (re_x + le_x) / 2.0
    eye_mid_y = (re_y + le_y) / 2.0
    eye_dist = abs(le_x - re_x)
    if eye_dist < 1e-5:
        eye_dist = 1e-5

    yaw_ratio = (nose_x - eye_mid_x) / eye_dist

    mouth_dist = mouth_y - eye_mid_y
    if abs(mouth_dist) < 1e-5:
        mouth_dist = 1e-5
    pitch_ratio = (nose_y - eye_mid_y) / mouth_dist

    looking = (abs(yaw_ratio) <= yaw_max) and (pitch_min <= pitch_ratio <= pitch_max)
    yaw_deg = yaw_ratio * 90.0
    pitch_deg = (pitch_ratio - 0.55) * 100.0

    return yaw_ratio, pitch_ratio, yaw_deg, pitch_deg, looking


class AttentionState(str, Enum):
    STANDBY = "standby"
    TRIGGERING = "triggering"
    OFFER = "offer"
    EXITING = "exiting"
    COOLDOWN = "cooldown"


@dataclass
class AttentionConfig:
    dwell_seconds: float = 3.0
    offer_min_seconds: float = 20.0
    exit_after_nobody_seconds: float = 6.0
    cooldown_seconds: float = 8.0
    looking_reset_seconds: float = 0.4


class AttentionMachine:
    def __init__(self, config: AttentionConfig):
        self.config = config
        self.state = AttentionState.STANDBY
        self.state_started_ms = 0
        self.last_face_ms: int | None = None
        self.preview_requested = False

    def update_looking(self, tracks: list[Track], timestamp_ms: int) -> None:
        for track in tracks:
            if track.raw_looking:
                is_looking = True
            elif track.yaw_ratio != 0.0 or track.pitch_ratio != 0.55:
                is_looking = abs(track.yaw_ratio) <= YAW_MAX and PITCH_MIN <= track.pitch_ratio <= PITCH_MAX
            else:
                is_looking = abs(track.yaw) <= 25.0 and abs(track.pitch) <= 20.0

            if is_looking:
                track.not_looking_since_ms = None
                if track.looking_since_ms is None:
                    track.looking_since_ms = timestamp_ms
                track.looking = True
            else:
                track.looking = False
                if track.not_looking_since_ms is None:
                    track.not_looking_since_ms = timestamp_ms
                elif timestamp_ms - track.not_looking_since_ms > self.config.looking_reset_seconds * 1000:
                    track.looking_since_ms = None

    def update(self, tracks: list[Track], timestamp_ms: int) -> AttentionState:
        self.update_looking(tracks, timestamp_ms)
        visible = [track for track in tracks if timestamp_ms - track.last_seen_ms <= 600]
        looking = [track for track in visible if track.looking]
        if visible:
            self.last_face_ms = timestamp_ms

        if self.state == AttentionState.STANDBY:
            if self.preview_requested or any(
                track.looking_since_ms is not None
                and timestamp_ms - track.looking_since_ms >= self.config.dwell_seconds * 1000
                for track in looking
            ):
                self.preview_requested = False
                self._set(AttentionState.OFFER, timestamp_ms)
        elif self.state == AttentionState.OFFER:
            if (
                self.last_face_ms is None
                or timestamp_ms - self.last_face_ms >= self.config.exit_after_nobody_seconds * 1000
            ) and timestamp_ms - self.state_started_ms >= self.config.offer_min_seconds * 1000:
                self._set(AttentionState.EXITING, timestamp_ms)
        elif self.state == AttentionState.EXITING:
            self._set(AttentionState.COOLDOWN, timestamp_ms)
        elif self.state == AttentionState.COOLDOWN:
            if timestamp_ms - self.state_started_ms >= self.config.cooldown_seconds * 1000:
                self._set(AttentionState.STANDBY, timestamp_ms)
        return self.state

    def preview_offer(self, timestamp_ms: int) -> None:
        self.preview_requested = True
        self._set(AttentionState.OFFER, timestamp_ms)

    def _set(self, state: AttentionState, timestamp_ms: int) -> None:
        self.state = state
        self.state_started_ms = timestamp_ms
