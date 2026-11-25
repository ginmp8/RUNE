# Native PDF Page Import

## Status

Implemented as a bounded capability in RUNE 0.16.0 and integrated with distributed resilience, durable dispatch, dead-letter/replay, and tracing in RUNE 0.17.0; RUNE 0.17.1 corrected policy-error HTTP semantics; RUNE 0.18.0 preserves native import while enforcing the stable rejection contract for encrypted input and integrating final assembly manifests.

## Purpose

`pdfImport.mode = "native-page"` imports supported PDF pages into composite PDF or PDF/A output without converting the original page content graph to HTML or a raster image. The feature is a page-composition capability, not a general PDF editor.

For supported inputs, RUNE preserves the imported page content streams and resources, including selectable text, embedded fonts, vectors, images, transparency, original page dimensions, rotation, and the declared `MediaBox`, `CropBox`, `TrimBox`, and `BleedBox`. Safe absolute `http`, `https`, and `mailto` links can be reconstructed after all source annotations are removed.

## Request

```json
{
  "sourceType": "composite",
  "outputFormat": "pdf",
  "composite": {
    "parts": [
      {
        "name": "Imported appendix",
        "sourceType": "pdf",
        "resourcePath": "parts/appendix.pdf",
        "pdfImport": {
          "mode": "native-page",
          "signatures": "reject",
          "forms": "flatten",
          "annotations": {
            "links": "preserve",
            "comments": "flatten",
            "attachments": "reject"
          },
          "javascript": "remove",
          "fallback": "visual"
        }
      }
    ]
  }
}
```

Native page composition is supported only when one PDF or PDF/A artifact is requested. HTML, JSON, image, SVG, interactive HTML, and multi-output jobs use the visual fallback when allowed or fail when `fallback = "reject"`.

## Processing model

1. RUNE validates the PDF signature, size, page count, password, parser support, and policy-sensitive objects.
2. Each supported source page is represented by a deterministic exact-size print placeholder during Chromium pagination.
3. Chromium produces the surrounding document and resolves the final physical page positions.
4. RUNE replaces each placeholder page with the source page object graph through PDFsharp import mode.
5. Source annotations and page additional actions are removed.
6. Only approved simple URI links are reconstructed.
7. `pdf-import-manifest.json` records requested mode, applied mode, fallback reason, detected policy-sensitive features, page geometry, output page, preserved link count, and warnings.

This design preserves the source page while allowing Markdown, HTML, template, and other composite parts to remain browser-rendered.

## Policies

### Signatures

- `reject`: fail with `pdf-signature-rejected`.
- `flatten`: use visual fallback; no legal validity is preserved.
- `ignore`: import page appearance while removing signature annotations. This is opt-in and never claims signature validity.

### Forms

- `flatten`: use visual fallback.
- `reject`: fail with `pdf-form-rejected`.

Editable form fields are never preserved.

### Annotations

- links: `preserve` or `remove`;
- comments: `flatten`, `reject`, or `remove`;
- attachments: `reject` or `remove`.

All original annotations are removed before approved links are rebuilt. Internal destinations, actions, unsafe URI schemes, comments, embedded files, and unsupported annotation types are not preserved natively.

### JavaScript

- `remove`: document and page actions are not copied; page `/AA` entries and source annotations are removed;
- `reject`: fail with `pdf-javascript-rejected` when JavaScript is detected.

### Fallback

- `visual`: supported policy flattening or unsupported native structures produce the existing PDFium visual import;
- `reject`: fail with `pdf-native-fallback-rejected` or `pdf-native-unsupported`.

The manifest makes fallback observable:

```json
{
  "requestedMode": "native-page",
  "appliedMode": "visual",
  "fallbackReason": "unsupported-pdf-structure"
}
```

## Supported and excluded scope

The initial scope preserves page appearance and simple links. It does not preserve legal signature validity, editable forms, portfolios, embedded files, JavaScript, every original tag, incremental-update history, document-level navigation structures, arbitrary actions, or universal canonicalization.

PDF/A output is generated after native composition. Importing a page does not prove that the source or result conforms to PDF/A; independent veraPDF validation remains required for conformance claims.

## Evidence and promotion gate

Unit and component tests validate policy decisions, page boxes, rotation, link filtering, fallback reporting, and object-preserving page replacement. Promotion requires a Docker-capable or equivalent supported environment to execute the complete API -> Worker -> real Chromium path against the retained corpus, plus advanced external producer fixtures, pixel/text/font/link comparisons, and PDF/A validation when applicable.
