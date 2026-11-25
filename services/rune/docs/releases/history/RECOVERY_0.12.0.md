# RUNE 0.12.0 Recovery

RUNE 0.12.0 is derived from the qualified 0.11.0 archive and preserves the persisted job-state contract while extending render packages and artifact-set publication.

Recovery sequence:

1. restore the complete immutable 0.12.0 package;
2. verify the external ZIP checksum and internal `MANIFEST.sha256`;
3. restore with .NET SDK 10.0.302 and exact package sources;
4. run workspace, schema, feature-catalog, reference, build, and automated tests;
5. run real Chromium two-pass and SchemaTex tests;
6. run local and NATS/JetStream API evidence when those paths are enabled;
7. inspect `artifact-set/commit.json` before treating a shared-storage set as published;
8. remove only stale lock files that exceed the configured stale-lock threshold and only after confirming no live owner;
9. quarantine or remove cache entries that fail digest validation.

Never overlay source onto a published release. Restore the whole package or roll forward with a new version.
