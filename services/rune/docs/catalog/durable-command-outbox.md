# Durable Command Outbox

Render acceptance and command publication are joined by a persisted dispatch intent in `job.json`. Publication uses deterministic event IDs, bounded retry, expiring publisher leases, and monotonic fencing tokens. A background reconciler recovers pending publication after API interruption.

See [Durable dispatch, dead letter, and replay](../operations/durable-dispatch-and-dead-letter.md).
