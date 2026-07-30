#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
printf '%s\n' "Local scratch targets (not deleted):"
for target in "$repo_root/.asset-gen/tmp" "$repo_root/.asset-gen/staging" "$repo_root/.dpr-test"; do
  if [ -e "$target" ]; then
    du -sh "$target"
  fi
done
printf '%s\n' "Review these exact paths, then remove them manually if no longer needed."
