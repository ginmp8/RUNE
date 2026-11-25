# Migration to RUNE 0.13.1

No data migration or API request migration is required.

## Recommended procedure

1. Replace the complete 0.13.0 source/runtime package with 0.13.1.
2. Re-render composites that contain visual PDF parts.
3. Re-run advanced comparisons when consumers store `diffImageBase64` or the extracted diff PNG.
4. Replace previously published 0.13.0 advanced evidence artifacts when exact corrected output is required.

Do not overlay individual binaries from different RUNE versions.
