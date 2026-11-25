# Subjects

## Commands

- `rune.render.requested.v1`

## Lifecycle events

- `rune.render.started.v1`
- `rune.render.progressed.v1`
- `rune.render.completed.v1`
- `rune.render.failed.v1`
- `rune.render.cancelled.v1`
- `rune.render.dead-lettered.v1`

Every message includes an event identifier, render identifier, contract version, occurrence time, and optional correlation/causation metadata. Consumers must be idempotent because delivery is at least once.

Stream: `RUNE_RENDER`. Durable worker consumer: `rune-render-worker-v1`.

## Terminal delivery and replay

A non-retryable or exhausted command is terminated with an explicit JetStream termination reason and recorded in the RUNE job store as dead-lettered. Replaying a dead-lettered job creates a new dispatch generation and deterministic command event identifier; the previous terminal event remains immutable evidence.
