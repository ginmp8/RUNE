# Accessibility

**Category:** Accessibility  
**Status:** implemented

## Purpose

Document language, semantic markup, tagged Chromium PDF output, outlines, and optional DOM-to-physical-page structure maps.

## Ownership

- Implementation: `services/rune/src/engine/Rune.Browser/PlaywrightRenderService.cs`
- Publication: `services/rune/src/application/Rune.RenderProcessing/RenderJobProcessor.cs`
- Validation: `services/rune/tests/Rune.Engine.Tests/CompatibilityTests.cs`
- Browser validation: `services/rune/tests/Rune.Browser.Tests/TaggedPdfStructureMapTests.cs`
- Compatibility case: `accessibility`

## Contract

The browser export path enables tagged PDF output where supported by Chromium. When `emitStructureMap` is enabled for PDF or PDF/A, RUNE places temporary markers beside semantic sections and headings after renderer readiness, prints a mapping PDF, extracts the markers from physical pages, removes them, and prints the final clean PDF. The resulting `structure-map.json` is published as a companion artifact.

The map is deterministic for the measured layout and supports audit and downstream navigation. It is not a replacement for validating the complete internal PDF structure tree with an independent accessibility conformance tool.
