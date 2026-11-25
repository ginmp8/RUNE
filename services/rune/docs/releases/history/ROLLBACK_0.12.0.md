# RUNE 0.12.0 Rollback

Rollback target: RUNE 0.11.0.

Replace the complete 0.12.0 deployment with the immutable 0.11.0 artifact. Do not overlay source trees.

Before rollback, stop or translate requests using:

- artifact comparison;
- composite source input;
- physical-page, range, named-section, or parity decoration rules;
- partials, raw interpolation, helper allowlists, or regional template formatting;
- font license, glyph, required-character, or automatic unicode-range fields;
- cache invalidation tokens, quotas, or shared-filesystem lock settings;
- shared-storage transaction fields in multi-output manifests.

Completed artifacts remain readable under their retention policy. Derived cache entries and abandoned staging directories may be removed after all 0.12.0 workers are stopped.
