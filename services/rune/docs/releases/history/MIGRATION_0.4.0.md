# Migration to RUNE 0.4.0

## Scope

This migration replaces the embedded React Flow runtime while retaining the existing HTTP, event, schema, output, and render-job contract majors.

## Upgrade procedure

1. Preserve the current 0.3.0 package, image digests, configuration, and job-volume snapshot.
2. Extract `RUNE-0.4.0.zip` into a clean directory.
3. Verify `RUNE-0.4.0.sha256` and the packaged `MANIFEST.sha256`.
4. Build new immutable API, worker, and Studio images.
5. Run workspace, package-free .NET, Python, TypeScript, and schema validation.
6. Start NATS, API, worker, and Studio in an isolated environment.
7. Run the exact recovery renderer gate and complete Studio pipeline gate.
8. Validate representative Markdown, HTML, ownership, Mermaid, KaTeX, SchemaTex, PDF, PDF/A, image, SVG, and structured JSON flows applicable to the deployment.
9. Promote the same validated image digests.

## React Flow migration

### Supported embedded behavior

- declarative JSON document;
- normalized schema and legacy `elements` migration;
- deterministic SVG output;
- stable diagram enumeration;
- unique SVG arrow markers;
- built-in node and edge types;
- safe textual fallback and diagnostics;
- identical local renderer for Studio preview and browser export.

### Removed embedded behavior

The self-contained document path no longer promises:

- drag or editing;
- callback execution;
- arbitrary React components;
- remote plugins or imports;
- React Flow provider state;
- runtime minimap or control widgets;
- the withdrawn React/UMD bootstrap.

A product that needs an interactive editor should host it as a separate trusted application and persist only declarative graph JSON for RUNE rendering.

## Stored jobs

RUNE 0.4.0 does not introduce a new job schema major. Existing completed artifacts remain immutable. For queued React Flow jobs created by 0.3.0, prefer cancellation and recreation under 0.4.0 so the package is compiled with the recovered renderer contract.

## Configuration

No new mandatory environment variable is introduced. Docker validation requires Chromium and the pinned renderer assets already included in the source package or installed by the image build.
