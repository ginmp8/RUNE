# RUNE 0.18.0 Rollback

## Strategy

Rollback replaces the complete 0.18.0 artifact with the immutable 0.17.1 artifact. Do not overlay individual binaries, schemas, renderer assets, or SDK files.

## Procedure

1. stop new comparison and render submissions;
2. preserve job, artifact, dispatch, dead-letter, cache, and comparison directories;
3. allow or cancel active 0.18.0 jobs according to the incident decision;
4. deploy the complete verified 0.17.1 API and Worker together;
5. restore 0.17.1 clients or compatibility adapters;
6. verify version/checksum alignment and run one queued render plus one native-PDF smoke.

## Compatibility impact

0.17.1 does not understand the new asynchronous comparison records, artifact-set metadata, or assembly manifests. Preserve these files for roll-forward; do not delete or reinterpret them. Consumers must revert to the former synchronous comparison contract and may again send PDF passwords. Sensitive cache entries encrypted by 0.18.0 are not readable by 0.17.1 and should be bypassed or invalidated rather than downgraded.
