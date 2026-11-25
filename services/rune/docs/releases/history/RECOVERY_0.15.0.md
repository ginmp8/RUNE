# Recovery RUNE 0.15.0

## Interrupted Worker

1. Do not delete shared `/data`, `/cache`, or JetStream state.
2. Inspect the job's `claimedBy`, `leaseExpiresAt`, `leaseToken`, attempt, and progress stage.
3. Allow the lease to expire or restart a healthy Worker.
4. Confirm the replacement claim receives a larger fencing token.
5. Verify the job completes or reaches a recoverable failed state.
6. Confirm `rune_lease_fencing_rejection_total` increases if the old process attempts to publish.

## Lost response after commit

If the job is already `completed`, do not requeue it. Allow command redelivery to replay the deterministic completion event and ACK. Confirm the artifact digest and attempt remain unchanged.

## Abandoned temporary data

Run or wait for the retention Worker cleanup. For controlled maintenance, invoke the job-store cleanup through the application test/maintenance path rather than deleting active job directories manually. Verify `rune_temp_files_total` returns to the expected baseline.

## Cache lock recovery

A stale cache lock may be quarantined after its configured stale interval. The former token cannot publish after replacement. Do not remove a fresh lock simply because a render is slow; inspect its heartbeat timestamp first.

## Qualification failure

Preserve:

- `multi-node-resilience-report.json`;
- `compose.log`;
- load/soak JSON reports;
- `/metrics` snapshots;
- job JSON and artifact manifests;
- Docker stats and temporary-directory evidence.

A failed qualification does not authorize updating `latestFunctional`.
