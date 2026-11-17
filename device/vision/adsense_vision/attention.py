from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from .models import Track


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

