# Preview Readiness

**Category:** Rendering  
**Status:** implemented

## Purpose

Shared interactive and export pipeline with fail-closed readiness barriers.

## Ownership

- Implementation: `services/rune/assets/runtime/readiness.js`
- Validation: `services/rune/tests/Rune.Engine.Tests/CompatibilityTests.cs`
- Compatibility case: `preview-readiness`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
