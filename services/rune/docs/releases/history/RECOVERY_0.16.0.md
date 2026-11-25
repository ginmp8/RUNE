# RUNE 0.16.0 Recovery Lineage

## Lineage

- direct functional source: RUNE 0.14.0;
- excluded sibling candidate: RUNE 0.15.0 distributed resilience;
- target: RUNE 0.16.0 native PDF page import.

The release preserves all RUNE 0.14.0 behavior and adds native final-PDF composition without importing RUNE 0.15.0 changes.

## Recovery rule

A failed or unsupported native import must not silently become a native claim. It must produce one of:

- controlled policy rejection;
- visual fallback with explicit `requestedMode`, `appliedMode`, and `fallbackReason`;
- successful native page replacement recorded in `pdf-import-manifest.json`.

## Mandatory gates

Recovery and publication require version synchronization, clean source packaging, schema validation, complete .NET tests, corpus validation, manifest verification, and final ZIP extraction. Functional promotion additionally requires real Chromium end-to-end evidence and independent PDF/A validation when conformance is claimed.
