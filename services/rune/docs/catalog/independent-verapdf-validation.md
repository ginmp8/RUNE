# Independent veraPDF Validation

`scripts/validate_verapdf.py` runs an external veraPDF CLI against a RUNE-generated PDF/A artifact, preserves the raw JSON response, and emits a normalized report with profile, compliance, rule counts, and check counts.

veraPDF and Java are qualification tools only. They are not RUNE build, API, worker, renderer, Docker-image, or runtime dependencies.
