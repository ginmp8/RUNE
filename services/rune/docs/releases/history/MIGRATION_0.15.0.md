# Migration to RUNE 0.15.0

## Baseline

Migrate from the complete immutable RUNE 0.14.0 functional release. RUNE 0.14.0 remains `latestFunctional` until 0.15.0 completes qualification.

## Required actions

1. Replace the complete workspace or release package; do not overlay selected binaries.
2. Preserve `/data`, `/cache`, and JetStream state until queued jobs are reconciled.
3. Deploy API and Worker from the same 0.15.0 build so both understand `leaseToken`.
4. Expose or scrape `/metrics` according to the deployment's network and authentication boundary.
5. Keep failure injection variables empty outside qualification.
6. Configure `RUNE_ABANDONED_TEMP_MINUTES` only after considering the longest legitimate write duration; the default is 15 minutes outside the resilience profile.
7. Run the static, .NET, multi-node, load, and soak gates in `VALIDATION.md` before promotion.

## Stored-data compatibility

Existing job JSON without `leaseToken` is compatible and defaults to zero. The first new claim writes token `1`. Existing completed jobs remain terminal and are not reclaimed.

Existing cache entries remain readable. A newly published entry uses staged directory replacement. Cache invalidation tokens, fingerprints, quotas, and scope generation remain unchanged.

## New optional settings

```text
RUNE_FAILURE_POINTS
RUNE_FAILURE_ACTION
RUNE_FAILURE_MODE
RUNE_FAILURE_DELAY_MS
RUNE_FAILURE_ONCE_ROOT
RUNE_ABANDONED_TEMP_MINUTES
```

No setting is required for normal operation. `/metrics` is available automatically.
