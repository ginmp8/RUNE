# RUNE 0.18.0 Qualification Status

## Functional implementation

Passed for the requested MF-001 through MF-009 backlog, unified source build, automated tests, schemas, clients, catalog, reference mapping, and immutable package validation.

## Contract status

The 0.18.0 public contract intentionally converges on the planned 1.0 behavior. Migration is required for synchronous comparison, encrypted PDF passwords, multi-output request shape, strict templates, and sensitive cache encryption.

## Gates still open

- Docker/Compose and live two-API/two-Worker container qualification;
- final load, sustained, and soak profiles;
- complete current vulnerability coverage and authorized signing;
- independent PDF/A validation for every new final path;
- deployed Studio/accessibility and production observability smoke;
- backup, restore, upgrade, rollback, and production owner approval;
- specification-workspace governance corrections.

RUNE 0.18.0 may be selected as the latest functional implementation release. It is not `1.0.0-rc.1` and operational promotion remains false.
