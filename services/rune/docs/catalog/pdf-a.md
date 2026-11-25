# Pdf A

**Category:** Outputs  
**Status:** implemented

## Purpose

PDF/A-1b, PDF/A-2b and PDF/A-3b conversion through Ghostscript.

## Ownership

- Implementation: `services/rune/src/engine/Rune.Export.Pdf/PdfAConverter.cs`
- Validation: `services/rune/tools/Rune.Validation/Program.cs`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
