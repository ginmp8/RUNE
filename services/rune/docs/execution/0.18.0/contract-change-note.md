# RUNE 0.18.0 Contract Change Note

## Changed contracts

- comparison: synchronous Base64 utility removed; asynchronous artifact-addressed jobs required;
- PDF import: passwords removed; encrypted/restricted PDFs rejected;
- output selection: singular and plural fields are mutually exclusive;
- templates: strict typed evaluation and contextual escaping are default;
- cache: sensitive entries require encryption and hit reauthorization.

## Compatibility

This is a pre-1.0 minor release containing intentional incompatibilities. Migration and rollback are documented at the repository root. Schemas, API, events, CLI, Studio, and all SDKs were updated together.

## Validation

Contract schemas/examples, client tests/typecheck, API build, and targeted behavior tests passed. Production consumer compatibility was not executed.
