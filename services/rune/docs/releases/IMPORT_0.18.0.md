# RUNE 0.18.0 source import

This source-control baseline originates from the immutable RUNE 0.18.0 release archive. It is not a new release, a replacement of the original artifact, a production promotion, or a 1.0 release candidate.

- Original archive: `RUNE-0.18.0.zip`.
- SHA-256: `f24b5d73852d2d8a3ded853ae72b15f8fe9a5420ae375192650163413588737f`.
- Original functional qualification date: 2026-07-28; see the historical [validation report](../../../../VALIDATION.md).
- Product source, contracts, schemas, SDKs, tests, fixtures, and pinned runtime assets retain the original bytes. Repository-specific edits are limited to documentation, source hygiene, and release tooling.

## Source-control policy

- Retain the MIT project license and all upstream notices and licenses. SchemaTex is a separate AGPL-3.0-only component; retain its exact package, source metadata, checksums, and upstream license. License compatibility and distribution obligations are not newly qualified by this import.
- Preserve the exact third-party runtime assets and immutable compatibility reference fixtures. They are required for local/offline execution and reproducible tests.
- Keep migration, recovery, and rollback history under `history/`; retain the current release documents at the repository root.
- Do not commit generated package manifests, tree inventories, SBOMs, historical vulnerability scan output, ZIPs, build products, caches, package feeds, local state, or secrets. Generate release evidence from the exact candidate source and retain it with its separately published archive.
- Source validation is distinct from extracted-release validation. `python3 scripts/validate_workspace.py` validates a checkout; `--release` additionally requires the generated package tree and manifest and rejects local metadata and generated artifacts in the extracted package. The packaging script verifies the manifest before and after extraction.

The historical release evidence is not evidence that a new checkout, container image, or deployment has passed the same gates. Re-run applicable validation before any new release or production promotion.

## Import qualification (2026-11-25)

- The original archive SHA-256 and every entry in its original manifest matched.
- Source workspace, feature catalog (91 features / 38 compatibility cases), schema/examples (17 schemas), reference-equivalence, and resilience-contract checks passed.
- Python SDK, Studio, and tool tests: 56 passed, 1 skipped. TypeScript strict typecheck passed.
- The TypeScript contract test fails in both the original release and imported checkout because it still expects the obsolete `/v1/artifacts/compare` marker. This existing failure is not resolved as part of the source import.
- Source packaging was exercised in a local qualification workspace; all 828 manifest hashes in the 829-entry test archive matched, including preserved bundled assets. Untracked local state was excluded. This test archive is not a published release.
- .NET build/tests, Docker/Compose, live NATS topology, and runtime promotion gates were not re-executed in the import environment.
