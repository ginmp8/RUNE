# Distributed Tracing and Metrics

RUNE exposes standards-based telemetry without requiring one exporter implementation in the rendering domain.

## Trace contract

- Activity source: `Rune`.
- Meter: `Rune`.
- Propagation: W3C `traceparent` and optional `tracestate` in `EventMetadata.headers`.
- API acceptance, durable command publication, NATS consumption, and render processing create producer, consumer, or internal activities.
- Lifecycle events retain the originating trace headers.

A deployment may connect the `Rune` `ActivitySource` and `Meter` to OpenTelemetry, OTLP, Application Insights, Datadog, or another compatible collector. Exporter credentials and endpoints remain deployment configuration and are never embedded in render packages or source.

## Core instruments

- `rune.dispatch.published` counter;
- `rune.dispatch.failed` counter;
- `rune.message.dead_lettered` counter;
- `rune.render.duration` histogram.

The existing `/metrics` endpoint additionally exports filesystem-safe Prometheus counters for durable publication, failures, and dead letters. Trace identifiers may be logged through the host logging provider; document source, secrets, and full artifact content are not telemetry labels.
