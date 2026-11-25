# Release process

1. Freeze scope and classify public-contract impact.
2. Update root `VERSION`; synchronize build props, application metadata, schemas, catalog, changelog, release notes, migration, rollback, and validation.
3. Run `./scripts/test.sh` on a Docker-capable host.
4. Remove `bin`, `obj`, caches, temporary files, local state, and nested archives.
5. Generate the SBOM, `TREE.txt`, and `MANIFEST.sha256` during packaging; do not track generated release evidence in Git.
6. Build a ZIP with exactly one top-level `RUNE/` directory.
7. Extract the ZIP into a clean directory and rerun workspace and essential package-free validation.
8. Calculate `RUNE-<version>.sha256` from the final ZIP.
9. Create `rune-<version>/` with the ZIP, checksum, and byte-identical release documents.
10. Publish immutable source, image digests, and tag. Any source change requires a new artifact and repeated validation.
