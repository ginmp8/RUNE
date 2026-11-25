# RUNE 0.18.0 Implementation Notes

## Scope

Executed the MF-001 through MF-009 implementation backlog against RUNE 0.17.1 without mutating the published baseline.

## Material decisions

- official SchemaTex package bytes execute through a restricted Node.js bridge rather than a translated private DSL;
- comparison moved to a persistent asynchronous job model;
- encrypted PDF input follows the stable reject contract;
- cache security labels and optional AES-GCM encryption are part of hit eligibility;
- composite and multi-output publication is fail-closed and manifest-addressed.

## Evidence inspected

Source contracts, implementation code, 17 schemas/examples, 139 .NET tests, Python/Studio/tools suites, TypeScript typecheck, catalog validation, reference equivalence, workspace/package validators, and release manifests.

## Residual risk

Environment-specific container, capacity, vulnerability, signing, final PDF/A, and production gates remain unexecuted. Handoff: `mago` for specification-governance corrections and `nomia` only when release promotion is scheduled.
