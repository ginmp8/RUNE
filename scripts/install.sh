#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
command -v docker >/dev/null || { echo "Docker is required." >&2; exit 1; }
docker compose version >/dev/null
docker compose build --pull
cleanup() { docker compose down -v >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker compose up -d --wait
docker compose exec -T rune-worker python3 /validation/scripts/verify_studio_pipeline.py --api-url http://rune-api:8080 --output-pdf /tmp/rune-studio-pipeline.pdf
