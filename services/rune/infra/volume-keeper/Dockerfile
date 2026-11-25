FROM alpine:3.22
RUN apk add --no-cache su-exec \
 && addgroup -g 10001 rune \
 && adduser -D -u 10001 -G rune -h /home/rune rune
COPY services/rune/infra/volume-keeper/entrypoint.sh /usr/local/bin/rune-volume-keeper
RUN chmod 0755 /usr/local/bin/rune-volume-keeper
USER root
ENTRYPOINT ["/usr/local/bin/rune-volume-keeper"]
CMD ["sh", "-c", "while :; do sleep 3600; done"]
