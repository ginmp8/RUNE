# Svg Output

**Category:** Outputs  
**Status:** implemented

## Purpose

SVG extraction or full-document foreignObject snapshot.

## Ownership

- Implementation: `services/rune/src/engine/Rune.Browser/PlaywrightRenderService.cs`
- Validation: `scripts/smoke.py`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
