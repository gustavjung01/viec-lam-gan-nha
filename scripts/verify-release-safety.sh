#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIST="${1:-dist}"
DB_PATH="${2:-applications.db}"

if [ ! -d "$SOURCE_DIST" ]; then
  echo "[verify-release-safety] Missing dist directory: $SOURCE_DIST" >&2
  exit 1
fi

if [ ! -f "$SOURCE_DIST/index.html" ]; then
  echo "[verify-release-safety] Dist is missing index.html" >&2
  exit 1
fi

if [ ! -s "$DB_PATH" ]; then
  echo "[verify-release-safety] Database file missing or empty: $DB_PATH" >&2
  exit 1
fi

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_PATH" ".tables" >/dev/null
fi

echo "[verify-release-safety] OK"
