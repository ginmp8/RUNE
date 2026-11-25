# Live NATS JetStream Validation

The opt-in NATS adapter test validates a real JetStream publish, consume, payload round trip, explicit acknowledgement, and cooperative shutdown against the exact configured server.

Enable the adapter-level test with `RUNE_RUN_NATS_INTEGRATION=1` and set `RUNE_NATS_URL` when the server is not available at `nats://127.0.0.1:4222`.

The higher-level `scripts/verify_distributed_pipeline.py` gate additionally starts the API and Worker, proves a render remains queued before Worker startup, verifies idempotency, and generates real Chromium artifacts through the complete distributed service path.
