# RUNE 0.18.0 Release Notes

**Release date:** 2026-07-28
**Release type:** pre-1.0 capability and contract-convergence release
**Direct baseline:** immutable RUNE 0.17.1
**Functional qualification:** passed for source build and automated local validation
**Operational promotion:** not approved

## Required actions

Before upgrading API, Worker, Studio, CLI, or SDK consumers:

1. replace synchronous `POST /v1/artifacts/compare` calls with the `/v1/comparisons` job lifecycle;
2. stop sending PDF passwords; encrypted or permission-restricted PDFs are now rejected;
3. send exactly one of `outputFormat` or `outputFormats`;
4. configure `RUNE_CACHE_ENCRYPTION_KEY` before caching sensitive security labels;
5. deploy API and Worker from the same complete 0.18.0 artifact because renderer, schema, and fingerprint identities are shared.

## Highlights

- closes the nine feature-development gaps identified against the 1.0 specification: page decorations, official SchemaTex, PDF-to-HTML, deterministic fonts, typed templates, distributed render cache, asynchronous artifact comparison, composite assembly, and atomic multi-output;
- embeds the unmodified official SchemaTex 1.0.1 package with exact integrity, source, license, no-network loading, required-export checks, and fail-closed diagnostics;
- adds strict typed template evaluation and contextual escaping, deterministic fallback typography, canonical page-decoration plans, region-level PDF hybrid reports, and complete assembly/artifact-set manifests;
- introduces persistent artifact-addressed comparison jobs with tenant isolation, cancellation, retry, SSE, and atomic JSON/HTML report publication;
- synchronizes API, schemas, .NET/Python/TypeScript SDKs, CLI, and Studio with the new contracts.

## Breaking changes

### Artifact comparison

Previous behavior accepted arbitrary Base64 artifacts synchronously at `/v1/artifacts/compare`. The endpoint now returns HTTP 410. Create a comparison job, poll or stream its state, then download JSON/HTML reports.

### Encrypted PDFs

Previous implementation accepted a protected PDF when a valid password was supplied. 0.18.0 rejects encrypted and permission-restricted PDFs consistently across API, Studio, CLI, and SDKs.

### Multi-output request shape

`outputFormat` and `outputFormats` are mutually exclusive. Multi-output consumers must use the canonical `outputFormats` set and artifact-set endpoints.

## Validation status

- Release build: 0 warnings, 0 errors;
- .NET tests: 139 passed;
- Python SDK, Studio, and tool tests: 56 passed, 1 environment-specific AppTest skipped;
- TypeScript strict typecheck: passed;
- JSON schemas/examples: 17 passed;
- feature catalog: 91 capabilities and 38 compatibility mappings passed;
- reference equivalence: 38/38 passed.

## Known qualification limits

Docker/Compose, live two-API/two-Worker container qualification, final load/sustained/soak profiles, current complete vulnerability coverage, authorized signing, production rollout/rollback rehearsal, and independent PDF/A qualification for every new decorated/composite/multi-output path were not executed. This release is not `1.0.0-rc.1`.
