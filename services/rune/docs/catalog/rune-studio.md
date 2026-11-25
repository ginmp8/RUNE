# Rune Studio

**Category:** Studio  
**Status:** implemented

## Purpose

Markdown/HTML editor, preview, diagnostics, exports, job management and documentation.

## Ownership

- Implementation: `services/rune/apps/rune-studio/app.py`
- Validation: `services/rune/apps/rune-studio/tests/test_client_contract.py`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
