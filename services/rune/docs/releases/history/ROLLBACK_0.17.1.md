# Rollback from RUNE 0.17.1

## Strategy

Direct rollback to the complete immutable RUNE 0.17.0 artifact is supported because 0.17.1 does not change persisted state or successful request semantics.

## Procedure

1. Stop all 0.17.1 API and Worker processes sharing storage or JetStream state.
2. Preserve queued jobs, dispatch state, dead-letter metadata, artifacts, and cache entries.
3. Deploy the complete verified 0.17.0 artifact; do not overlay individual files.
4. Verify API/Worker version alignment and checksum identity.
5. Re-run queued/dispatch recovery and one native PDF smoke scenario.

After rollback, invalid native-PDF policy requests may again surface as generic HTTP 500 responses. No stored-data downgrade is required.
