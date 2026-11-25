# Distributed resilience

RUNE 0.18.0 includes a bounded multi-node qualification profile for the existing API, Worker, NATS JetStream, shared job storage, and shared render cache.

## Supported topology

```text
API A ─┐
       ├─> NATS JetStream ─> Worker A ─┐
API B ─┘                    Worker B ─┼─> shared /data and /cache
                                      └─> immutable published artifacts
```

The minimum profile is implemented in `docker-compose.resilience.yml`:

- two API instances on ports `8081` and `8082`;
- two Worker instances;
- one file-backed NATS JetStream server;
- one shared artifact/job volume;
- one shared cache volume.

This profile is a qualification environment. It does not implement consensus, multi-region replication, or a production scheduler.

## Job ownership and fencing

Every successful job claim increments the persisted `leaseToken`. The returned `RenderJobLease` carries:

- render ID;
- Worker ID;
- expiration time;
- attempt number;
- monotonic fencing token.

The Worker uses owner-aware writes for job state, results, side artifacts, PDF-conversion artifacts, and atomic multi-output sets. A write is accepted only while the persisted owner and fencing token match and the lease remains active. A Worker that resumes after its lease expired cannot publish over the replacement owner.

Lease renewal also requires the fencing token. A conflicting claim, expired token, or superseded owner is rejected and recorded in operational metrics.

## Idempotency and duplicate delivery

Two independent protections are retained:

1. API idempotency keys are serialized by the shared job-store lock. Concurrent equal requests return the same job. Reuse with a different payload remains invalid.
2. A repeated render command is harmless. Terminal jobs are not reclaimed, and completion-event IDs are derived deterministically from the command and event kind so redelivery does not create a second logical completion.

The supported recovery sequence is:

1. Worker A claims token `N`;
2. Worker A stops or loses its heartbeat;
3. the lease expires;
4. Worker B claims token `N+1`;
5. Worker A resumes and attempts a state or artifact write;
6. storage rejects token `N`;
7. Worker B commits the only complete result.

## Atomic storage publication

Result and artifact writes use unique temporary paths. Owner-aware operations verify the fencing token before staging and again immediately before publication. Multi-output sets use `stage -> verify -> rename`, with rollback to the previous committed directory when the rename sequence fails.

Incomplete temporary files and abandoned stage/backup directories are never returned as completed results. `RenderRetentionWorker` removes abandoned entries after `RUNE_ABANDONED_TEMP_MINUTES`.

## Cache ownership

The shared render cache retains its cross-process lock and heartbeat. `RenderCacheLease.FencingToken` must be supplied when publishing a newly rendered cache entry. Publication stages a complete cache directory and verifies that the lock still contains the same token immediately before the atomic directory replacement. A superseded cache owner receives `CacheFencingRejectedException`.

## Qualification

Static contract:

```bash
python3 scripts/verify_resilience_contract.py --root .
```

Live multi-node recovery:

```bash
python3 scripts/verify_multi_node_resilience.py \
  --output build/resilience/multi-node
```

The live command recreates the resilience volumes. Do not point it at data that must be retained.
