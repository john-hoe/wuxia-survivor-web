"""Strict BGM seam gate using decoded PCM rather than file-level maxima."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path

import numpy as np


def decode_mono(path: Path, sample_rate: int = 48000) -> np.ndarray:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required")
    process = subprocess.run(
        [ffmpeg, "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(sample_rate), "-"],
        check=False,
        capture_output=True,
    )
    if process.returncode != 0:
        raise RuntimeError(process.stderr.decode("utf-8", errors="replace").strip())
    return np.frombuffer(process.stdout, dtype="<f4")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", type=Path)
    parser.add_argument("--absolute-jump", type=float, default=0.035)
    parser.add_argument("--relative-rms", type=float, default=0.35)
    args = parser.parse_args()
    try:
        samples = decode_mono(args.audio)
    except (OSError, RuntimeError) as error:
        parser.exit(1, f"decode failed: {error}\n")
    if samples.size < 4800:
        parser.exit(1, "audio is too short for loop QA\n")
    seam_jump = float(abs(samples[-1] - samples[0]))
    edge_window = np.concatenate((samples[:2400], samples[-2400:]))
    edge_rms = float(np.sqrt(np.mean(np.square(edge_window))))
    allowed = min(args.absolute_jump, max(0.002, edge_rms * args.relative_rms))
    result = {
        "file": str(args.audio),
        "seamJump": seam_jump,
        "edgeRms": edge_rms,
        "allowedJump": allowed,
        "passed": seam_jump <= allowed,
    }
    print(json.dumps(result, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
