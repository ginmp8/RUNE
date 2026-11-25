# Recovery for RUNE 0.10.0

Re-extract `RUNE-0.10.0.zip`, verify `RUNE-0.10.0.sha256` and the internal `MANIFEST.sha256`, restore the configured data directory, and start the selected topology.

For local operation, start the API with the default local dispatcher. For distributed operation, start NATS Server with JetStream, start the API with `RUNE_DISPATCH_PROVIDER=nats`, and start the Worker with the same `NATS_URL` and `RUNE_DATA_ROOT`.

Confirm `/health`, `/v1/features`, a SchemaTex preview, and at least one browser-backed export before accepting work.
