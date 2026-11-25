# Attributes And Html

**Category:** HTML and media  
**Status:** implemented

## Purpose

Heading attributes and sanitized semantic HTML, including picture/source, progress/meter, ruby, samp, var, safe styles, and removal of active attributes.

## Ownership

- Implementation: `services/rune/src/engine/Rune.Markdown/MarkdownDocumentCompiler.cs`
- Validation: `services/rune/tests/Rune.Engine.Tests/CompatibilityTests.cs`
- Minor compatibility validation: `services/rune/tests/Rune.Engine.Tests/ReferenceMinorCompatibilityTests.cs`
- Compatibility case: `attributes-and-html`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
