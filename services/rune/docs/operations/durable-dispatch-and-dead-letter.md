# Durable Dispatch, Dead Letter, and Replay

RUNE persists command-publication intent in the same `job.json` transaction that creates or requeues a render. The intent contains a deterministic event identifier, generation, status, attempt count, publisher lease, fencing token, retry time, publication time, error, and W3C trace headers.

## Publication protocol

1. Job/package creation atomically records `dispatchStatus=pending`.
2. An API instance acquires a short publication lease and increments `dispatchToken`.
3. The selected provider publishes `RenderRequested` with the persisted `dispatchEventId`.
4. Successful publication changes the intent to `published` only while the same fencing token is current.
5. Failure returns the intent to `pending` with bounded exponential retry.
6. The API reconciliation worker republishes pending or expired-publishing intents.

If publication succeeds but the API stops before recording success, the next publisher reuses the same event ID. JetStream duplicate suppression prevents a second broker message inside its duplicate window; outside that window, render-level idempotency, terminal guards, and job leases still prevent duplicate completed artifacts.

Local mode also persists intent. Its in-memory channel is not durable, so startup recovery creates a new dispatch generation for queued or expired work before republishing it.

## Dead-letter contract

A non-retryable processor result marks the job as failed with:

- `deadLetteredAt`;
- `deadLetterReason`;
- `progressStage=dead-lettered`;
- the final attempt and error.

The Worker publishes `RenderDeadLettered` on `rune.render.dead-lettered.v1`, then terminates the JetStream delivery with an explicit reason. Local mode records the same terminal state and lifecycle event without re-enqueuing the command.

Operators use:

- `GET /v1/dead-letters` to list dead-lettered jobs;
- `POST /v1/renders/{id}/replay` to clear terminal dead-letter state, create a new durable dispatch generation, and republish safely.

Ordinary `POST /v1/renders/{id}/retry` remains available for failed or cancelled jobs that do not require the explicit dead-letter workflow.

## Publication timeout

`RUNE_DISPATCH_PUBLISH_TIMEOUT_SECONDS` bounds each broker publication attempt (default 5 seconds, allowed 1–60). A timeout returns the fenced dispatch record to `pending`, records `dispatch-publish-timeout`, and lets the background reconciler retry without losing the accepted job.
