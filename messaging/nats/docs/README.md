# NATS integration

This directory owns the concrete NATS.Net adapter and the local NATS/JetStream server image. It is infrastructure and transport code, not part of the RUNE rendering domain.

RUNE publishes render commands through messaging abstractions. The adapter maps them to JetStream subjects, provisions the stream and durable consumer, serializes versioned events, acknowledges successful work, negatively acknowledges transient failures, and permits recovery when workers scale to zero or restart.

See `SUBJECTS.md`, `JETSTREAM.md`, and `DEVELOPMENT.md`.
