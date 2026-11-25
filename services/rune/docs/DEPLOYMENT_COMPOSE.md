# Docker Compose deployment and qualification

## Supported topology

```text
Studio -> API -> NATS JetStream -> Worker -> shared storage/cache -> API/Studio
```

`docker-compose.yml` defines:

- `rune-studio` on port 8501;
- `rune-api` on port 8080 with `RUNE_DISPATCH_PROVIDER=nats`;
- `nats` on ports 4222 and 8222 with file-backed JetStream;
- `rune-worker` with Playwright Chromium, Ghostscript, Tesseract, ICC profiles, and system fonts;
- `storage` and `cache` volume keepers for deterministic UID/GID 10001 ownership;
- `rune-data`, `rune-cache`, and `nats-data` named volumes.

## Start

```bash
docker compose build
docker compose up -d --wait
docker compose ps
```

All services must report healthy before the installation is considered ready.

## Complete qualification

```bash
python3 scripts/verify_compose_pipeline.py \
  --output build/compose-evidence
```

The verifier destroys and recreates its Compose volumes. Do not run it against volumes containing data that must be retained.

The successful evidence directory contains:

- `manifest.json`;
- `compose-ps.jsonl`;
- `compose.log`;
- generated HTML, PDF, PDF/A, PNG, composite, and Worker-recovery artifacts;
- PDF font inspection output;
- state histories for restart and duplicate-delivery scenarios.

## Readiness boundaries

- API readiness requires `/health`, NATS connectivity, and writable data, cache, and temp directories.
- Worker readiness requires a live Worker process, NATS connectivity, writable directories, Chromium, Ghostscript, Tesseract, the sRGB ICC profile, and fontconfig.
- Studio readiness requires its Streamlit health endpoint, API health, and a writable temp directory.
- NATS readiness uses its monitoring endpoint with JetStream enabled.
- storage and cache readiness requires writable volumes owned by UID 10001.

## Shutdown

```bash
docker compose stop -t 90
docker compose down
```

Use `docker compose down -v` only when artifact, cache, and JetStream state may be deleted.

## Scope

The Compose qualification covers deployed rendering and recovery. It does not qualify native PDF import, S3, PDF/UA, release signing, heavy load, or arbitrary executable helpers.

## Supporting local resilience validation

When Docker is unavailable but the exact .NET SDK, NATS Server, Chromium, Ghostscript, Tesseract, fonts, and ICC profile are present, the following command exercises the distributed processes directly:

```bash
python3 scripts/verify_distributed_resilience.py \
  --output build/distributed-resilience-evidence \
  --dotnet /path/to/dotnet \
  --nats-server /path/to/nats-server \
  --chromium /usr/bin/chromium
```

It validates queued persistence across a NATS restart, duplicate suppression, Worker crash recovery, PDF headers and footers, DejaVu font use, composite rendering, and graceful process shutdown. This is supporting evidence only. It does not prove image construction, container users, Compose networking, named volumes, health transitions, or the actual Streamlit service.

## Multi-node resilience profile

`docker-compose.resilience.yml` reuses the same images and infrastructure contracts with this bounded qualification topology:

- `rune-api-a` on port `8081`;
- `rune-api-b` on port `8082`;
- `rune-worker-a` and `rune-worker-b`;
- one file-backed NATS JetStream server;
- shared job/artifact, cache, temporary, failure-marker, and metric storage.

Start it directly with:

```bash
docker compose -f docker-compose.resilience.yml up -d --build --wait
```

The deterministic verifier recreates its named volumes and tests cross-node idempotency, forced duplicate delivery, Worker interruption, takeover, stale-token rejection, atomic publication, and the seven supported failure points:

```bash
python3 scripts/verify_multi_node_resilience.py \
  --output build/resilience/multi-node
```

Failure injection is controlled only through environment variables described in `operations/failure-injection.md`. The profile is not intended for production deployment or continuous chaos execution.
