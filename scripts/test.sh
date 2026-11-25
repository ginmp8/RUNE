#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
command -v python3 >/dev/null || { echo "Python 3 is required for workspace validation." >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker is required." >&2; exit 1; }
python3 scripts/validate_workspace.py
python3 scripts/verify_resilience_contract.py --root .
PYTHONPATH="$ROOT/services/rune/apps/rune-studio/src" \
  python3 -m pytest -q services/rune/apps/rune-studio/tests services/rune/tools/tests
PYTHONPATH="$ROOT/services/rune/sdk/python" \
  python3 -m pytest -q services/rune/sdk/python/tests
node services/rune/sdk/typescript/tests/contract.test.mjs
docker run --rm -v "$ROOT:/src" -w /src mcr.microsoft.com/dotnet/sdk:10.0.302 dotnet test RUNE.slnx --configuration Release
docker compose build
docker build --target browser-test -f services/rune/apps/rune-worker/Dockerfile -t rune-browser-tests .
docker run --rm --shm-size=1g rune-browser-tests
docker build --target test -f services/rune/apps/rune-studio/Dockerfile -t rune-studio-tests .
docker run --rm rune-studio-tests /app/tests /app/tool-tests
cleanup() { docker compose down -v >/dev/null 2>&1 || true; }
trap cleanup EXIT
python3 scripts/verify_compose_pipeline.py --output build/compose-evidence --skip-build
python3 scripts/verify_multi_node_resilience.py --output build/resilience/multi-node --skip-build
docker compose up -d --wait
python3 scripts/smoke.py
docker compose exec -T rune-worker python3 /validation/scripts/verify_studio_pipeline.py --api-url http://rune-api:8080 --output-pdf /tmp/rune-studio-pipeline.pdf
