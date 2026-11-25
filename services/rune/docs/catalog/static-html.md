# Static Html

**Category:** Outputs  
**Status:** implemented

## Purpose

Browser-materialized static HTML with canvas conversion and script removal.

## Ownership

- Implementation: `services/rune/src/engine/Rune.Browser/PlaywrightRenderService.cs`
- Validation: `services/rune/tests/Rune.Engine.Tests/EngineTests.cs`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
