# Html Input

**Category:** HTML and media  
**Status:** implemented

## Purpose

Safe and trusted full-document or fragment HTML input.

## Ownership

- Implementation: `services/rune/src/engine/Rune.Html/HtmlDocumentCompiler.cs`
- Validation: `services/rune/tests/Rune.Engine.Tests/EngineTests.cs`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
