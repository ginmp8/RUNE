$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
docker compose build --pull
try {
  docker compose up -d --wait
  docker compose exec -T rune-worker python3 /validation/scripts/verify_studio_pipeline.py --api-url http://rune-api:8080 --output-pdf /tmp/rune-studio-pipeline.pdf
} finally {
  docker compose down -v
}
