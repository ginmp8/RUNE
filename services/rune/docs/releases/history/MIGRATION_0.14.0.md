# Migration to RUNE 0.14.0

RUNE 0.14.0 changes the supported Compose deployment path from an ambiguously configured local dispatcher to explicit NATS/JetStream dispatch.

## Required actions

1. Replace the complete RUNE 0.13.1 package with the complete 0.14.0 candidate.
2. Ensure Docker Engine and Docker Compose support `depends_on.condition`, `tmpfs`, health checks, and `docker compose up --wait`.
3. Preserve or deliberately migrate the named `rune-data`, `rune-cache`, and `nats-data` volumes.
4. Remove host bind mounts that depend on root ownership; the application containers run as UID/GID 10001.
5. Run `python3 scripts/verify_compose_pipeline.py --output build/compose-evidence` before promotion.
6. Update `LAST_VERSION` only after the complete live gate passes.

## Optional recovery timing settings

Direct-process deployments retain the prior defaults. Operators may configure:

- `RUNE_NATS_ACK_WAIT_SECONDS`;
- `RUNE_NATS_NAK_DELAY_SECONDS`;
- `RUNE_JOB_LEASE_SECONDS`.

Values are bounded by the application. The supplied Compose profile uses shorter values for deterministic recovery tests.

No API payload, event schema, or stored render-package migration is required.
