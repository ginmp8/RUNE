# RUNE 0.9.0 migration

RUNE 0.9.0 is additive and retains the 0.8.0 public render, job, event, schema, and dispatcher contracts.

1. Replace the complete extracted source tree.
2. Leave `RUNE_DISPATCH_PROVIDER` unset for the default local dispatcher.
3. Set `RUNE_DISPATCH_PROVIDER=nats` and `NATS_URL` only for distributed deployments.
4. Materialize Streamlit, veraPDF, Java, NATS, and advisory data only for the gates that require them.
5. Use an organization-owned signing key for promotion.
