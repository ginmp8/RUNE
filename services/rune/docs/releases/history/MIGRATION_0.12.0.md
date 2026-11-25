# Migration to RUNE 0.12.0

RUNE 0.12.0 is an additive pre-1.0 capability release. Existing 0.11.0 requests remain valid.

New clients may opt into:

- `POST /v1/artifacts/compare`;
- `sourceType: composite` with ordered `composite.parts`;
- `options.pageDecorations.rules` and `twoPassPdfComposition`;
- font license, glyph-analysis, required-character, and `subsetPolicy=auto` fields;
- template partials, raw interpolation, allowed helpers, and `culture`;
- cache quotas, distributed lock settings, and invalidation tokens;
- multi-output shared-storage transaction fields in result manifests.

No persisted-data migration is required. Shared cache and artifact roots must support coherent file creation, rename, and deletion when used across nodes.
