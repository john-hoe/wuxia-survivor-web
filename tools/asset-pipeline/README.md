# Tracked asset pipeline

This directory is the reproducible public entry point for asset QA. The ignored
`.asset-gen/` directory is local scratch space and is not an authoritative
pipeline.

Requirements:

```bash
# Python 3.9 or newer
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r tools/asset-pipeline/requirements.txt
```

Commands:

```bash
python tools/asset-pipeline/verify_assets.py game/src/assets
python tools/asset-pipeline/bgm_loop_check.py game/src/assets/audio/bgm_qingshi_loop.ogg
python tools/asset-pipeline/promote_generated.py /path/to/new.raw /path/to/current.raw
```

Rules enforced by these tools:

- failures return a non-zero exit code; Python `assert` is not used as a gate;
- input/output paths are supplied by arguments and resolved relative to the
  repository, never a developer's home directory;
- inventories discover all current assets instead of using an early fixed list;
- tile QA compares real opposing edges;
- outlines are derived from alpha boundaries, not from internal dark pixels;
- per-asset texture seeds include the relative asset path;
- remote downloads must use HTTPS, an explicit hostname allowlist, approved
  media MIME types, and a byte limit;
- bearer credentials are stripped from every redirect;
- API keys come only from environment variables such as
  `MINIMAX_API_KEY`; files inside the worktree are not searched;
- paid generation task records bind provider/model/prompt/size to a fingerprint
  and are written atomically. The fingerprint is the idempotency key.
- newly generated media is promoted atomically and always replaces the selected
  destination; an existing stale `raw` file is never treated as the new result.

Raw/staging files should live outside the worktree or under ignored scratch
directories. Use `cleanup-local.sh` to print the exact removable scratch
targets; deletion remains an explicit operator action.
