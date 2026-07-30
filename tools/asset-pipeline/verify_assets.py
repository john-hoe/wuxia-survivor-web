"""Image inventory and strict structural QA gates."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, UnidentifiedImageError


def asset_seed(relative_path: Path, base_seed: int) -> int:
    digest = hashlib.sha256(f"{base_seed}:{relative_path.as_posix()}".encode()).digest()
    return int.from_bytes(digest[:8], "big")


def opposing_edge_error(image: Image.Image) -> dict[str, float]:
    pixels = np.asarray(image.convert("RGBA"), dtype=np.float32) / 255
    horizontal = float(np.mean(np.abs(pixels[:, 0, :] - pixels[:, -1, :])))
    vertical = float(np.mean(np.abs(pixels[0, :, :] - pixels[-1, :, :])))
    return {"leftRightMeanAbsoluteError": horizontal, "topBottomMeanAbsoluteError": vertical}


def inspect(root: Path, tile_threshold: float) -> tuple[list[dict[str, object]], list[str]]:
    records: list[dict[str, object]] = []
    errors: list[str] = []
    image_paths = sorted(path for path in root.rglob("*") if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"})
    if not image_paths:
        errors.append("no image assets discovered")
    for path in image_paths:
        relative = path.relative_to(root)
        try:
            with Image.open(path) as source:
                source.verify()
            with Image.open(path) as source:
                record: dict[str, object] = {
                    "path": relative.as_posix(),
                    "width": source.width,
                    "height": source.height,
                    "mode": source.mode,
                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                    "textureSeed": asset_seed(relative, 20260730),
                }
                if relative.name.startswith("ground_"):
                    seam = opposing_edge_error(source)
                    record["opposingEdges"] = seam
                    if max(seam.values()) > tile_threshold:
                        errors.append(f"{relative}: opposing-edge error exceeds {tile_threshold}")
                records.append(record)
        except (OSError, UnidentifiedImageError) as error:
            errors.append(f"{relative}: unreadable image: {error}")
    return records, errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("asset_root", type=Path)
    parser.add_argument("--tile-threshold", type=float, default=0.18)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if not args.asset_root.is_dir():
        parser.error(f"asset root does not exist: {args.asset_root}")
    records, errors = inspect(args.asset_root, args.tile_threshold)
    result = {"assetCount": len(records), "errors": errors, "assets": records}
    rendered = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)
    if errors:
        print(f"asset QA failed with {len(errors)} error(s)")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
