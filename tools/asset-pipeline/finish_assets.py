"""Non-destructive alpha-boundary outline and deterministic paper texture."""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def path_seed(relative_path: Path, base_seed: int) -> int:
    digest = hashlib.sha256(f"{base_seed}:{relative_path.as_posix()}".encode()).digest()
    return int.from_bytes(digest[:8], "big")


def finish(source_path: Path, output_path: Path, relative_path: Path, base_seed: int) -> None:
    with Image.open(source_path) as opened:
        source = opened.convert("RGBA")
    rgba = np.asarray(source, dtype=np.uint8).copy()
    alpha_image = source.getchannel("A")
    expanded_alpha = np.asarray(alpha_image.filter(ImageFilter.MaxFilter(5)), dtype=np.uint8)
    alpha = rgba[:, :, 3]

    # Outline only transparent pixels next to visible alpha. Internal dark
    # pixels are never classified as outline, avoiding the legacy mask defect.
    exterior_outline = (expanded_alpha > 8) & (alpha <= 8)
    output = np.zeros_like(rgba)
    output[exterior_outline, :3] = np.array([18, 31, 25], dtype=np.uint8)
    output[exterior_outline, 3] = expanded_alpha[exterior_outline]
    visible = alpha > 8
    output[visible] = rgba[visible]

    rng = np.random.default_rng(path_seed(relative_path, base_seed))
    paper = rng.normal(0, 2.2, size=alpha.shape)
    for channel in range(3):
        values = output[:, :, channel].astype(np.float32)
        values[visible] += paper[visible]
        output[:, :, channel] = np.clip(values, 0, 255).astype(np.uint8)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(output).save(output_path, format="PNG", optimize=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input_root", type=Path)
    parser.add_argument("output_root", type=Path)
    parser.add_argument("--base-seed", type=int, default=20260730)
    args = parser.parse_args()
    if not args.input_root.is_dir():
        parser.error(f"input root does not exist: {args.input_root}")
    paths = sorted(args.input_root.rglob("*.png"))
    if not paths:
        parser.exit(1, "no PNG assets discovered\n")
    failures: list[str] = []
    for source_path in paths:
        relative_path = source_path.relative_to(args.input_root)
        try:
            finish(
                source_path,
                args.output_root / relative_path,
                relative_path,
                args.base_seed,
            )
        except OSError as error:
            failures.append(f"{relative_path}: {error}")
    if failures:
        parser.exit(1, "\n".join(failures) + "\n")
    print(f"processed {len(paths)} PNG assets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
