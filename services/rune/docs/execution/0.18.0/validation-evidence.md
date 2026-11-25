# RUNE 0.18.0 Validation Report

**Date:** 2026-07-28
**Environment:** Debian 13 Linux x64 sandbox
**Baseline:** immutable RUNE 0.17.1 archive
**Verdict:** requested feature implementation and local functional qualification passed; operational promotion and 1.0 release-candidate qualification remain false

## Executed environment

- .NET SDK 10.0.302 with offline NuGet restore from the shared governed mirror;
- Python 3.13.5;
- Node.js 22.16.0 and TypeScript 5.8.3 for strict client typecheck;
- real Chromium-backed browser test project;
- native PDF providers used by the retained PDF test corpus;
- Docker/Compose unavailable.

## Executed checks

| Gate | Result |
|---|---|
| Offline restore | passed; governed shared package mirror only |
| Release build | passed; 0 warnings, 0 errors |
| .NET tests | passed; 139 passed across Engine, Jobs, local dispatch, NATS, Browser, PDF, and internal validation |
| PDF native tests | passed; 17/17 executed individually because the aggregate native testhost terminated |
| Python SDK | passed; 6/6 |
| Studio | passed; 12 passed, 1 exact-runtime AppTest skipped |
| Tool tests | passed; 38/38 |
| TypeScript strict typecheck | passed |
| JSON schemas/examples | passed; 17 schemas |
| Feature catalog | passed; 91 features, 38 compatibility cases |
| Reference equivalence | passed; 38/38 mapped cases |
| Workspace validation | passed after version/document synchronization |
| Package extraction and manifest verification | passed by the final release packaging workflow |

## Feature closure evidence

| Backlog | Implemented result |
|---|---|
| MF-001 | canonical decoration authoring, precedence, selectors, resources, pre-rendering, overflow validation, two-pass composition, provenance, and Studio controls |
| MF-002 | official SchemaTex 1.0.1 bytes, exports, integrity, license/source metadata, no-network adapter, diagnostics, and fail-closed sanitation |
| MF-003 | queued visual/semantic/region-hybrid conversion, OCR provenance, complete report, provider isolation, and encrypted-input rejection |
| MF-004 | deterministic face resolution, explicit policies, fallback pack, glyph/readiness checks, subset/embedding identity, and discovery/client surfaces |
| MF-005 | strict typed binding, contextual escaping, trusted insertion, schema/locale/time-zone/limit semantics, and shared expansion identity |
| MF-006 | fingerprint v3, policy modes, reauthorization, sensitive-entry encryption, fenced distributed filesystem store, quarantine, refresh preservation, and metrics metadata |
| MF-007 | artifact-addressed asynchronous jobs, authorization, profile digest, lifecycle/cancel/retry/SSE, layered comparison, and atomic reports |
| MF-008 | logical/rendered/hybrid/auto modes, typed parts/options, cross-part semantics, preservation decisions, limits, and assembly manifest |
| MF-009 | mutual-exclusion validation, canonical output set, publication options, per-output progress, manifest/endpoints/package, clients, and atomic commit |

## Not executed or not proven

- Docker image construction and Compose startup/health;
- live two-API/two-Worker container topology against JetStream and shared volumes;
- final 100–500-job load, sustained, and multi-hour soak profiles for the new feature set;
- complete vulnerability determination from a current approved advisory source;
- authorized release signing;
- deployed Studio accessibility smoke, production observability, backup/restore/upgrade/rollback rehearsal;
- independent final PDF/A validation for every new decoration, composition, and output-set combination;
- production owner approval and residual-risk acceptance.

## Promotion decision

RUNE 0.18.0 is eligible to become the latest functional implementation release. It must not be relabeled as `1.0.0-rc.1` or `1.0.0`; the remaining work is release qualification, specification-governance convergence, and production promotion evidence.
