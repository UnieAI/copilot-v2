#!/bin/sh
set -eu

HOME_DIR="${HOME:-/home/opencode}"
WORK_DIR="/workspace"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME_DIR/.config}"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME_DIR/.cache}"
DATA_DIR="${XDG_DATA_HOME:-$HOME_DIR/.local/share}"

mkdir -p "$WORK_DIR" "$HOME_DIR" "$CONFIG_DIR" "$CACHE_DIR" "$DATA_DIR"

# Volume mounts can replace image-owned directories with root-owned filesystems.
# Normalize ownership on each start so the unprivileged opencode user can write
# and chmod within the writable sandbox paths.
chown -R opencode:opencode "$WORK_DIR" "$HOME_DIR"
chmod u+rwx "$WORK_DIR" "$HOME_DIR"

exec su-exec opencode:opencode opencode serve --hostname 0.0.0.0 --port 4096
