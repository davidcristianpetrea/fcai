from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Face:
    id: int
    x: float
    y: float
    w: float
    h: float
    yaw: float
    pitch: float
    looking: bool
    score: float

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "w": self.w,
            "h": self.h,
            "yaw": self.yaw,
            "pitch": self.pitch,
            "looking": self.looking,
            "score": self.score,
        }


@dataclass(frozen=True)
class FacesMessage:
    timestamp_ms: int
    faces: tuple[Face, ...]

    def as_dict(self) -> dict[str, Any]:
        return {
            "t": "faces",
            "ts": self.timestamp_ms,
            "faces": [face.as_dict() for face in self.faces],
        }


@dataclass
class VisionConfig:
    mirror: bool = True
    rotation: int = 0
    detection_range: str = "medium"
    max_faces: int = 4
    analysis_width: int = 640
    analysis_height: int = 360
    max_hz: float = 20.0
    dwell_seconds: float = 3.0
    looking_reset_seconds: float = 0.4

    @property
    def min_face_height(self) -> float:
        return {"near": 0.12, "medium": 0.07, "far": 0.04}[self.detection_range]


@dataclass
class Track:
    id: int
    box: tuple[float, float, float, float]
    score: float
    last_seen_ms: int
    looking: bool = False
    looking_since_ms: int | None = None
    not_looking_since_ms: int | None = None
    yaw: float = 0.0
    pitch: float = 0.0

