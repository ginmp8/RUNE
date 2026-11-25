# NATS development

The local server is built from `messaging/nats/server/Dockerfile` and configured by `nats-server.conf`. Compose exposes client port `4222` and monitoring port `8222` and persists JetStream data in the `nats-data` volume. The image provisions a dedicated non-root NATS account (UID/GID 10001) and prepares its storage directory. Existing volumes must be writable by this account; preserve their contents when migrating ownership.

The adapter project may depend on RUNE event contracts and messaging abstractions. RUNE engine, application, contract, and abstraction projects must not depend on NATS.Net or JetStream types.
