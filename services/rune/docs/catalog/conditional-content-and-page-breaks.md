# Conditional Content And Page Breaks

**Category:** Document layout  
**Status:** implemented

## Purpose

PDF-only/HTML-only sections and explicit page breaks.

## Ownership

- Implementation: `services/rune/src/engine/Rune.Markdown/MarkdownDocumentCompiler.cs`
- Validation: `services/rune/tests/Rune.Engine.Tests/CompatibilityTests.cs`
- Compatibility case: `conditional-content-and-page-breaks`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
