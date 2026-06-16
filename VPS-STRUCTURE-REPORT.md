# VPS Structure Report

Generated from live VPS audit for `vieclamgannha.me`.

## Host

- Hostname: `vps-canada-1-1-e1`
- Main app runtime target: `/srv/apps/vlgn/source`

## Application Layout

### Runtime tree

- `/srv/apps/vlgn/current -> /srv/apps/vlgn/source`
- `/srv/apps/vlgn/source`
  - `.git`
  - `backend`
  - `deploy-staging`
  - `dist`
  - `docs`
  - `e2e`
  - `infra`
  - `node_modules`
  - `public`
  - `public_images_categories_placeholders_8images`
  - `scripts`
  - `src`
- `/srv/apps/vlgn/releases`
  - `20260616_043849_d8029a3`
- `/srv/apps/vlgn/shared`
  - `tmp`
  - `uploads`

### Live web root

- `/var/www/viec-lam-gan-nha`
  - `assets`
  - `data`
  - `images`
  - `js`

## Backend Service

### systemd unit

- Service: `vlgn-api.service`
- Unit file: `/etc/systemd/system/vlgn-api.service`
- Working directory: `/srv/apps/vlgn/current/backend`
- Environment file: `/etc/app-env/vlgn.env`
- Exec: `/usr/bin/node server.js`
- User/group: `www-data`
- Restart policy: `always`

### Current runtime behavior

- Reads `DATABASE_URL` from `/etc/app-env/vlgn.env`
- Currently booting against Postgres schema `vlgn`
- Public API is healthy after cutover

## Nginx

### Enabled site files

- `/etc/nginx/sites-enabled/api.vieclamgannha.me.conf`
- `/etc/nginx/sites-enabled/viec-lam-gan-nha.conf`
- `/etc/nginx/sites-enabled/default`

### Available site files

- `/etc/nginx/sites-available/api.vieclamgannha.me.conf`
- `/etc/nginx/sites-available/viec-lam-gan-nha.conf`
- Several backup variants of `viec-lam-gan-nha.conf`

## Config / Secret Paths

- App env directory: `/etc/app-env`
- Active env file: `/etc/app-env/vlgn.env`
- Env file is root-owned and mode `600`

## Backups

### Backup root

- `/srv/backups/vlgn`

### Backup categories observed

- `backend-hub-cleanup`
- `backend-hub-migration`
- `db`
- `final-sqlite-before-pg-cutover`
- `pg-cutover`
- `pre-heroku-schema`
- `pre-postgres-code-deploy`

### Notable backups

- Final SQLite backup before cutover:
  - `/srv/backups/vlgn/final-sqlite-before-pg-cutover/20260616_115600/applications.db`
- Cutover backups:
  - `/srv/backups/vlgn/pg-cutover/20260616_120950/applications.db`
  - `/srv/backups/vlgn/pg-cutover/20260616_121317/applications.db`
  - `/srv/backups/vlgn/pg-cutover/20260616_121435/applications.db`
  - `/srv/backups/vlgn/pg-cutover/20260616_121539/applications.db`
  - `/srv/backups/vlgn/pg-cutover/20260616_121655/applications.db`
  - `/srv/backups/vlgn/pg-cutover/20260616_122014/applications.db`
  - `/srv/backups/vlgn/pg-cutover/20260616_122143/applications.db`

## Database

### Live DB

- Database mode: Postgres
- Schema: `vlgn`
- Cutover completed and verified

### Legacy SQLite location

- `/var/www/viec-lam-gan-nha/data/applications.db`

### Post-cutover counts observed

- `applications: 8`
- `campaigns: 59`
- `companies: 7`
- `ctv_accounts: 4`
- `lead_submissions: 6`
- `notification_inbox: 3`
- `candidates: 10`
- `audit_logs: 9`

## Notes for Future Backend Agents

- The backend service is not deployed from `/srv/apps/vlgn/releases/...` anymore; it currently runs from `/srv/apps/vlgn/source` via the `current` symlink.
- Any backend change should respect:
  - `vlgn-api.service`
  - `/etc/app-env/vlgn.env`
  - Postgres schema `vlgn`
  - SQLite rollback backup under `/srv/backups/vlgn`
- Public API currently lives behind Nginx on `api.vieclamgannha.me`.

## Verified Public Endpoints

- `https://api.vieclamgannha.me/api/health`
- `https://api.vieclamgannha.me/api/jobs`

