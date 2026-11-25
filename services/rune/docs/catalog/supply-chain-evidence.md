# Supply Chain Evidence

RUNE provides deterministic release tooling for:

- CycloneDX 1.6 SBOM generation across NuGet, Python, and bundled JavaScript dependencies;
- fail-closed offline vulnerability matching against a pinned advisory snapshot;
- detached Ed25519 artifact signatures and verification through OpenSSL;
- in-toto Statement v1 / SLSA provenance bound to SHA-256 subjects and materials.

An absent or incomplete advisory snapshot produces a blocked report, never a clean vulnerability claim. Private signing keys are never packaged.
