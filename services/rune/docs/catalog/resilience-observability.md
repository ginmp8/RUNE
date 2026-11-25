# Resilience Observability

The API publishes Prometheus text at `/metrics`. The metric set covers job state, queue and render duration, redelivery, idempotency, cache behavior, lease conflicts, fencing rejection, temporary files, and live Chromium processes.

Metrics use shared filesystem state where aggregation is required, so either API node can expose the current multi-node view. The endpoint is operational evidence, not a replacement for external scraping, retention, alerting, or dashboards.
