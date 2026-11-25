#!/bin/sh
set -eu
path="${RUNE_VOLUME_PATH:?RUNE_VOLUME_PATH is required}"
mkdir -p "$path"
chown -R 10001:10001 "$path"
chmod 0770 "$path"
exec su-exec 10001:10001 "$@"
