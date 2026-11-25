# Physical Font Subsetting And Sanitization

RUNE uses a bundled FontTools-based utility for WOFF, WOFF2, TrueType, and OpenType inspection, validation, deterministic sanitization, and physical glyph subsetting. The utility is invoked out of process with bounded time and output size; it does not execute font programs in the API process.

Full validation is keyed by the source SHA-256, validator version, and policy version. Physical subsets are keyed by source hash, canonical glyph-set hash, output format, subsetter version, and options hash. Files are written through temporary paths and atomically renamed after validation, so incomplete results are never published as cache hits.

`auto` mode performs only bounded request-path decisions: validate or reuse metadata, identify characters, emit `unicode-range`, consult the subset cache, and apply a cached subset when available. A qualifying cache miss can schedule opportunistic in-process generation and immediately continue with the original or sanitized font. `physical` mode performs fail-closed generation when the caller explicitly requires reduced bytes.

Automatic scheduling is best effort and process-local in this release. A durable external low-priority queue, cross-service deduplication, and production calibration of savings thresholds remain deployment concerns.
