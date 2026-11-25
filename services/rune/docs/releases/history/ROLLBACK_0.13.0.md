# RUNE 0.13.0 Rollback

Rollback target: RUNE 0.12.0.

Replace the complete 0.13.0 deployment with the immutable 0.12.0 artifact. Do not overlay source trees.

Before rollback, stop or translate requests using:

- advanced pixel, OCR, diff-image, or canonical PDF comparison;
- nested composites, PDF composite parts, independent page geometry, or rewritten composite table of contents;
- caller-defined declarative template helpers;
- font sanitization, WOFF/WOFF2 introspection, or physical font subsetting;
- `emitStructureMap` and consumers expecting `structure-map.json`;
- cache storage-semantic probes or fenced-lease diagnostics introduced in 0.13.0.

Completed primary artifacts remain readable under their retention policy. Companion structure maps, comparison diff images, physical font subsets, and validation-cache entries may be retained or removed after all 0.13.0 processes are stopped. Do not remove active shared-cache locks by age alone; verify ownership and fencing tokens.
