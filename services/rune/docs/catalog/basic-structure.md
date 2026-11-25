# Basic Structure

**Category:** Markdown  
**Status:** implemented

## Purpose

Common document structure, headings, paragraphs, hard line breaks and thematic breaks.

## Ownership

- Implementation: `services/rune/src/engine/Rune.Markdown/MarkdownDocumentCompiler.cs`
- Validation: `services/rune/tests/Rune.Engine.Tests/CompatibilityTests.cs`
- Compatibility case: `basic-structure`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
