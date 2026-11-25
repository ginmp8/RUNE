# Recovery RUNE 0.14.0

Use this procedure when a Compose qualification run is interrupted.

1. Preserve `build/compose-evidence`, especially service logs and failure metadata.
2. Run `docker compose ps --all` and inspect the health and exit status of every service.
3. Inspect `http://localhost:8222/jsz?streams=true&consumers=true` before deleting volumes.
4. If a job is queued or has an expired lease, restart NATS and Worker without deleting `rune-data` or `nats-data`.
5. Confirm the job reaches a terminal state and its artifact can be retrieved through the API.
6. Run `docker compose down -v` only after retained evidence and queued-job state are no longer required.
7. Re-run the complete verifier from a clean environment.

A failed or interrupted qualification does not authorize updating `LAST_VERSION`.
