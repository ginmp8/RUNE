# Migration to RUNE 0.17.1

## Baseline

Upgrade from the complete immutable RUNE 0.17.0 artifact. Do not replace or edit the published 0.17.0 folder.

## Required actions

1. Deploy API, Worker, Studio, CLI, and SDKs from the same 0.17.1 package.
2. Preserve the existing shared data, cache, outbox/dispatch state, and JetStream stores.
3. Update clients or monitors that incorrectly expected native-PDF policy rejection to return HTTP 500. The correct response is HTTP 400 with the stable domain code.
4. Retain monitoring for `/v1/dead-letters`, `POST /v1/renders/{id}/replay`, dispatch failure metrics, and trace correlation.
5. Execute one native signature-rejection scenario and one dispatch-recovery scenario before promotion.

No data migration is required. Existing jobs, dispatch generations, dead-letter metadata, packages, artifacts, and cache entries remain readable.
