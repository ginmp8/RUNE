# RUNE 0.9.0 rollback

RUNE 0.8.0 is the supported source rollback target.

The public render, job, event, and schema contracts are compatible. Stop 0.9.0 services, deploy the immutable 0.8.0 artifact, and preserve queued jobs and artifacts. The new SBOM, signature, provenance, AppTest, and API-evidence files are release evidence and do not require runtime rollback.
