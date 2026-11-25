# Download Flow

**Category:** Studio  
**Status:** implemented

## Purpose

Fingerprint-aware preview and reusable export downloads in RUNE Studio.

## Ownership

- Implementation: `services/rune/apps/rune-studio/app.py`
- Validation: `services/rune/tests/Rune.Engine.Tests/CompatibilityTests.cs`
- Compatibility case: `download-flow`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
