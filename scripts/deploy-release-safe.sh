#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIST="${1:-dist}"
LIVE_DB="${2:-/srv/vlgn-data/applications.db}"
BACKUP_DIR="${3:-/srv/backups/vlgn/db}"
FRONTEND_TARGET="${4:-/var/www/viec-lam-gan-nha-frontend}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

bash "$SCRIPT_DIR/verify-release-safety.sh" "$SOURCE_DIST" "$LIVE_DB"
bash "$SCRIPT_DIR/backup-db-safe.sh" "$LIVE_DB" "$BACKUP_DIR"
bash "$SCRIPT_DIR/deploy-frontend-safe.sh" "$SOURCE_DIST" "$FRONTEND_TARGET"

echo "[deploy-release-safe] Release files verified, database backed up, frontend deployed safely"
