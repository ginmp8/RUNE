# Alerts And Callouts

**Category:** Compatibility  
**Status:** implemented

## Purpose

GitHub alerts, Obsidian callouts and MkDocs admonitions.

## Ownership

- Implementation: `services/rune/src/engine/Rune.Markdown/MarkdownDocumentCompiler.cs`
- Validation: `services/rune/tests/Rune.Engine.Tests/CompatibilityTests.cs`
- Compatibility case: `alerts-and-callouts`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
