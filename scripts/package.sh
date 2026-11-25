#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT="${1:?Usage: package.sh <rune-version-release-directory>}"
python3 "$ROOT/scripts/package_release.py" --root "$ROOT" --output "$OUTPUT"
