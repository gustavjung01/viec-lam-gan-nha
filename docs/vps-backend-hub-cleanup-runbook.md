# VPS Backend Hub Cleanup Runbook

Status: Canonical VPS cleanup runbook
Branch owner: platform
Last updated: 2026-06-16

This runbook defines how to align the VPS filesystem and runtime with the repository structure before moving the database to Heroku Postgres or another managed PostgreSQL provider.

The cleanup must be done before Heroku/Postgres cutover.

## 1. Target order

```text
1. Repository branch model and platform docs
2. VPS backend-only structure
3. Remove or archive unrelated frontend/static/runtime junk
4. Verify API domain and SSL
5. Keep SQLite live DB stable temporarily
6. Heroku Postgres migration/cutover
```

Do not start Heroku/Postgres migration until the VPS structure is clean and API runtime is stable.

## 2. Current canonical repository branches

```text
master    production
staging   pre-production integration
frontend  React/Vite/Vercel/UI/PWA frontend
backend   Node/Express/API/business logic/DB access code
platform  VPS/Nginx/systemd/deploy/backup/DB cutover
```

This runbook belongs to `platform`.

## 3. Target VPS role

The VPS is a backend-only API host.

Allowed:

```text
- /srv/apps/<app>/source
- /srv/apps/<app>/releases
- /srv/apps/<app>/current
- /srv/apps/<app>/shared
- /etc/app-env/<app>.env
- /var/log/apps/<app>
- /srv/backups/<app>
- Nginx API reverse proxy only
- systemd app services
```

Not allowed as active production runtime:

```text
- frontend static hosting
- /var/www/* frontend root
- old mixed source/live runtime paths
- duplicate Nginx server blocks for frontend domains
- production DB files inside repo or release folders
```

## 4. VLGN target VPS structure

```text
/srv/apps/vlgn/
  source/                 # Git checkout, not runtime
  releases/
    <timestamp>_<sha>/     # immutable release copy
  current -> releases/<timestamp>_<sha>
  shared/
    uploads/
    tmp/

/etc/app-env/
  vlgn.env

/var/log/apps/
  vlgn/

/srv/backups/
  vlgn/

/srv/archive/
  vps-cleanup/
```

## 5. Temporary legacy paths

These paths may exist only during transition and must not be deleted until backups and runtime verification pass.

```text
/var/www/viec-lam-gan-nha-source
/var/www/viec-lam-gan-nha
/var/www/viec-lam-gan-nha-frontend
```

Current temporary live SQLite DB:

```text
/var/www/viec-lam-gan-nha/data/applications.db
```

This database is runtime data. It must not be committed to Git and must not be deleted during cleanup.

## 6. Active service target

```text
vlgn-api.service
```

Expected service shape:

```ini
[Unit]
Description=VLGN Backend API
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/apps/vlgn/current/backend
EnvironmentFile=/etc/app-env/vlgn.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Old service should remain disabled after the new service passes health:

```text
viec-lam-gan-nha.service
```

## 7. Active Nginx target

Only this site should be active for VLGN on the backend VPS:

```text
/etc/nginx/sites-enabled/api.vieclamgannha.me.conf
```

It should proxy to:

```text
http://127.0.0.1:3001
```

The VPS should not actively claim:

```text
vieclamgannha.me
www.vieclamgannha.me
```

Those frontend domains belong to Vercel.

## 8. Cleanup stages

### Stage A: Audit only

Collect current state:

```text
- app directories
- systemd services
- Nginx enabled sites
- listening ports
- DB files
- env files without printing secrets
- active release symlink
- local and public health checks
```

### Stage B: Archive before removing

Archive unrelated/legacy items under:

```text
/srv/archive/vps-cleanup/<timestamp>/
```

Backups under:

```text
/srv/backups/vlgn/backend-hub-cleanup/<timestamp>/
```

### Stage C: Disable active junk

Disable old frontend/static Nginx sites by moving symlinks out of `sites-enabled`.

Do not delete original files from `sites-available` during the first cleanup pass.

### Stage D: Verify backend-only runtime

Required checks:

```text
systemctl is-active vlgn-api
curl -i http://127.0.0.1:3001/api/health
sudo nginx -t
curl -i http://api.vieclamgannha.me/api/health
curl -i https://api.vieclamgannha.me/api/health
```

### Stage E: Mark legacy paths as archived

After verification, legacy paths can be moved to archive, not deleted:

```text
/var/www/viec-lam-gan-nha-source       -> archive after source is synced to /srv/apps/vlgn/source
/var/www/viec-lam-gan-nha-frontend     -> archive after Vercel frontend is confirmed
/var/www/viec-lam-gan-nha/backend      -> archive after vlgn-api.service is stable
```

Do not move:

```text
/var/www/viec-lam-gan-nha/data
```

until SQLite is migrated and cut over to PostgreSQL.

## 9. What counts as unrelated junk

Unrelated or legacy junk includes:

```text
- old frontend static build directory on VPS after Vercel cutover
- old Nginx frontend server blocks
- duplicate Nginx server_name configs
- old backend runtime path after /srv/apps/vlgn/current is stable
- wrong/source DB created by running backend without DATABASE_PATH
- placeholder OneSignal/systemd env drop-ins
- stale deploy-staging runtime copies if they are not used by systemd/Nginx
```

Do not classify as junk:

```text
- live SQLite DB
- DB backups
- active vlgn-api release
- current /etc/app-env/vlgn.env
- archive folders
- source repo under /srv/apps/vlgn/source
```

## 10. DB rule before Heroku

Before Heroku/Postgres migration, the VPS must have exactly one temporary SQLite source of truth:

```text
/var/www/viec-lam-gan-nha/data/applications.db
```

Any other `.db`, `.sqlite`, or `.sqlite3` file outside backup/archive must be reported.

Do not delete DB-like files automatically. Move only confirmed wrong DBs to archive after backup.

## 11. Heroku/Postgres comes after cleanup

Start Heroku/Postgres only after:

```text
- vlgn-api.service is active
- api.vieclamgannha.me works over HTTPS
- Vercel frontend calls api.vieclamgannha.me
- Nginx no longer serves frontend domains
- legacy paths are archived or clearly marked transitional
- there is one canonical temporary SQLite DB
- latest DB backup is verified
```

## 12. Rollback principle

Every cleanup pass must print rollback commands for:

```text
- restoring old Nginx symlinks
- restarting old service
- stopping vlgn-api
- restoring archived runtime folder if needed
```

Do not perform irreversible deletion in the same pass as structure migration.
