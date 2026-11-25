# Rollback RUNE 0.14.0

## Target

Rollback to the complete immutable RUNE 0.13.1 package.

## Procedure

1. Stop Studio, API, and Worker before changing binaries or images.
2. Inspect JetStream for pending `rune.render.requested.v1` messages.
3. Preserve the `rune-data`, `rune-cache`, and `nats-data` volumes until every queued job is accounted for.
4. Deploy the complete RUNE 0.13.1 package; do not overlay individual files.
5. Restore the 0.13.1 Compose configuration or run the services directly according to its documented scope.
6. Repeat the 0.13.1 health and functional smoke tests.

## Rollback impact

RUNE 0.13.1 does not contain the complete Compose qualification verifier and its Compose API does not explicitly select the NATS dispatcher. A rollback therefore removes the 0.14.0 deployment claim and recovery-test controls.
