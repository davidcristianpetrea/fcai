from __future__ import annotations

from dataclasses import replace
from typing import Any

from .models import Track


def iou(first: tuple[float, float, float, float],
        second: tuple[float, float, float, float]) -> float:
    fx, fy, fw, fh = first
    sx, sy, sw, sh = second
    left = max(fx, sx)
    top = max(fy, sy)
    right = min(fx + fw, sx + sw)
    bottom = min(fy + fh, sy + sh)
    intersection = max(0.0, right - left) * max(0.0, bottom - top)
    union = fw * fh + sw * sh - intersection
    return intersection / union if union else 0.0


class IoUTracker:
    def __init__(self, max_faces: int = 4, max_age_ms: int = 600, threshold: float = 0.2):
        self.max_faces = max_faces
        self.max_age_ms = max_age_ms
        self.threshold = threshold
        self._next_id = 1
        self.tracks: list[Track] = []

    def update(
        self,
        detections: list[Any],
        timestamp_ms: int,
    ) -> list[Track]:
        unmatched = set(range(len(detections)))
        updated: list[Track] = []

        def unpack(det: Any) -> tuple[tuple[float, float, float, float], float, float, float, float, float, bool]:
            if hasattr(det, "box"):
                return (
                    det.box,
                    det.score,
                    getattr(det, "yaw", 0.0),
                    getattr(det, "pitch", 0.0),
                    getattr(det, "yaw_ratio", 0.0),
                    getattr(det, "pitch_ratio", 0.55),
                    getattr(det, "looking", False),
                )
            # Tuple fallback
            box = det[0]
            score = det[1]
            yaw = det[2] if len(det) > 2 else 0.0
            pitch = det[3] if len(det) > 3 else 0.0
            yaw_ratio = det[4] if len(det) > 4 else 0.0
            pitch_ratio = det[5] if len(det) > 5 else 0.55
            looking = det[6] if len(det) > 6 else False
            return box, score, yaw, pitch, yaw_ratio, pitch_ratio, looking

        parsed = [unpack(d) for d in detections]

        for track in self.tracks:
            best_index = None
            best_iou = self.threshold
            for index in unmatched:
                candidate_iou = iou(track.box, parsed[index][0])
                if candidate_iou > best_iou:
                    best_iou = candidate_iou
                    best_index = index

            # Fallback to center distance if IoU drops below threshold during motion
            if best_index is None and unmatched:
                tx, ty, tw, th = track.box
                tcx, tcy = tx + tw / 2.0, ty + th / 2.0
                best_dist = 0.25  # max 25% of screen
                for index in unmatched:
                    bx, by, bw, bh = parsed[index][0]
                    bcx, bcy = bx + bw / 2.0, by + bh / 2.0
                    dist = ((tcx - bcx) ** 2 + (tcy - bcy) ** 2) ** 0.5
                    max_dim = max(tw, th, bw, bh) * 1.5
                    if dist <= max_dim and dist < best_dist:
                        best_dist = dist
                        best_index = index

            if best_index is None:
                if timestamp_ms - track.last_seen_ms <= self.max_age_ms:
                    updated.append(track)
                continue
            unmatched.remove(best_index)
            box, score, yaw, pitch, yaw_ratio, pitch_ratio, looking = parsed[best_index]
            smoothed_yaw_ratio = 0.6 * yaw_ratio + 0.4 * track.yaw_ratio if track.yaw_ratio != 0.0 else yaw_ratio
            smoothed_pitch_ratio = 0.6 * pitch_ratio + 0.4 * track.pitch_ratio if track.pitch_ratio != 0.55 else pitch_ratio
            updated.append(replace(
                track,
                box=box,
                score=score,
                last_seen_ms=timestamp_ms,
                yaw=yaw,
                pitch=pitch,
                yaw_ratio=smoothed_yaw_ratio,
                pitch_ratio=smoothed_pitch_ratio,
                raw_looking=looking,
            ))

        for index in sorted(unmatched, key=lambda idx: parsed[idx][1], reverse=True):
            if len(updated) >= self.max_faces:
                break
            box, score, yaw, pitch, yaw_ratio, pitch_ratio, looking = parsed[index]
            updated.append(Track(
                id=self._next_id,
                box=box,
                score=score,
                last_seen_ms=timestamp_ms,
                yaw=yaw,
                pitch=pitch,
                yaw_ratio=yaw_ratio,
                pitch_ratio=pitch_ratio,
                raw_looking=looking,
            ))
            self._next_id += 1

        self.tracks = sorted(updated, key=lambda track: track.score, reverse=True)[:self.max_faces]
        return list(self.tracks)
