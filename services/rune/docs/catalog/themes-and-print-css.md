# Themes And Print Css

**Category:** Document layout  
**Status:** implemented

## Purpose

Professional, minimal and dark themes with print behavior.

## Ownership

- Implementation: `services/rune/assets/styles/base.css`
- Validation: `services/rune/tests/Rune.Engine.Tests/CompatibilityTests.cs`
- Compatibility case: `themes-and-print-css`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
