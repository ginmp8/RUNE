# RUNE 0.18.0 Migration

## Upgrade order

1. deploy API and Worker from the same verified 0.18.0 archive;
2. update clients to the 0.18.0 schemas/SDKs;
3. migrate comparison calls;
4. remove PDF password handling;
5. correct multi-output request construction;
6. configure cache encryption where sensitive labels are eligible;
7. run one render, one multi-output set, one comparison job, and one PDF import smoke before enabling normal traffic.

## Comparison API

Replace `POST /v1/artifacts/compare` with:

1. `POST /v1/comparisons`;
2. `GET /v1/comparisons/{id}` or `/events`;
3. `GET /v1/comparisons/{id}/report.json` or `/report.html`.

The left/right order participates in identity and idempotency.

## PDF import

Remove password fields and UI prompts. Encrypted or permission-restricted input now fails with the stable rejection contract; decrypt outside RUNE only under an approved security process.

## Multi-output

Use either `outputFormat` for one artifact or `outputFormats` for a canonical set. Download set metadata and packages from the artifact-set endpoints; `/content` is singular-only.

## Cache

Set a base64 or hexadecimal 256-bit `RUNE_CACHE_ENCRYPTION_KEY` before enabling cache writes for sensitive labels. Rotating the key invalidates unreadable encrypted entries; preserve or invalidate the previous cache according to the operational plan.
