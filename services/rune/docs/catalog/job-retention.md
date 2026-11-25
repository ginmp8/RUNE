# Job Retention

**Category:** Jobs  
**Status:** implemented

## Purpose

Configurable cleanup of completed jobs and artifacts.

## Ownership

- Implementation: `services/rune/apps/rune-worker/Program.cs`
- Validation: `services/rune/tools/Rune.Validation/Program.cs`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
