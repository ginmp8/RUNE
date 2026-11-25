# Dead Letter and Replay

Non-retryable work receives an explicit dead-letter timestamp and reason, a versioned lifecycle event, and JetStream terminal acknowledgement. Operators can list dead letters and replay one job through a new durable dispatch generation.

See [Durable dispatch, dead letter, and replay](../operations/durable-dispatch-and-dead-letter.md).
