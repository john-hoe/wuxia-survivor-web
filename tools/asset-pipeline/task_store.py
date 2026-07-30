"""Atomic, fingerprint-bound records for paid generation tasks."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
from pathlib import Path


def request_fingerprint(provider: str, model: str, prompt: str, size: str) -> str:
    canonical = json.dumps(
        {"provider": provider, "model": model, "prompt": prompt, "size": size},
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def atomic_write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", delete=False
        ) as temporary:
            temporary_name = temporary.name
            json.dump(value, temporary, ensure_ascii=False, indent=2, sort_keys=True)
            temporary.write("\n")
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_name, path)
        temporary_name = None
    finally:
        if temporary_name:
            Path(temporary_name).unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("record", type=Path)
    parser.add_argument("--provider", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--size", required=True)
    parser.add_argument("--task-id")
    args = parser.parse_args()
    fingerprint = request_fingerprint(args.provider, args.model, args.prompt, args.size)
    record = {
        "provider": args.provider,
        "model": args.model,
        "prompt": args.prompt,
        "size": args.size,
        "requestFingerprint": fingerprint,
        "idempotencyKey": fingerprint,
        "taskId": args.task_id,
    }
    if args.record.exists():
        current = json.loads(args.record.read_text(encoding="utf-8"))
        if current.get("requestFingerprint") != fingerprint:
            parser.exit(1, "record exists for a different request; refusing stale task reuse\n")
        if current.get("taskId") and not args.task_id:
            record["taskId"] = current["taskId"]
    atomic_write_json(args.record, record)
    print(fingerprint)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
