# ERRATA RUNE 0.14.0

**Date:** 2026-07-27  
**Artifact affected:** documentation status only  
**Source archive digest changed:** no

## Original statement

The packaged candidate documents state that RUNE `0.14.0` must remain under a candidate path and must not update `LAST_VERSION` until the Docker Compose verifier finishes with `COMPOSE PIPELINE PASSED`.

## Correction

RUNE `0.14.0` is published at:

```text
rune-0.14.0 (historical release archive)
```

It is the latest functional release selected by `LAST_VERSION.json` and `LAST_VERSION.md` based on the executed source, build, automated-test, real-browser, real local NATS/JetStream pipeline, persistence, duplicate-delivery, idempotency, Worker-recovery, artifact, and graceful-shutdown evidence.

Docker image builds and Docker Compose execution were not performed in the authoring sandbox. Therefore:

- `operationalPromotionApproved` remains `false`;
- `latestOperationallyPromoted` remains `null`;
- no claim is made that container identities, Compose networking, named volumes, health transitions, or the actual Streamlit service were executed;
- the packaged command `python3 scripts/verify_compose_pipeline.py --output build/compose-evidence` remains the required Docker qualification path.

## Impact

This correction changes release selection and documentation status only. It does not change the source archive, source checksum, implementation, API contracts, event schemas, generated evidence, or rollback target.

```text
RUNE-0.14.0.zip SHA-256:
8aaafc8cb4606d9b15067fc7025f36db038da4e52f452c782e7d5b72343594e5

RUNE-0.14.0-LOCAL-RUNTIME-EVIDENCE.zip SHA-256:
813b3253129bde667e1aa09b475269ddb31d56d2c2220dc962c712668e8413f5
```

## Rollback

The immediate rollback target remains RUNE `0.13.1`.
