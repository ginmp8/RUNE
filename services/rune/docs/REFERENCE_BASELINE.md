# Reference baseline

## Declared reference

RUNE 0.7.0 inherits the exact Library artifact `Markdown PDF Studio 1.8.7` as its functional reference. The archive was materialized and inspected while preparing this release.

## Recovery lineage

Markdown PDF Studio 1.8.7 is a recovery release based on the functional 1.8.1 line. It withdraws the unproven React/UMD integration from versions 1.8.2 through 1.8.6 and restores the deterministic local SVG renderer used by preview and PDF.

RUNE follows that recovery decision for the embedded path:

- the distributed renderer is `services/rune/assets/reactflow/reactflow-renderer.js`;
- diagrams receive a stable enumeration index;
- SVG markers are unique (`rf-arrow-0`, `rf-arrow-1`, ...);
- preview and browser export consume the same local renderer;
- `@xyflow/react`, `ReactFlowProvider`, and the withdrawn runtime prelude are absent from the embedded document pipeline.

## Evidence retained by RUNE

- exact 1.8.7 feature fixture: `tests/compatibility/reference-feature-cases.1.8.7.json`;
- fixture digest: `3e2ff87fbfc4814b6b502e13e1ce426c342adde4e7fa93e4c0bd9180ee9950e3`;
- mapped executable RUNE fixture: `tests/compatibility/reference-feature-cases.json`;
- three complex React Flow examples with 72 nodes and 82 edges;
- static renderer source and CSS recovered from the reference;
- package-free parser, security, migration, and inventory checks;
- additional minor-syntax regression tests for CriticMarkup, progress bars, FancyLists, smart symbols, `GH-123`, alternate KaTeX delimiters, and semantic safe HTML;
- executed browser recovery tests covering all browser formats, PDF/A, unique React Flow markers, and materialized static HTML.

The exact upstream fixture remains in its original language because it is reference evidence. Project-owned RUNE documentation, code-facing messages, and examples remain English.

## Compatibility claim

RUNE 0.7.0 claims mapped functional coverage and a reference-aligned embedded renderer. It does not claim byte-identical HTML, pixel-identical output, or production readiness for gates that were not executed. See `VALIDATION.md`.
