# Complete API Evidence

`scripts/generate_api_evidence.py` exercises the public RUNE API through the default local dispatcher and generates interactive HTML, static HTML, structured JSON, PDF, PDF/A, PNG, JPEG, and SVG artifacts.

`scripts/verify_distributed_pipeline.py` generates the same eight formats while proving the Studio client to API to NATS/JetStream to Worker path for every browser-backed output. Both fixtures include Markdown, Mermaid, KaTeX, React Flow, SchemaTex `entity-structure`, and SchemaTex `orgchart` content.

The scripts validate readiness, MIME types, binary signatures, job completion, idempotency, content downloads, SHA-256 digests, and machine-readable manifests. Distributed evidence additionally records job-state transitions and service logs.
