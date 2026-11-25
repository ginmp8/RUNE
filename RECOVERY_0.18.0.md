# RUNE 0.18.0 Recovery

## Recovery lineage

RUNE 0.18.0 is a forward implementation release from immutable 0.17.1. It does not replace or rewrite the prior archive.

## Startup recovery

- render jobs recover through the existing durable job/dispatch state;
- comparison jobs are reloaded from persistent storage and queued according to their terminal/nonterminal state;
- stale render/cache/comparison owners are rejected through lease and fencing checks;
- partially staged artifact sets and comparison reports are removed before a retry publishes a complete set;
- corrupt cache entries are quarantined and never returned;
- refresh failure preserves the prior valid cache entry.

## Operator checks

After process interruption, verify job state, owner/fencing token, staging cleanup, committed manifest digests, comparison report availability, cache quarantine, and event continuity. Replay only through the versioned retry/replay endpoints; never copy temporary files into committed locations.
