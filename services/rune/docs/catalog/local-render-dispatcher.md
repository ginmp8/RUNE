# Local render dispatcher

## Status

Implemented in RUNE 0.7.0; local became the default in RUNE 0.8.0.

## Behavior

When no provider setting is supplied, RUNE uses the local dispatcher. `RUNE_DISPATCH_PROVIDER=nats` switches to the external NATS/JetStream transport without source changes. An unknown value fails startup and there is no automatic fallback.

The local provider includes:

- a bounded in-memory channel with cancellable backpressure;
- configurable processor concurrency;
- one dependency-injection scope per command;
- shared job processing used by both local and NATS paths;
- retry acknowledgement mapping without command loss;
- startup recovery of queued jobs and jobs whose lease expired;
- consumer startup before recovery, preventing a recovery set larger than channel capacity from blocking host startup;
- graceful shutdown that stops new writes, drains queued/active commands within a configured timeout, and leaves unfinished persisted jobs recoverable;
- health data for provider, capacity, queue depth, active commands, processor count, recovery, and drain timeout state.

## Configuration

```text
RUNE_DISPATCH_PROVIDER=local  # optional; this is the default
RUNE_LOCAL_DISPATCH_CAPACITY=64
RUNE_LOCAL_DISPATCH_PROCESSORS=1
```

Structured configuration is available under `Rune:Dispatching:Local` for capacity, processor count, retry delay, startup recovery, and shutdown drain timeout.

## Durability boundary

The in-memory channel is not durable. Durability belongs to `FileSystemRenderJobStore`, which persists packages, status, leases, results, and companion artifacts. Startup recovery republishes persisted recoverable jobs.

The local provider is intended for single-host or development deployments. Distributed multi-host operation continues to require the NATS provider or another future durable adapter.
