# Structured Json

**Category:** Outputs  
**Status:** implemented

## Purpose

Versioned semantic RUNE document model output.

## Ownership

- Implementation: `services/rune/src/engine/Rune.Core/DocumentModel.cs`
- Validation: `services/rune/tools/Rune.Validation/Program.cs`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
