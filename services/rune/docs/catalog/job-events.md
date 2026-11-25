# Job Events

**Category:** Messaging  
**Status:** implemented

## Purpose

Versioned requested, started, progressed, completed, failed and cancelled events.

## Ownership

- Implementation: `services/rune/src/contracts/Rune.Event.Contracts/EventContracts.cs`
- Validation: `messaging/nats/tests/Rune.Messaging.Nats.Tests/NatsContractTests.cs`

## Contract

This capability uses the same compiled HTML and readiness pipeline for interactive preview and browser exports when applicable. Failures are returned as diagnostics or job failure state instead of silently producing a partial artifact.
