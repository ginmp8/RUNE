# Job Idempotency

**Category:** Jobs  
**Status:** implemented

## Purpose

Atomic idempotent job creation across concurrent API requests.

## Ownership

- Implementation: `services/rune/src/application/Rune.Jobs/RenderJobService.cs`
- Validation: `services/rune/tools/Rune.Validation/Program.cs`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
