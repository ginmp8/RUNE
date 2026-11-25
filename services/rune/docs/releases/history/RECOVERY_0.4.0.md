# RUNE 0.4.0 React Flow recovery

## Reference lineage

RUNE 0.4.0 uses the exact Markdown PDF Studio 1.8.7 archive as functional reference. That reference restores the functional 1.8.1 local SVG renderer and withdraws versions 1.8.2 through 1.8.6 from the active React Flow runtime line.

RUNE 0.3.0 implemented a React/UMD embedded path without completed browser evidence in the release environment. RUNE 0.4.0 withdraws that path from embedded Studio and PDF rendering.

## Recovered contract

- one stable diagram index per document;
- `renderDocument(node, diagramIndex)` receives that index;
- SVG markers are unique (`rf-arrow-0`, `rf-arrow-1`, ...);
- all valid diagrams complete the global readiness barrier;
- Studio preview and exported PDF use the same distributed local renderer;
- no network, callbacks, imports, JSX, or remote components are required.

## Recovery fixtures

The three reference-aligned examples contain:

- 3 React Flow documents;
- 72 nodes;
- 82 edges;
- node types `service`, `database`, `queue`, `decision`, and `risk`.

They are stored under `services/rune/examples/reactflow` and are selectable in RUNE Studio.

## Mandatory gates

### Static and package-free

- withdrawn runtime assets and strings are absent;
- parser security and legacy migration checks pass;
- fixture inventory equals 3/72/82;
- all 38 exact reference cases map to project-owned RUNE cases;
- JavaScript syntax and workspace validation pass.

### Browser and PDF

`verify_recovery_runtime.py` must execute the exact packaged CSS/JavaScript in Chromium and verify:

- 3 ready diagrams;
- 3 SVGs;
- 72 rendered nodes;
- 82 rendered edges;
- marker identifiers `rf-arrow-0`, `rf-arrow-1`, and `rf-arrow-2`;
- a generated PDF beginning with a valid PDF header.

`verify_studio_pipeline.py` must send the combined fixture through the RUNE API and repeat the browser and PDF assertions against the returned HTML.

A release environment that cannot execute these gates must record them as not executed and must not claim browser/PDF recovery evidence.

## Withdrawn components

The following are forbidden in the embedded runtime:

- `runtime-prelude.js`;
- `@xyflow/react`;
- `ReactFlowProvider`;
- ReactDOM root bootstrap;
- downloader constants or installers for the withdrawn XYFlow asset set.
