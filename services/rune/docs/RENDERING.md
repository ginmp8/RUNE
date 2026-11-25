# Rendering

## Inputs

- Markdown with Markdig syntax and RUNE compatibility normalization.
- Safe HTML sanitized before rendering.
- Trusted HTML for controlled producers, including controlled head content and custom readiness.
- Local resources supplied by confined relative paths and embedded as data URIs.
- Versioned structured document JSON.

## Markdown compatibility

The mapped reference suite covers structure, formatting, emoji, links, media, lists, quotes, code, tables, footnotes, abbreviations, front matter, cover metadata, TOC, numbering, includes, callouts, tabs, attributes, conditional content, page breaks, GitHub, MkDocs, Pandoc and Obsidian syntax, data tables, math, diagrams, charts, maps, STL, and accessibility behavior.

Includes support nested relative paths and optional line, heading, or block selectors. Absolute paths, traversal, cycles, excessive depth, and excessive content are rejected.

## Browser renderers

Docker builds install pinned offline assets for Mermaid, KaTeX, and SchemaTex. Ownership, map, chart, STL, and React Flow renderers are distributed RUNE assets.

The embedded React Flow path intentionally uses the deterministic SVG renderer recovered by Markdown PDF Studio 1.8.7. The separate typed React model remains a design/reference surface only; it is not proof that the embedded preview/PDF path should execute an unverified UMD chain.

Unsupported DSLs remain visible as source instead of being silently discarded.

## Readiness

The browser worker waits for:

- renderer completion;
- trusted readiness when supplied;
- fonts and images;
- DOM quietness;
- stable dimensions;
- a second readiness assertion after print media is enabled.

Timeout is a failed render. External network access is blocked by default.

## Recovery gates

- `verify_recovery_runtime.py` executes the exact local React Flow renderer against all three recovery examples and validates diagram, SVG, node, edge, and marker counts before creating a real PDF.
- `verify_studio_pipeline.py` sends the examples through the RUNE API, then validates the resulting HTML and PDF through Chromium.
- the worker Docker build runs the local renderer recovery gate before producing a runtime image.

## Outputs

- Interactive HTML preserves browser behavior.
- Static HTML materializes canvases and removes scripts and event-handler attributes.
- PDF uses Chromium print output.
- PDF/A performs Ghostscript conversion with explicit sRGB output intent.
- PNG and JPEG are full-page screenshots.
- SVG returns the primary rendered SVG when one unambiguous visual exists.
- Structured JSON contains semantic document nodes, metadata, diagnostics, and required renderers.

## Native PDF pages

A `native-page` PDF part is not rendered by Chromium. Chromium renders a deterministic marker page with the source page dimensions so pagination remains stable. After the marker-to-page map is extracted, PDFsharp replaces the placeholder with the original source page graph. Page annotations and `/AA` actions are removed before safe web links are reconstructed. Page decorations and optional PDF/A conversion run after replacement.
