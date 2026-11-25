# Lists

**Category:** Markdown  
**Status:** implemented

## Purpose

Nested, ordered, task, definition, and FancyList markers including parenthesized numbers, letters, Roman numerals, and automatic `#.` numbering.

## Ownership

- Implementation: `services/rune/src/engine/Rune.Markdown/MarkdownDocumentCompiler.cs`
- Validation: `services/rune/tests/Rune.Engine.Tests/CompatibilityTests.cs`
- Minor compatibility validation: `services/rune/tests/Rune.Engine.Tests/ReferenceMinorCompatibilityTests.cs`
- Compatibility case: `lists`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
