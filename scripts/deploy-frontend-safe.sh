#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIST="${1:-dist}"
TARGET_DIR="${2:-frontend-live}"
ALLOW_UNSAFE_DEPLOY="${ALLOW_UNSAFE_DEPLOY:-0}"

if [ ! -d "$SOURCE_DIST" ]; then
  echo "[deploy-frontend-safe] Missing dist directory: $SOURCE_DIST" >&2
  exit 1
fi

if [ ! -f "$SOURCE_DIST/index.html" ]; then
  echo "[deploy-frontend-safe] Dist is missing index.html" >&2
  exit 1
fi

case "$TARGET_DIR" in
  "/"|"/var/www"|"/var/www/"|"/var/www/viec-lam-gan-nha"|"/var/www/viec-lam-gan-nha/"|*"/backend"|*"/backend/"|*"/data"|*"/data/")
    if [ "$ALLOW_UNSAFE_DEPLOY" != "1" ]; then
      echo "[deploy-frontend-safe] Refusing dangerous target: $TARGET_DIR" >&2
      echo "[deploy-frontend-safe] Use a dedicated frontend directory such as /var/www/viec-lam-gan-nha-frontend" >&2
      exit 1
    fi
    ;;
esac

mkdir -p "$TARGET_DIR"
cp -a "$SOURCE_DIST/." "$TARGET_DIR/"

echo "[deploy-frontend-safe] Copied $SOURCE_DIST to $TARGET_DIR"
