# RUNE 0.9.1 rollback

RUNE 0.9.0 remains the immediate immutable source rollback target, but it does not contain an executable SchemaTex runtime and must not be used when SchemaTex output is required.

To roll back:

1. stop 0.9.1 processes;
2. deploy the complete immutable 0.9.0 package;
3. preserve queued jobs and generated artifacts;
4. treat SchemaTex jobs as unsupported until 0.9.1 is restored.

No data migration reversal is required.
