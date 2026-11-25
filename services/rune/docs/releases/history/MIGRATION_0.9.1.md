# RUNE 0.9.1 migration

RUNE 0.9.1 is a compatible patch over 0.9.0.

1. Replace the complete extracted source tree.
2. Keep the SchemaTex vendor directory intact, including module, license, source record, and checksums.
3. Leave `RUNE_DISPATCH_PROVIDER` unset for the default local dispatcher.
4. No API, event, job, schema, CLI, SDK, or persistence migration is required.
5. Remove any obsolete build automation that sets `RUNE_ENABLE_AGPL_SCHEMATEX`; the switch no longer exists.
