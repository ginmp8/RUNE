# Migration to RUNE 0.16.0

## Baseline

Upgrade from the complete immutable RUNE 0.14.0 package. RUNE 0.15.0 is a separate distributed-resilience candidate and is not an ancestor of this release.

## Existing consumers

No action is required for requests using `visual`, `semantic`, or `hybrid`. Existing PDF-to-HTML behavior remains supported.

## Enabling native-page

Use `native-page` only for a PDF part inside `sourceType = "composite"` and request one final `pdf` or `pdfA` output. Configure every policy explicitly in production requests. Consume `pdf-import-manifest.json`; do not infer native preservation only from a successful job.

## Contract changes

- `pdf-import-options.v1.schema.json` adds `native-page` and policy fields;
- `render-package.v1.schema.json` adds internal native import plans;
- `pdf-import-manifest.v1.schema.json` is a new side-artifact contract;
- TypeScript composite parts now expose the complete source-type and PDF import contract.

## Operational requirements

The Worker needs the same Chromium runtime as RUNE 0.14.0 and now also uses PDFsharp 6.2.4 for native page composition. The dependency is centrally pinned and included in normal restore/build resolution.
