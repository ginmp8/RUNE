# Rollback RUNE 0.13.1

## Target

Rollback to the complete immutable RUNE 0.13.0 package.

## Procedure

1. Stop 0.13.1 API and worker processes.
2. Restore the complete 0.13.0 package and configuration.
3. Keep 0.13.1 artifacts separately for audit; do not mix them into the 0.13.0 evidence folder.
4. Repeat the 0.13.0 health and render smoke tests.

## Known rollback impact

Rollback reintroduces duplicate matching part headings, black PDF-raster background/border artifacts, and the less readable raw comparison-diff image.
