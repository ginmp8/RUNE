# RUNE 0.4.0 rollback

## Strategy

Rollback is artifact-based. Restore the immutable 0.3.0 source and image digests; never replace or mutate the 0.4.0 release artifact.

## Procedure

1. Stop 0.4.0 API, worker, and Studio instances.
2. Preserve 0.4.0 logs, failed render packages, generated artifacts, and the job-volume snapshot for diagnosis.
3. Cancel or quarantine queued 0.4.0 React Flow jobs. Do not let a 0.3.0 worker consume packages compiled for the recovered renderer without an explicit compatibility test.
4. Restore the prior NATS consumer and application image digests.
5. Restore the compatible job-volume snapshot when one was taken before upgrade.
6. Start the 0.3.0 stack and execute its health and smoke checks.
7. Record the rollback reason, affected render identifiers, and artifact digests.

## Data considerations

The job schema major is unchanged, but the HTML package embedded in a job may contain version-specific renderer code. Treat queued or rendering packages as release-specific. Completed artifacts remain immutable and can continue to be served if their files and metadata are intact.

## Preferred correction

When the failure is isolated to a renderer or validation gate, prefer a new corrected 0.4.x release rather than maintaining an indefinite downgrade to the withdrawn runtime path.
