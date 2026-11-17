"""Argument-list wrappers for ffmpeg and ffprobe.

These wrappers deliberately avoid shell strings so filenames and metadata
cannot become shell syntax.
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Sequence


def ffmpeg_command(
    input_path: Path,
    output_path: Path,
    *,
    width: int = 1280,
    height: int = 720,
    fps: int = 30,
) -> list[str]:
    return [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(input_path),
        "-vf",
        f"scale={width}:{height}",
        "-r",
        str(fps),
        str(output_path),
    ]


def ffprobe_command(input_path: Path) -> list[str]:
    return [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=width,height,codec_name",
        "-of",
        "json",
        str(input_path),
    ]


def run_media_command(args: Sequence[str]) -> subprocess.CompletedProcess[str]:
    if not args or args[0] not in {"ffmpeg", "ffprobe"}:
        raise ValueError("media command must start with ffmpeg or ffprobe")
    return subprocess.run(list(args), check=True, text=True, capture_output=True)
