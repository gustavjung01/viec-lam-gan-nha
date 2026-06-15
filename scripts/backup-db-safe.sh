#!/usr/bin/env bash
set -euo pipefail

SOURCE_DB="${1:-applications.db}"
BACKUP_DIR="${2:-db-backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
TARGET_DB="$BACKUP_DIR/applications-$TIMESTAMP.db"

if [ ! -s "$SOURCE_DB" ]; then
  echo "[backup-db-safe] Source DB missing or empty: $SOURCE_DB" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
cp -av "$SOURCE_DB" "$TARGET_DB"

echo "[backup-db-safe] Created $TARGET_DB"
