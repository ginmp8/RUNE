# Job Leases

**Category:** Jobs  
**Status:** implemented

## Purpose

Cross-process claims, renewable leases and bounded attempts for multiple workers.

## Ownership

- Implementation: `services/rune/src/application/Rune.Jobs/FileSystemRenderJobStore.cs`
- Validation: `services/rune/tools/Rune.Validation/Program.cs`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
