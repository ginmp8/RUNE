# Migration to RUNE 0.10.0

1. Replace the complete extracted RUNE 0.9.2 tree with RUNE 0.10.0. Do not overlay files.
2. Existing API, job, event, schema, dispatcher, CLI, and SDK consumers require no contract changes.
3. Continue using local dispatch by default. Set `RUNE_DISPATCH_PROVIDER=nats` and `NATS_URL` only for distributed API and Worker operation.
4. The new distributed qualification and Streamlit AppTest scripts are validation tools; they do not add runtime network dependencies to document rendering.
