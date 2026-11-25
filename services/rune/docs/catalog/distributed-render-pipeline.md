# Distributed Render Pipeline

`scripts/verify_distributed_pipeline.py` starts an exact local NATS Server with JetStream, starts the compiled RUNE API with the `nats` dispatcher, submits work through the RUNE Studio Python client, and then starts the compiled RUNE Worker against the same durable filesystem state.

The gate proves that a browser render remains `queued` before the Worker is available, is consumed after Worker startup, and completes through Chromium. It also verifies API idempotency by submitting the same key twice and requiring the same render identifier.

The qualification fixture contains both SchemaTex `entity-structure` and `orgchart` diagrams. Evidence includes interactive HTML, structured JSON, static HTML, PDF, PDF/A, PNG, JPEG, and SVG, plus job-state histories and service logs.

This local process-based qualification proves the service boundary and real JetStream workflow without Docker. Docker image and Compose execution remain separate operational gates.
