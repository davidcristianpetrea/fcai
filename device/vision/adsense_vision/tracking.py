from __future__ import annotations

from dataclasses import replace

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
        detections: list[tuple[tuple[float, float, float, float], float, float, float]],
        timestamp_ms: int,
    ) -> list[Track]:
        unmatched = set(range(len(detections)))
        updated: list[Track] = []
        for track in self.tracks:
            best_index = None
            best_iou = self.threshold
            for index in unmatched:
                candidate_iou = iou(track.box, detections[index][0])
                if candidate_iou > best_iou:
                    best_iou = candidate_iou
                    best_index = index
            if best_index is None:
                if timestamp_ms - track.last_seen_ms <= self.max_age_ms:
                    updated.append(track)
                continue
            unmatched.remove(best_index)
            box, score, yaw, pitch = detections[best_index]
            updated.append(replace(
                track,
                box=box,
                score=score,
                last_seen_ms=timestamp_ms,
                yaw=yaw,
                pitch=pitch,
            ))

        for index in sorted(unmatched, key=lambda value: detections[value][1], reverse=True):
            if len(updated) >= self.max_faces:
                break
            box, score, yaw, pitch = detections[index]
            updated.append(Track(
                id=self._next_id,
                box=box,
                score=score,
                last_seen_ms=timestamp_ms,
                yaw=yaw,
                pitch=pitch,
            ))
            self._next_id += 1

        self.tracks = sorted(updated, key=lambda track: track.score, reverse=True)[:self.max_faces]
        return list(self.tracks)

