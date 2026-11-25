FROM nats:2.14.3-alpine3.22
COPY --chown=nats:nats messaging/nats/server/nats-server.conf /etc/nats/nats-server.conf
USER nats
EXPOSE 4222 8222
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=10s --timeout=3s --retries=12 CMD wget -q -O - 'http://localhost:8222/healthz?js-enabled-only=true' >/dev/null || exit 1
CMD ["-c", "/etc/nats/nats-server.conf"]
