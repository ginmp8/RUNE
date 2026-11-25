# RUNE 0.13.0 Recovery

RUNE 0.13.0 is derived from the qualified immutable 0.12.0 archive and preserves the persisted job-state contract while extending optional render and comparison behavior.

Recovery sequence:

1. restore the complete immutable 0.13.0 package;
2. verify the external ZIP checksum and internal `MANIFEST.sha256`;
3. restore with .NET SDK 10.0.302 and the exact package sources;
4. verify ImageMagick, Poppler, Tesseract, Python, FontTools, Brotli/WOFF2 support, Chromium, Ghostscript, and ICC paths required by the selected gates;
5. run workspace, schema, feature-catalog, reference, build, and automated tests;
6. run real Chromium tagged-PDF and dedicated SchemaTex tests;
7. generate all selected formats through the public API and inspect the companion `structure-map.json` artifact;
8. exercise advanced comparison across a multipage PDF and preserve the response and diff artifact;
9. probe shared-cache filesystem semantics before enabling cross-node use;
10. quarantine, rather than overwrite, invalid font or render cache entries.

Never overlay source onto a published release. Restore the whole package, roll back to 0.12.0, or roll forward with a new version.
