#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIST="${1:-dist}"
TARGET_DIR="${2:-frontend-live}"

if [ ! -d "$SOURCE_DIST" ]; then
  echo "[deploy-frontend-safe] Missing dist directory: $SOURCE_DIST" >&2
  exit 1
fi

if [ ! -f "$SOURCE_DIST/index.html" ]; then
  echo "[deploy-frontend-safe] Dist is missing index.html" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
cp -a "$SOURCE_DIST/." "$TARGET_DIR/"

echo "[deploy-frontend-safe] Copied $SOURCE_DIST to $TARGET_DIR"
