"""Atomically promote a newly generated media file into the working asset set."""

from __future__ import annotations

import argparse
import os
import tempfile
from pathlib import Path


def promote(source: Path, destination: Path) -> None:
    if not source.is_file():
        raise ValueError(f"generated source does not exist: {source}")
    if source.stat().st_size <= 0:
        raise ValueError(f"generated source is empty: {source}")
    if source.resolve() == destination.resolve():
        raise ValueError("source and destination must differ")

    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary_name: str | None = None
    try:
        with source.open("rb") as source_file:
            with tempfile.NamedTemporaryFile(
                "wb",
                dir=destination.parent,
                prefix=f".{destination.name}.",
                delete=False,
            ) as temporary:
                temporary_name = temporary.name
                while chunk := source_file.read(1024 * 1024):
                    temporary.write(chunk)
                temporary.flush()
                os.fsync(temporary.fileno())
        os.replace(temporary_name, destination)
        temporary_name = None
    finally:
        if temporary_name:
            Path(temporary_name).unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("generated_file", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    try:
        promote(args.generated_file, args.destination)
    except (OSError, ValueError) as error:
        parser.exit(1, f"promotion failed: {error}\n")
    print(f"promoted {args.generated_file} -> {args.destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
