# Migration to RUNE 0.11.0

RUNE 0.11.0 is a compatible pre-1.0 capability release. Existing `0.10.0` requests remain valid.

New clients may opt into:

- `sourceType: template` with `template` options and JSON resources;
- `options.fonts` for deterministic resource-backed font faces;
- `options.cachePolicy` for eligible browser-render caching;
- structured page-decoration regions and Markdown fences;
- `outputFormats` for one atomic multi-output job.

No data migration is required. Operators using cache must provide writable capacity below `RUNE_RENDER_CACHE_ROOT` or the data-root cache directory.
