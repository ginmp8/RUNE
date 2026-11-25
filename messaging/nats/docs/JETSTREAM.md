# JetStream

The adapter provisions a file-backed stream named `RUNE_RENDER` for `rune.render.>`.

- Storage: file.
- Maximum age: seven days.
- Acknowledgement: explicit.
- Command deduplication: message identifier.
- Retry: bounded negative acknowledgement with delay.
- Terminal poison handling: explicit terminate acknowledgement with a bounded reason.
- Dead-letter evidence: persisted job state plus `rune.render.dead-lettered.v1`.
- Worker consumer: durable pull/consume contract owned by the adapter.

A queued command remains in JetStream while worker replicas are zero. A replacement worker claims the persisted RUNE job and restarts the browser phase from the immutable render package. JetStream is not the job-status database; status and artifacts belong to the RUNE job store.

The API persists a command outbox entry before publication. If publication fails, any API instance can acquire the expired publisher lease and retry the same message identifier. This closes the process-failure window between accepting a job and publishing its command.
