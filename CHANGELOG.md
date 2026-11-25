# Changelog

## [Unreleased]

### Security

- update HtmlSanitizer to 9.2.1039 and centrally pin AngleSharp 1.8.2 and System.Security.Cryptography.Pkcs 8.0.2 to address known NuGet advisory failures without suppressing audit diagnostics;

### Fixed

- use Dockerfile-compatible health checks, select the worker runtime build stage, and provide the version required by recovery validation;
- align Studio AppTest and live validation with the six-tab and multi-output editor contract;
- preserve Compose build failure output in multi-node diagnostics;
- provision the non-root NATS account and JetStream storage ownership explicitly;
- run recovery and Studio browser validation through the installed Playwright driver, preserving real DOM/PDF and readiness assertions without Chrome virtual-time CLI hangs;
- support ImageMagick 6 companion tools as well as ImageMagick 7, and keep image raster inputs separate from outputs;
- install and use the standalone librsvg renderer for SVG comparisons on distributions without the optional ImageMagick SVG coder;
- inspect fonts in the actual PDF returned by the API instead of assuming a private storage layout;
- preserve the tagged-PDF fail-closed policy while testing explicit untagged two-pass composition;
- validate official server-rendered SchemaTex SVGs in browser and Studio evidence instead of the removed client runtime;
- make the default volume-keeper runtime non-root and document explicit ownership maintenance for existing volumes;
- execute every discovered native PDF test in a separate verified testhost process due to the previously documented aggregate native crash.

## [0.18.0] - 2026-07-28

### Added

- completed the nine pre-1.0 feature-development gaps for page decorations, official SchemaTex, PDF import, deterministic typography, typed templates, render caching, artifact comparison, composite assembly, and atomic multi-output;
- added five public schemas for comparison jobs, artifact-set manifests, assembly manifests, decoration plans, and template expansion metadata;
- added asynchronous comparison lifecycle, artifact-set/package endpoints, Studio authoring/review surfaces, repeated CLI output flags, and synchronized .NET/Python/TypeScript SDK contracts.

### Changed

- official SchemaTex 1.0.1 bytes and exports replace the private runtime path;
- encrypted/permission-restricted PDFs are rejected and password input is removed;
- artifact comparison is artifact-addressed and asynchronous;
- `outputFormat` and `outputFormats` are mutually exclusive;
- strict typed templates, deterministic font fallback, fail-closed preservation, and fingerprint v3 are the stable defaults.

### Validation status

- Release build passed with 0 warnings and 0 errors;
- 139 .NET tests passed; 56 Python/Studio/tool tests passed and 1 environment-specific AppTest was skipped;
- TypeScript typecheck, 17 schemas/examples, 91-feature catalog, and 38/38 reference mappings passed;
- Docker/Compose, full container multi-node/load/soak, current complete advisory coverage, signing, production rollout, and independent PDF/A validation for every new path remain unexecuted.

## [0.17.1] - 2026-07-28

### Fixed

- native-PDF policy failures now return HTTP 400 with their stable RUNE domain code instead of a generic HTTP 500 `internal-error`;
- release documentation and capability reporting are synchronized with the integrated 91-feature implementation.

### Added

- deterministic per-scenario native PDF evidence for native PDF/PDF-A, form and object-stream fallback, JavaScript removal, and signature rejection;
- retained independent veraPDF 1.30.2 reports for ordinary and native-composite PDF/A-2b artifacts.

### Validation status

- aggregate .NET tests passed: 132 passed, 0 failed, 0 skipped;
- 18 explicit real-Chromium tests passed;
- the public eight-format API matrix, distributed pipeline, NATS restart/duplicate/Worker-crash recovery, durable dispatch outage, dead-letter/replay, advanced API, and native PDF scenarios passed;
- ordinary and native-composite PDF/A-2b artifacts passed independent veraPDF validation;
- Docker/Compose, final load/soak, current advisory coverage, signing, and production rollout remain explicitly unexecuted.

## [0.17.0] - 2026-07-28

### Added

- integrated RUNE 0.15.0 distributed resilience and RUNE 0.16.0 native PDF page import into one release line;
- durable command outbox with deterministic IDs, publisher leases/fencing, bounded publish timeout, and background reconciliation;
- explicit dead-letter state, terminal event/subject, terminate reason, listing API, and new-generation replay API;
- W3C trace propagation plus stable `Rune` ActivitySource/Meter instrumentation boundary;
- dispatch success/failure and dead-letter Prometheus metrics;
- executable dispatch-outage, dead-letter/replay, Worker-crash, and native-PDF pipeline verifiers.

### Fixed

- accepted jobs can recover when the API cannot publish to NATS after persistence;
- broker publication no longer keeps the HTTP request open indefinitely during an outage;
- exhausted or non-retryable commands now have an observable terminal path instead of an implicit terminal acknowledgement;
- stale job/cache/publisher owners cannot publish after a replacement owner acquires a higher fencing token.

### Validation status

- offline restore and 32-project Release build passed with 0 warnings and 0 errors;
- 134 .NET tests passed through project/class-isolated execution;
- live NATS 2.14.3, all eight distributed output formats, SchemaTex, restart persistence, duplicate suppression, Worker crash recovery, outbox outage recovery, dead-letter/replay, metrics, and real native PDF/PDF-A composition passed;
- Docker/Compose, long soak, signing, production exporter, and independent native-composite PDF/A conformance remain explicitly unexecuted.

## [0.16.0] - 2026-07-27

### Added

- policy-controlled `native-page` PDF import for PDF parts in composite PDF and PDF/A jobs;
- deterministic Chromium placeholder mapping followed by PDFsharp page-graph replacement;
- preservation of supported page resources, selectable text, fonts, vectors, images, transparency, dimensions, rotation, page boxes, and safe URI links;
- explicit signature, form, annotation, JavaScript, and fallback policies;
- `pdf-import-manifest.json`, its public schema, and the internal native import plan schema;
- retained native PDF corpus covering subset fonts, Type 3 fonts, transparency, alpha images, vectors, mixed geometry, links, forms, signatures, annotations, attachments, JavaScript, object streams, and multiple producers.

### Changed

- composite PDF documentation and API capability discovery now distinguish visual/semantic conversion from native final-PDF composition;
- direct PDF-to-HTML requests for `native-page` report explicit visual fallback instead of claiming native output;
- object streams are conservatively routed to visual fallback with reason `unsupported-object-stream` to isolate unsupported in-process parser structures;
- source annotations and page additional actions are removed before approved URI links are reconstructed.

### Validation status

- offline .NET restore completed from the shared Library package mirror;
- Release build completed with 0 warnings and 0 errors;
- 123 .NET tests passed, including corpus policy/fallback and native page composition tests;
- schema, feature-catalog, workspace, TypeScript, and Python validation results are recorded in `VALIDATION.md`;
- complete API -> queue -> Worker -> real Chromium native-composite qualification remains required before functional promotion.

## [0.14.0] - 2026-07-27

### Added

- deployable Docker Compose topology for Studio, API, NATS with file-backed JetStream, Worker, shared artifact storage, and shared render cache;
- non-root runtime users, deterministic temporary directories, shared-volume ownership initialization, health/readiness checks, stop signals, and bounded graceful-shutdown windows;
- `scripts/verify_compose_pipeline.py`, which proves queued-before-worker behavior, JetStream persistence across NATS restart, Worker crash recovery, duplicate-message suppression, semantic idempotency, and artifact retrieval;
- deployed validation for SchemaTex, static HTML, PDF, PDF/A, PNG, headers, footers, composites, and system fonts without native PDF import.

### Changed

- Compose now explicitly selects `RUNE_DISPATCH_PROVIDER=nats`; the previous configuration could supply a NATS URL while still using the local dispatcher;
- NATS acknowledgement wait, negative-acknowledgement delay, and job lease duration are configurable for deterministic recovery tests while preserving existing defaults outside Compose;
- API and Worker use separate shared `/data` and `/cache` volumes, and all product containers use writable bounded `/tmp/rune` mounts.

### Validation status

- offline restore of 32 projects, Release build with 0 warnings and 0 errors, 116 .NET tests, 17 explicit real-Chromium tests, 55 passed Python tests, TypeScript contract validation, and 11 internal checks passed;
- real local-process Studio-client -> API -> NATS/JetStream -> Worker execution passed for all 8 selected formats;
- NATS restart persistence, semantic and broker duplicate handling, Worker SIGKILL recovery, headers, footers, composites, system fonts, and graceful process shutdown passed;
- Docker image build, Compose startup, container identities, named volumes, health transitions, and the actual Streamlit service were not executable because no Docker runtime was available;
- RUNE 0.14.0 must not replace `latestFunctional` until the complete Compose verifier passes on a Docker-capable Linux x64 host.

## [0.13.1] - 2026-07-27

### Fixed

- composite parts no longer repeat a leading `h1` when `includePartTitles=true` and the first content heading is equal to the part name;
- BGRA page rasters produced by PDFium are composited against white before BMP encoding, preventing black backgrounds or borders in visual PDF imports;
- advanced pixel-diff artifacts use a readable right-page overlay instead of the raw ImageMagick error-style raster.

### Tests

- added duplicate-part-title regression coverage;
- added white-background PDF raster regression coverage;
- added changed multipage PDF diff-image regression coverage;
- aggregate .NET test count increased from 114 to 116.

## [0.13.0] - 2026-07-27

See [IMPLEMENTATION_REPORT_0.13.0.md](services/rune/docs/releases/history/IMPLEMENTATION_REPORT_0.13.0.md) for the complete 0.13.0 capability release.
