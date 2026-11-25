# Dotnet Sdk

**Category:** Clients  
**Status:** implemented

## Purpose

Typed .NET API client.

## Ownership

- Implementation: `services/rune/sdk/dotnet/Rune.Client/RuneApiClient.cs`
- Validation: `services/rune/tools/Rune.Validation/Program.cs`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
