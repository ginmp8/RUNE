# RUNE 0.4.1 rollback

## Strategy

Preferred strategy: roll forward with a corrected 0.4.1 build. RUNE 0.4.0 is not a valid rollback target because its published source does not pass the complete build and test gates.

## Before deployment

If 0.4.1 has not been deployed, stop the rollout and keep the currently deployed immutable artifact. No data action is required.

## After deployment

If rollback is operationally required:

1. stop new render submissions;
2. allow in-flight 0.4.1 jobs to finish or cancel them through the existing job API;
3. redeploy the last previously validated immutable image, normally 0.3.0;
4. preserve the shared job and artifact volumes;
5. verify NATS subjects and persisted job schema versions before resuming traffic;
6. run health, interactive HTML, asynchronous render, and download smokes.

## State compatibility

RUNE 0.4.1 does not change persisted job schemas, event subject majors, or external schema majors. No database or filesystem state migration is introduced by this patch. Jobs using the 0.4 static React Flow behavior may not have equivalent embedded behavior after rollback to 0.3.0; resubmit those jobs after returning to 0.4.1.
