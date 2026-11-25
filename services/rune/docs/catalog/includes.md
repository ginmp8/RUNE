# Includes

**Category:** Resources  
**Status:** implemented

## Purpose

Nested local includes with line, heading and block selectors.

## Ownership

- Implementation: `services/rune/src/engine/Rune.Markdown/MarkdownDocumentCompiler.cs`
- Validation: `services/rune/tests/Rune.Engine.Tests/CompatibilityTests.cs`
- Compatibility case: `includes`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
