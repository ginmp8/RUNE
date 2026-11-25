# Rollback from RUNE 0.10.0

RUNE 0.9.2 is the direct rollback target.

1. Stop Studio, API, Worker, and NATS processes.
2. Preserve the configured `RUNE_DATA_ROOT` when queued or completed job evidence must be retained.
3. Replace the complete RUNE 0.10.0 tree with the immutable RUNE 0.9.2 tree. Do not overlay files.
4. Restart the required services and verify `/health`, `/v1/features`, a local render, and any selected dispatcher path.

The release introduces no schema or persisted-data migration. Jobs created with the existing v1 contracts remain compatible, but an in-flight distributed render should be allowed to finish or be explicitly cancelled before rollback.
