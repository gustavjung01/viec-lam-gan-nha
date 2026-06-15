#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/var/www/viec-lam-gan-nha-source}"
BRANCH="${BRANCH:-admin-phase7-mobile-pwa}"
FRONTEND_TARGET="${FRONTEND_TARGET:-/var/www/viec-lam-gan-nha-frontend}"
LIVE_DB="${LIVE_DB:-/var/www/viec-lam-gan-nha/data/applications.db}"
BACKUP_DIR="${BACKUP_DIR:-/srv/backups/vlgn/db}"
NGINX_CONF="${NGINX_CONF:-/etc/nginx/sites-available/viec-lam-gan-nha.conf}"
NGINX_ENABLED="${NGINX_ENABLED:-/etc/nginx/sites-enabled/viec-lam-gan-nha.conf}"
DISABLE_OTHER_NGINX_SITES="${DISABLE_OTHER_NGINX_SITES:-1}"
BACKEND_UPSTREAM="${BACKEND_UPSTREAM:-http://127.0.0.1:3001}"
DOMAIN_NAMES="${DOMAIN_NAMES:-vieclamgannha.me www.vieclamgannha.me}"
SSL_CERTIFICATE="${SSL_CERTIFICATE:-/etc/letsencrypt/live/vieclamgannha.me/fullchain.pem}"
SSL_CERTIFICATE_KEY="${SSL_CERTIFICATE_KEY:-/etc/letsencrypt/live/vieclamgannha.me/privkey.pem}"

fail() {
  echo "[repair-vps-admin-frontend] $*" >&2
  exit 1
}

require_file() {
  local path="$1"
  [ -f "$path" ] || fail "Missing file: $path"
}

http_status() {
  local url="$1"
  curl -k -sS -o /dev/null -w '%{http_code}' "$url" || true
}

backup_untracked_blocker() {
  local path="docs/vps-filesystem-map.md"
  if [ -f "$path" ] && ! git ls-files --error-unmatch "$path" >/dev/null 2>&1; then
    mkdir -p /tmp/vlgn-sync-backup
    mv "$path" "/tmp/vlgn-sync-backup/vps-filesystem-map.md.$(date +%s)"
    echo "[repair-vps-admin-frontend] Moved untracked $path to /tmp/vlgn-sync-backup"
  fi
}

write_nginx_config() {
  [ -f "$SSL_CERTIFICATE" ] || fail "SSL certificate not found: $SSL_CERTIFICATE"
  [ -f "$SSL_CERTIFICATE_KEY" ] || fail "SSL certificate key not found: $SSL_CERTIFICATE_KEY"

  sudo mkdir -p "$(dirname "$NGINX_CONF")" "$(dirname "$NGINX_ENABLED")" /etc/nginx/disabled-sites

  local backup=""
  if [ -f "$NGINX_CONF" ]; then
    backup="${NGINX_CONF}.$(date +%Y%m%d-%H%M%S).bak"
    sudo cp -a "$NGINX_CONF" "$backup"
    echo "[repair-vps-admin-frontend] Backed up nginx config to $backup"
  fi

  sudo tee "$NGINX_CONF" >/dev/null <<NGINX
server {
    listen 80;
    server_name ${DOMAIN_NAMES};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN_NAMES};

    root ${FRONTEND_TARGET};
    index index.html;

    ssl_certificate ${SSL_CERTIFICATE};
    ssl_certificate_key ${SSL_CERTIFICATE_KEY};

    location /api/ {
        proxy_pass ${BACKEND_UPSTREAM}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
        try_files /index.html =404;
    }

    location = /admin.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
        try_files /admin.html =404;
    }

    location = /build-info.json {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;
        add_header Pragma "no-cache" always;
        add_header Expires "0" always;
        try_files /build-info.json =404;
    }

    location = /manifest.webmanifest {
        add_header Cache-Control "no-cache" always;
        try_files /manifest.webmanifest =404;
    }

    location = /admin-manifest.webmanifest {
        add_header Cache-Control "no-cache" always;
        try_files /admin-manifest.webmanifest =404;
    }

    location = /sw.js {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;
        try_files /sw.js =404;
    }

    location = /admin-sw.js {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;
        try_files /admin-sw.js =404;
    }

    location ^~ /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        try_files \$uri =404;
        access_log off;
    }

    location ^~ /admin/ {
        try_files \$uri \$uri/ /admin.html;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

  sudo ln -sfn "$NGINX_CONF" "$NGINX_ENABLED"

  if [ "$DISABLE_OTHER_NGINX_SITES" = "1" ]; then
    local enabled
    for enabled in /etc/nginx/sites-enabled/*; do
      [ -e "$enabled" ] || continue
      [ "$(readlink -f "$enabled")" = "$(readlink -f "$NGINX_ENABLED")" ] && continue
      sudo mv "$enabled" "/etc/nginx/disabled-sites/$(basename "$enabled").$(date +%Y%m%d-%H%M%S)"
    done
  fi

  if ! sudo nginx -t; then
    if [ -n "$backup" ]; then
      sudo cp -a "$backup" "$NGINX_CONF"
      sudo nginx -t || true
    fi
    fail "nginx -t failed. Restored previous config when backup existed."
  fi

  sudo systemctl reload nginx
}

verify_live_http() {
  local admin_asset
  admin_asset="$(grep -Eo '/assets/[^"'"'"']+' "$FRONTEND_TARGET/admin.html" | head -1 || true)"
  [ -n "$admin_asset" ] || fail "Cannot find /assets reference in deployed admin.html"

  echo "[repair-vps-admin-frontend] First admin asset: $admin_asset"

  local root_status jobs_status admin_html_status admin_route_status asset_status public_manifest_status admin_manifest_status
  root_status="$(http_status https://vieclamgannha.me/)"
  jobs_status="$(http_status https://vieclamgannha.me/viec-lam)"
  admin_html_status="$(http_status https://vieclamgannha.me/admin.html)"
  admin_route_status="$(http_status https://vieclamgannha.me/admin/console)"
  asset_status="$(http_status "https://vieclamgannha.me${admin_asset}")"
  public_manifest_status="$(http_status https://vieclamgannha.me/manifest.webmanifest)"
  admin_manifest_status="$(http_status https://vieclamgannha.me/admin-manifest.webmanifest)"

  printf '[repair-vps-admin-frontend] / => %s\n' "$root_status"
  printf '[repair-vps-admin-frontend] /viec-lam => %s\n' "$jobs_status"
  printf '[repair-vps-admin-frontend] /admin.html => %s\n' "$admin_html_status"
  printf '[repair-vps-admin-frontend] /admin/console => %s\n' "$admin_route_status"
  printf '[repair-vps-admin-frontend] %s => %s\n' "$admin_asset" "$asset_status"
  printf '[repair-vps-admin-frontend] /manifest.webmanifest => %s\n' "$public_manifest_status"
  printf '[repair-vps-admin-frontend] /admin-manifest.webmanifest => %s\n' "$admin_manifest_status"

  [ "$root_status" = "200" ] || fail "Home page is not 200"
  [ "$admin_html_status" = "200" ] || fail "admin.html is not 200"
  [ "$admin_route_status" = "200" ] || fail "admin console route is not 200"
  [ "$asset_status" = "200" ] || fail "admin asset is not 200"
  [ "$public_manifest_status" = "200" ] || fail "public manifest is not 200"
  [ "$admin_manifest_status" = "200" ] || fail "admin manifest is not 200"
}

cd "$REPO_DIR"
backup_untracked_blocker

git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

echo "[repair-vps-admin-frontend] HEAD=$(git rev-parse HEAD)"

sudo mkdir -p "$FRONTEND_TARGET" "$BACKUP_DIR"
sudo chown -R "$(id -un):$(id -gn)" "$FRONTEND_TARGET" "$BACKUP_DIR"

npm install
npm run build

bash scripts/verify-release-safety.sh dist "$LIVE_DB"
bash scripts/backup-db-safe.sh "$LIVE_DB" "$BACKUP_DIR"
bash scripts/deploy-frontend-safe.sh dist "$FRONTEND_TARGET"

require_file "$FRONTEND_TARGET/index.html"
require_file "$FRONTEND_TARGET/admin.html"
require_file "$FRONTEND_TARGET/manifest.webmanifest"
require_file "$FRONTEND_TARGET/admin-manifest.webmanifest"
require_file "$FRONTEND_TARGET/sw.js"
require_file "$FRONTEND_TARGET/admin-sw.js"

write_nginx_config
verify_live_http

echo "[repair-vps-admin-frontend] DONE"
