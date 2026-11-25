# RUNE 0.18.0 Implementation Report

## Scope

Implemented all feature-development items MF-001 through MF-009 from `MISSING_FEATURES_FOR_1.0.0.md` against immutable RUNE 0.17.1, preserving the unified workspace version and release structure.

## Implemented capabilities

1. contract-grade page-decoration normalization, selection, overflow protection, provenance, and two-pass PDF overlay;
2. official SchemaTex 1.0.1 package integration with integrity and no-network execution;
3. asynchronous visual, semantic, and region-level hybrid PDF-to-HTML with deterministic reports and encrypted-input rejection;
4. deterministic custom-font resolution, fallback, glyph, embed, subset, readiness, and discovery contracts;
5. strict typed templates with contextual escaping, trusted insertion, bounded evaluation, and one expansion identity;
6. content-addressed distributed caching with fingerprint v3, reauthorization, encryption, fencing, quarantine, and refresh preservation;
7. persistent asynchronous artifact comparison jobs and atomically published reports;
8. logical/rendered/hybrid/auto composite assembly with preservation decisions and assembly manifests;
9. canonical atomic multi-output sets with progress, manifest, package, endpoints, CLI, Studio, and SDK parity.

## Public contract changes

- synchronous comparison removed in favor of `/v1/comparisons`;
- encrypted PDF password input removed;
- `outputFormat` and `outputFormats` made mutually exclusive;
- strict template evaluation is the stable default;
- sensitive cache entries require configured encryption.

## Evidence

The complete local validation record is in `VALIDATION.md`. Contract migration is in `MIGRATION_0.18.0.md`; operational rollback and recovery are in `ROLLBACK_0.18.0.md` and `RECOVERY_0.18.0.md`.

## Release boundary

The source implementation backlog is closed for this release. Environment-specific operational, security, capacity, signing, independent PDF/A, and production-promotion gates remain explicit and prevent a 1.0 release-candidate claim.
