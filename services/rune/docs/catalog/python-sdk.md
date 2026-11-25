# Python Sdk

**Category:** Clients  
**Status:** implemented

## Purpose

Python API client with polling and SSE.

## Ownership

- Implementation: `services/rune/sdk/python/rune_client/client.py`
- Validation: `services/rune/sdk/python/tests/test_client.py`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
