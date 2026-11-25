# Implementation ADR: Official Renderer And Persistent Comparison Jobs

**Status:** accepted for RUNE 0.18.0

## Context

The planned 1.0 contract required official SchemaTex APIs and a heavy asynchronous artifact comparison boundary. RUNE 0.17.1 used a private renderer path and synchronous Base64 comparison.

## Decision

Distribute official SchemaTex 1.0.1 bytes with integrity/license/source metadata and call `renderResult` in a restricted local Node.js process. Persist comparison jobs and reports under the normal RUNE authorization, lifecycle, idempotency, cancellation, retry, retention, and atomic-publication model.

## Alternatives considered

- keep the private renderer translation: rejected because it diverges from upstream DSL and exports;
- execute SchemaTex inside every Chromium page: rejected because it duplicates work and weakens isolation;
- retain synchronous comparison for compatibility: rejected because heavy raster/OCR/PDF comparison requires lifecycle and resource controls.

## Consequences

Node.js becomes an explicit API/Worker runtime requirement for SchemaTex. Comparison consumers must migrate. Reports and renderer identities become auditable and cache/provenance-compatible.

## Evidence

Build, targeted renderer/comparison tests, schema/client validation, source-package hashes, and full local regression recorded in `validation-evidence.md`.

## Scope guard

This decision does not approve commercial use of AGPL code, production promotion, or 1.0 release status. Specification status synchronization remains an external governance task.
