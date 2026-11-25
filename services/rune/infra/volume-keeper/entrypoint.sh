#!/bin/sh
set -eu
path="${RUNE_VOLUME_PATH:?RUNE_VOLUME_PATH is required}"
case "$path" in
  /data|/cache) ;;
  *) echo "Unsupported volume path: $path" >&2; exit 1 ;;
esac

# New named volumes inherit the pre-owned directories in the image.
# An explicit root invocation may migrate an existing volume without deleting data.
if [ "$(id -u)" = 0 ]; then
  mkdir -p "$path"
  chown -R 10001:10001 "$path"
  chmod 0770 "$path"
  exec su-exec 10001:10001 "$@"
fi

test "$(id -u)" = 10001
test "$(stat -c %u "$path")" = 10001
test -w "$path"
exec "$@"
