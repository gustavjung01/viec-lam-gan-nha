#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${SOURCE_DIR:-/var/www/viec-lam-gan-nha-source}"
LIVE_BACKEND_DIR="${LIVE_BACKEND_DIR:-/var/www/viec-lam-gan-nha/backend}"
BRANCH="${BRANCH:-finance-phase6}"
SERVICE_NAME="${SERVICE_NAME:-viec-lam-gan-nha.service}"

printf '\n=== FINANCE PHASE 6 DEPLOY ===\n'
printf 'Source: %s\n' "$SOURCE_DIR"
printf 'Live backend: %s\n' "$LIVE_BACKEND_DIR"
printf 'Branch: %s\n' "$BRANCH"
printf 'Service: %s\n\n' "$SERVICE_NAME"

cd "$SOURCE_DIR"

echo '=== CLEAN SOURCE REPO ==='
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
git status -sb

echo '=== INSTALL BACKEND DEPS IN SOURCE ==='
cd "$SOURCE_DIR/backend"
npm install

echo '=== SYNC BACKEND SOURCE TO LIVE BACKEND ==='
sudo rsync -av --delete \
  --exclude 'data/' \
  "$SOURCE_DIR/backend/" \
  "$LIVE_BACKEND_DIR/"

echo '=== MOUNT FINANCE ROUTES IN LIVE BACKEND ONLY ==='
cd "$LIVE_BACKEND_DIR"
npm run finance:mount

echo '=== RESTART BACKEND SERVICE ==='
sudo systemctl restart "$SERVICE_NAME"
sleep 2
sudo systemctl status "$SERVICE_NAME" --no-pager -l

echo '=== HEALTH CHECKS ==='
curl -sS http://localhost:3001/api/health
echo
curl -sS http://localhost:3001/api/finance/health
echo

echo '=== VERIFY SOURCE REPO REMAINS CLEAN ==='
cd "$SOURCE_DIR"
git status -sb

echo '=== DONE FINANCE PHASE 6 DEPLOY ==='
