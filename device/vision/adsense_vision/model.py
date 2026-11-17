from __future__ import annotations

import hashlib
from pathlib import Path
from urllib.request import urlopen

MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
MODEL_SHA256 = "b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f"


def ensure_model(data_dir: Path) -> Path:
    target = data_dir / "models" / "blaze_face_short_range.tflite"
    if target.is_file() and _sha256(target) == MODEL_SHA256:
        return target
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".tmp")
    with urlopen(MODEL_URL, timeout=30) as response, temporary.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)
    if _sha256(temporary) != MODEL_SHA256:
        temporary.unlink(missing_ok=True)
        raise RuntimeError("Downloaded MediaPipe model checksum did not match")
    temporary.replace(target)
    return target


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()
