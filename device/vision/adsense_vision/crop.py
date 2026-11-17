from __future__ import annotations

import base64
from typing import Any

try:
    import cv2
    import numpy as np
except ImportError:
    cv2 = None
    np = None


def extract_face_crop(
    frame: np.ndarray,
    box: tuple[float, float, float, float],
    target_size: int = 320,
    jpeg_quality: int = 80,
    crop_scale: float = 1.7,
    y_offset_ratio: float = -0.04,
) -> str | None:
    """Extract a square crop around face (1.7x face height, centered naturally on face)
    and return as data:image/jpeg;base64 string.
    """
    if cv2 is None or frame is None or frame.size == 0:
        return None

    frame_h, frame_w = frame.shape[:2]
    x_norm, y_norm, w_norm, h_norm = box
    if w_norm <= 0 or h_norm <= 0:
        return None

    # Face center
    cx = (x_norm + w_norm / 2.0) * frame_w
    cy = (y_norm + h_norm / 2.0 + y_offset_ratio * h_norm) * frame_h

    # Square crop size
    crop_size = int(crop_scale * h_norm * frame_h)
    crop_size = max(32, min(crop_size, max(frame_h, frame_w)))
    half = crop_size // 2

    x1 = int(round(cx - half))
    y1 = int(round(cy - half))
    x2 = x1 + crop_size
    y2 = y1 + crop_size

    # Handle padding if crop extends outside frame boundaries
    pad_left = max(0, -x1)
    pad_top = max(0, -y1)
    pad_right = max(0, x2 - frame_w)
    pad_bottom = max(0, y2 - frame_h)

    src_x1 = max(0, x1)
    src_y1 = max(0, y1)
    src_x2 = min(frame_w, x2)
    src_y2 = min(frame_h, y2)

    cropped = frame[src_y1:src_y2, src_x1:src_x2]
    if cropped.size == 0:
        return None

    if pad_left > 0 or pad_top > 0 or pad_right > 0 or pad_bottom > 0:
        cropped = cv2.copyMakeBorder(
            cropped,
            pad_top,
            pad_bottom,
            pad_left,
            pad_right,
            cv2.BORDER_REFLECT_101,
        )

    if cropped.shape[0] != target_size or cropped.shape[1] != target_size:
        cropped = cv2.resize(cropped, (target_size, target_size), interpolation=cv2.INTER_AREA)

    ok, encoded = cv2.imencode(".jpg", cropped, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
    if not ok:
        return None

    b64 = base64.b64encode(encoded.tobytes()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"
