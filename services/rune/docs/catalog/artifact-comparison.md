# Artifact Comparison

Artifact comparison is a heavy asynchronous `comparisonJob`. `POST /v1/comparisons` accepts authorized references to immutable RUNE artifacts; arbitrary synchronous Base64 comparison at `/v1/artifacts/compare` is removed and returns HTTP 410.

Left and right artifact authorization is evaluated independently and the generated report inherits the more restrictive classification and retention. Ordered identity plus the versioned profile digest defines idempotency. Jobs expose persisted lifecycle, progress, cancellation, retry, retention, SSE events, and atomic publication.

Comparison layers cover identity/provenance, semantic content, format structure, and deterministic visual evidence. Stable results are `identical`, `equivalent-under-profile`, `different`, `incomparable`, and `failed`. Reports record ignored fields, thresholds, severity, confidence, unsupported comparisons, and changed regions. Sanitized JSON, HTML, and manifest reports become visible only as a complete committed set.
