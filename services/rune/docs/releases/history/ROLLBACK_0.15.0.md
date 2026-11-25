# Rollback RUNE 0.15.0

## Targets

- immutable RUNE 0.14.0 as the immediately preceding and current latest functional baseline;
- immutable RUNE 0.13.1 only as a secondary fallback.

## Procedure

1. Stop both APIs and both Workers.
2. Inspect JetStream for pending render commands and record every non-terminal job.
3. Preserve `/data`, `/cache`, and JetStream volumes.
4. Deploy one complete target package; do not mix 0.15.0 Workers with older API binaries.
5. Clear all `RUNE_FAILURE_*` variables.
6. Run the target version's health and functional validation.
7. Reconcile queued jobs before re-enabling command consumption.

## Data considerations

Older versions ignore the additive `leaseToken` JSON property. However, rollback removes 0.15.0 fencing enforcement. Do not run an old Worker concurrently with a 0.15.0 Worker against the same job store.

Existing cache entries remain data files, but older publication code does not enforce the 0.15.0 cache fencing token. Stop all 0.15.0 publishers before rollback.

## Rollback impact

Rollback removes stale-owner rejection, the `/metrics` resilience set, failure-injection controls, abandoned-temp cleanup, the two-node qualification profile, and load/soak automation.
