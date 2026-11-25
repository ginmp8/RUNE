$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
python scripts/validate_workspace.py
$env:PYTHONPATH = Join-Path $Root "services/rune/apps/rune-studio/src"
python -m pytest -q services/rune/apps/rune-studio/tests services/rune/tools/tests
$env:PYTHONPATH = Join-Path $Root "services/rune/sdk/python"
python -m pytest -q services/rune/sdk/python/tests
Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue
node services/rune/sdk/typescript/tests/contract.test.mjs
docker run --rm -v "${Root}:/src" -w /src mcr.microsoft.com/dotnet/sdk:10.0.302 dotnet test RUNE.slnx --configuration Release
docker compose build
docker build --target browser-test -f services/rune/apps/rune-worker/Dockerfile -t rune-browser-tests .
docker run --rm --shm-size=1g rune-browser-tests
docker build --target test -f services/rune/apps/rune-studio/Dockerfile -t rune-studio-tests .
docker run --rm rune-studio-tests /app/tests /app/tool-tests
try {
  python scripts/verify_compose_pipeline.py --output build/compose-evidence --skip-build
  docker compose up -d --wait
  python scripts/smoke.py
  docker compose exec -T rune-worker python3 /validation/scripts/verify_studio_pipeline.py --api-url http://rune-api:8080 --output-pdf /tmp/rune-studio-pipeline.pdf
} finally {
  docker compose down -v
}
