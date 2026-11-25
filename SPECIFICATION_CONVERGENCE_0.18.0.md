# RUNE 0.18.0 Specification Convergence

## Implementation mapping

The nine feature-development gaps identified against the `rune-01.00.00` specification are implemented in 0.18.0. Code, schemas, clients, tests, and release documentation are mapped in `IMPLEMENTATION_REPORT_0.18.0.md` and `VALIDATION.md`.

## Contract decisions resolved

- encrypted/permission-restricted PDFs are rejected; password-enabled input is removed;
- artifact comparison is asynchronous and artifact-addressed;
- SchemaTex uses official 1.0.1 package bytes and official exports;
- output-set request fields are mutually exclusive and canonically ordered;
- strict template evaluation and fail-closed preservation are the stable defaults.

## Documentation corrections still owned by the specification workspace

The external `rune-01.00.00` specification workspace must still apply its governance-only corrections: unique SchemaTex requirement ID, one current implementation version across inventories, accepted ADR status only after approval, separation of implementation from executed/promotion evidence, removal of premature “no core feature remains” wording, and final freeze of routes/schemas/events/error/retention/deprecation/platform contracts.

These documentation corrections do not change the 0.18.0 source package. They remain a blocking governance gate for `1.0.0-rc.1` until published in the specification source of truth.
