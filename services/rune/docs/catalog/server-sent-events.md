# Server Sent Events

**Category:** API  
**Status:** implemented

## Purpose

SSE status and progress stream for render jobs.

## Ownership

- Implementation: `services/rune/apps/rune-api/Program.cs`
- Validation: `scripts/smoke.py`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
