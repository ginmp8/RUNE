# Failure injection

RUNE exposes deterministic, opt-in failure points for qualification. Failure injection is disabled unless `RUNE_FAILURE_POINTS` is set.

## Configuration

| Variable | Meaning | Default |
|---|---|---|
| `RUNE_FAILURE_POINTS` | Comma-separated point names or `*` | empty |
| `RUNE_FAILURE_ACTION` | `throw` or process-level `crash` | `throw` |
| `RUNE_FAILURE_MODE` | `once` or `always` | `once` |
| `RUNE_FAILURE_DELAY_MS` | Delay before the injected action | `0` |
| `RUNE_FAILURE_ONCE_ROOT` | Shared marker directory for once-only execution | system temp |

The once-only marker is shared in the resilience Compose profile so a redelivered job is not failed indefinitely.

## Points

| Point | Location | Expected recovery |
|---|---|---|
| `before-render` | after claim and progress publication | retry or takeover |
| `during-chromium` | immediately before browser rendering | retry; no completed artifact |
| `during-temp-write` | before result, artifact, cache, or artifact-set staging | temporary data remains unpublished |
| `during-rename` | immediately before atomic publication | previous committed data remains authoritative |
| `after-commit` | after terminal job state is persisted and before completion publication | redelivery observes completed state and replays completion safely |
| `before-ack` | after processing returns an ACK outcome | JetStream redelivers; terminal job remains harmless |
| `during-upload` | after temporary content copy and before final publication | retry or takeover; partial content remains temporary |

## Examples

Fail once without terminating the Worker:

```bash
RUNE_WORKER_A_FAILURE_POINTS=after-commit \
RUNE_WORKER_A_FAILURE_ACTION=throw \
docker compose -f docker-compose.resilience.yml \
  up -d --force-recreate rune-worker-a
```

Terminate the Worker before acknowledgement:

```bash
RUNE_WORKER_A_FAILURE_POINTS=before-ack \
RUNE_WORKER_A_FAILURE_ACTION=crash \
docker compose -f docker-compose.resilience.yml \
  up -d --force-recreate rune-worker-a
```

## Safety boundary

Failure injection is a test mechanism, not continuous chaos engineering. Do not enable it in a production environment. The implementation does not add remote control endpoints or accept failure-point names from render requests.
