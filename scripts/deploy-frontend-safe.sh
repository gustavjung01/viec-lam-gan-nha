#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIST="${1:-dist}"
TARGET_DIR="${2:-frontend-live}"
ALLOW_UNSAFE_DEPLOY="${ALLOW_UNSAFE_DEPLOY:-0}"

fail() {
  echo "[deploy-frontend-safe] $*" >&2
  exit 1
}

require_file() {
  local path="$1"
  [ -f "$path" ] || fail "Missing required file: $path"
}

require_asset_refs() {
  local html_file="$1"
  local label="$2"
  local ref
  local found=0

  while IFS= read -r ref; do
    [ -n "$ref" ] || continue
    found=1
    [ -f "$SOURCE_DIST/$ref" ] || fail "$label references missing asset: /$ref"
  done < <(grep -Eo '["'"'"']/?assets/[^"'"'"']+' "$html_file" | tr -d '"'"'"'' | sed 's#^/##' | sort -u)

  [ "$found" = "1" ] || fail "$label does not reference any built /assets files"
}

if [ ! -d "$SOURCE_DIST" ]; then
  fail "Missing dist directory: $SOURCE_DIST"
fi

require_file "$SOURCE_DIST/index.html"
require_file "$SOURCE_DIST/admin.html"
require_file "$SOURCE_DIST/manifest.webmanifest"
require_file "$SOURCE_DIST/admin-manifest.webmanifest"
require_file "$SOURCE_DIST/sw.js"
require_file "$SOURCE_DIST/admin-sw.js"
require_file "$SOURCE_DIST/build-info.json"
require_asset_refs "$SOURCE_DIST/index.html" "index.html"
require_asset_refs "$SOURCE_DIST/admin.html" "admin.html"

case "$TARGET_DIR" in
  "/"|"/var/www"|"/var/www/"|"/var/www/viec-lam-gan-nha"|"/var/www/viec-lam-gan-nha/"|*"/backend"|*"/backend/"|*"/data"|*"/data/")
    if [ "$ALLOW_UNSAFE_DEPLOY" != "1" ]; then
      fail "Refusing dangerous target: $TARGET_DIR"
    fi
    ;;
esac

mkdir -p "$TARGET_DIR"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude='.well-known/' "$SOURCE_DIST"/ "$TARGET_DIR"/
else
  find "$TARGET_DIR" -mindepth 1 -maxdepth 1 ! -name '.well-known' -exec rm -rf {} +
  cp -a "$SOURCE_DIST/." "$TARGET_DIR/"
fi

require_file "$TARGET_DIR/index.html"
require_file "$TARGET_DIR/admin.html"
require_file "$TARGET_DIR/manifest.webmanifest"
require_file "$TARGET_DIR/admin-manifest.webmanifest"
require_file "$TARGET_DIR/sw.js"
require_file "$TARGET_DIR/admin-sw.js"
require_file "$TARGET_DIR/build-info.json"

SOURCE_DIST="$TARGET_DIR" require_asset_refs "$TARGET_DIR/index.html" "deployed index.html"
SOURCE_DIST="$TARGET_DIR" require_asset_refs "$TARGET_DIR/admin.html" "deployed admin.html"

echo "[deploy-frontend-safe] Synced $SOURCE_DIST to $TARGET_DIR"
