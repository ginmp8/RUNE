# Github Compatibility

**Category:** Compatibility  
**Status:** implemented

## Purpose

Task lists, alerts, and opt-in `#123`, `GH-123`, and `@user` references.

## Ownership

- Implementation: `services/rune/src/engine/Rune.Markdown/MarkdownDocumentCompiler.cs`
- Validation: `services/rune/tests/Rune.Engine.Tests/CompatibilityTests.cs`
- Minor compatibility validation: `services/rune/tests/Rune.Engine.Tests/ReferenceMinorCompatibilityTests.cs`
- Compatibility case: `github-compatibility`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
