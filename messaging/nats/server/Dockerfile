FROM nats:2.14.3-alpine3.22
USER root
RUN addgroup -S -g 10001 nats \
 && adduser -S -D -H -u 10001 -G nats nats \
 && mkdir -p /data/jetstream \
 && chown -R 10001:10001 /data \
 && chmod 0750 /data /data/jetstream
COPY --chown=10001:10001 messaging/nats/server/nats-server.conf /etc/nats/nats-server.conf
USER 10001:10001
EXPOSE 4222 8222
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=10s --timeout=3s --retries=12 CMD wget -q -O - 'http://localhost:8222/healthz?js-enabled-only=true' >/dev/null || exit 1
CMD ["-c", "/etc/nats/nats-server.conf"]
