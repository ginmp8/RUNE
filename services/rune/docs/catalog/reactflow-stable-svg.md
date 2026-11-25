# React Flow Stable SVG Renderer

**Category:** Renderers  
**Status:** implemented

## Purpose

RUNE uses a local deterministic SVG renderer for embedded preview, static HTML, PDF, and image exports. This is the recovered stable path from Markdown PDF Studio 1.8.7; it has no React, React DOM, D3, or XYFlow runtime dependency.

## Contracts

- safe JSON parser with schema migration and bounded limits;
- declarative nodes, edges, handles, parents, modes, and layouts;
- textual fallback and structured diagnostics;
- one marker namespace per diagram (`rf-arrow-0`, `rf-arrow-1`, ...);
- three recovery examples totaling 72 nodes and 82 edges;
- real Chromium and PDF fail-closed gates.

## Ownership

- Parser: `services/rune/src/engine/Rune.ReactFlow/ReactFlowDocumentParser.cs`
- Renderer: `services/rune/assets/reactflow/reactflow-renderer.js`
- Styling: `services/rune/assets/reactflow/reactflow.css`
- Validation: `services/rune/tools/Rune.Validation/Program.cs`, `scripts/verify_recovery_runtime.py`
- Compatibility case: `reactflow-stable-svg`

The separate React frontend ecosystem may consume the same schema, but it is not the embedded Studio/PDF runtime.
