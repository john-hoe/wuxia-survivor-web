"""Bounded media downloader for trusted generation-provider responses."""

from __future__ import annotations

import argparse
import os
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

ALLOWED_MIME_PREFIXES = ("image/", "audio/")
DEFAULT_MAX_BYTES = 32 * 1024 * 1024


class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, allowed_hosts: set[str]):
        super().__init__()
        self.allowed_hosts = allowed_hosts

    def redirect_request(self, request, fp, code, msg, headers, newurl):
        validate_url(newurl, self.allowed_hosts)
        redirected = super().redirect_request(request, fp, code, msg, headers, newurl)
        if redirected is not None:
            redirected.remove_header("Authorization")
        return redirected


def validate_url(url: str, allowed_hosts: set[str]) -> None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https":
        raise ValueError("only https URLs are accepted")
    if not parsed.hostname or parsed.hostname.lower() not in allowed_hosts:
        raise ValueError(f"host is not allowlisted: {parsed.hostname!r}")
    if parsed.username or parsed.password:
        raise ValueError("userinfo in URLs is forbidden")


def download_media(
    url: str,
    output: Path,
    allowed_hosts: set[str],
    max_bytes: int = DEFAULT_MAX_BYTES,
    bearer_token: str | None = None,
) -> None:
    validate_url(url, allowed_hosts)
    headers = {"User-Agent": "wuxia-asset-pipeline/1"}
    if bearer_token:
        headers["Authorization"] = f"Bearer {bearer_token}"
    opener = urllib.request.build_opener(SafeRedirectHandler(allowed_hosts))
    request = urllib.request.Request(url, headers=headers)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary_name: str | None = None
    try:
        with opener.open(request, timeout=30) as response:
            content_type = response.headers.get_content_type().lower()
            if not any(content_type.startswith(prefix) for prefix in ALLOWED_MIME_PREFIXES):
                raise ValueError(f"unexpected MIME type: {content_type}")
            declared = response.headers.get("Content-Length")
            if declared is not None and int(declared) > max_bytes:
                raise ValueError("response exceeds byte limit")
            with tempfile.NamedTemporaryFile(
                dir=output.parent, prefix=f".{output.name}.", delete=False
            ) as temporary:
                temporary_name = temporary.name
                total = 0
                while chunk := response.read(64 * 1024):
                    total += len(chunk)
                    if total > max_bytes:
                        raise ValueError("stream exceeds byte limit")
                    temporary.write(chunk)
        os.replace(temporary_name, output)
        temporary_name = None
    finally:
        if temporary_name:
            Path(temporary_name).unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("output", type=Path)
    parser.add_argument("--allow-host", action="append", required=True)
    parser.add_argument("--max-mib", type=int, default=32)
    parser.add_argument("--token-env")
    args = parser.parse_args()
    token = os.environ.get(args.token_env) if args.token_env else None
    if args.token_env and not token:
        parser.error(f"required environment variable is missing: {args.token_env}")
    try:
        download_media(
            args.url,
            args.output,
            {host.lower() for host in args.allow_host},
            max_bytes=args.max_mib * 1024 * 1024,
            bearer_token=token,
        )
    except (OSError, ValueError) as error:
        parser.exit(1, f"download failed: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
