# Rollback from RUNE 0.16.0

1. Stop accepting new requests with `pdfImport.mode = "native-page"`.
2. Allow or cancel in-flight 0.16.0 jobs according to the existing job policy.
3. Preserve completed artifacts and `pdf-import-manifest.json` for audit and comparison.
4. Deploy the complete immutable RUNE 0.14.0 artifact; do not overlay binaries or source files.
5. Convert remaining native-page requests to `visual`, `semantic`, or `hybrid` before resubmission.
6. Do not route them to RUNE 0.15.0 unless the separate distributed-resilience migration has been assessed.

No database schema migration is introduced by this release. Job packages containing the expanded native import plan are not guaranteed to be consumable by RUNE 0.14.0.
