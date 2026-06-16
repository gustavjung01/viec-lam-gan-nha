# Shared Backend VPS Plan

Status: Structure plan only
Last updated: 2026-06-16

This document defines how one VPS can host backend APIs for multiple websites after the public frontends move to Vercel or another frontend platform.

This is not a deploy script. Do not change live services until the current VPS state is audited and backed up.

## 1. Role of this VPS

The VPS is a shared backend host, not a frontend web host.

```text
Allowed:
- Node/Express backend APIs
- API-only Nginx reverse proxy
- systemd services per backend app
- app logs
- backend env files
- optional internal worker processes when small

Not allowed:
- public frontend static hosting for production sites
- shared SQLite production database files for multiple apps
- one backend service handling multiple unrelated websites without isolation
- direct live edits outside repo-controlled deploys
```

## 2. Canonical domain map

Each website gets its own frontend domain and API subdomain.

```text
vieclamgannha.me              -> Vercel frontend
api.vieclamgannha.me          -> this backend VPS, app: vlgn

other-site.com                -> Vercel frontend
api.other-site.com            -> this backend VPS, app: other-site

third-site.vn                 -> Vercel frontend
api.third-site.vn             -> this backend VPS, app: third-site
```

Do not point any main public frontend domain to this VPS after frontend cutover.

## 3. Directory layout

Use a multi-app layout. Do not mix source, live runtime, env, data, and logs in one folder.

```text
/srv/apps/
  vlgn/
    repo/                 # git checkout
    current/              # release symlink or deployed backend runtime
    releases/             # optional release snapshots
    shared/               # app-specific runtime shared files
      uploads/
      tmp/

  other-site/
    repo/
    current/
    releases/
    shared/

/etc/app-env/
  vlgn.env
  other-site.env

/var/log/apps/
  vlgn/
  other-site/

/srv/backups/
  vlgn/
  other-site/
```

Legacy paths such as `/var/www/viec-lam-gan-nha/backend` should be considered transitional only.

## 4. Port allocation

Each backend app gets one internal localhost port.

```text
vlgn          -> 127.0.0.1:3001
other-site    -> 127.0.0.1:3011
third-site    -> 127.0.0.1:3021
staging-vlgn  -> 127.0.0.1:3101
```

Rules:

```text
- App ports are not exposed publicly.
- Nginx is the only public entry point.
- Every app must expose /api/health and /api/version.
- Port assignments must be documented before deployment.
```

## 5. systemd naming

One service per backend app.

```text
vlgn-api.service
other-site-api.service
third-site-api.service
vlgn-worker.service     # only when worker is still on same VPS
```

Service rules:

```text
- WorkingDirectory points to /srv/apps/<app>/current or repo backend folder.
- EnvironmentFile points to /etc/app-env/<app>.env.
- Restart=always.
- No secrets in the unit file itself.
- No placeholder secrets.
```

Example unit shape:

```ini
[Unit]
Description=VLGN API
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

## 6. Nginx structure

Use one site config per API domain.

```text
/etc/nginx/sites-available/api.vieclamgannha.me.conf
/etc/nginx/sites-available/api.other-site.com.conf
/etc/nginx/sites-enabled/api.vieclamgannha.me.conf -> ../sites-available/api.vieclamgannha.me.conf
```

Each API config should only reverse proxy to the matching internal port.

Example shape:

```nginx
server {
    listen 80;
    server_name api.vieclamgannha.me;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.vieclamgannha.me;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Rules:

```text
- No frontend SPA fallback in API Nginx configs.
- No duplicate server_name blocks.
- No config should claim vieclamgannha.me apex on this backend VPS after frontend cutover.
- Nginx reload only after nginx -t passes.
```

## 7. Environment files

Each app owns its own env file.

```text
/etc/app-env/vlgn.env
/etc/app-env/other-site.env
```

Example:

```bash
NODE_ENV=production
PORT=3001
APP_NAME=vlgn
PUBLIC_API_ORIGIN=https://api.vieclamgannha.me
FRONTEND_ORIGIN=https://vieclamgannha.me
DATABASE_URL=postgres://...
CLERK_SECRET_KEY=...
ONESIGNAL_APP_ID=...
ONESIGNAL_REST_API_KEY=...
```

Rules:

```text
- Do not commit production env files.
- Do not keep placeholder secrets in systemd.
- Frontend VITE_* keys live on Vercel, not this VPS.
- Backend-only secrets live on the backend VPS or secret manager.
```

## 8. Database policy

For many websites, do not store multiple production SQLite DBs inside app folders.

Preferred:

```text
- PostgreSQL on a DB VPS or managed database
- One database per app, or one cluster with separate DB/users per app
- Least-privilege DB users
```

Acceptable short transition for VLGN only:

```text
DATABASE_PATH=/var/www/viec-lam-gan-nha/data/applications.db
```

Not acceptable long term:

```text
/srv/apps/<app>/current/backend/data/applications.db
/srv/apps/<app>/repo/backend/data/applications.db
```

## 9. Deploy model

Deploy one backend at a time.

```text
1. Pull repo for that app.
2. Install backend production dependencies.
3. Run backend tests or smoke checks.
4. Switch release/current if using release folders.
5. Restart only that app service.
6. Check journal for only that service.
7. Check /api/health and /api/version.
```

Do not restart all apps for one app deploy.

## 10. Logs

```text
journalctl -u vlgn-api -n 100 --no-pager
journalctl -u other-site-api -n 100 --no-pager
```

Optional file logs:

```text
/var/log/apps/vlgn/api.log
/var/log/apps/vlgn/error.log
```

Rules:

```text
- Logs must not contain secrets.
- Each app logs under its own service name.
- Monitoring should check each API independently.
```

## 11. Firewall

Public ports:

```text
80/tcp
443/tcp
22/tcp restricted if possible
```

Internal only:

```text
3001, 3011, 3021, 3101
PostgreSQL port if DB is elsewhere, restricted by IP/firewall/VPN only
```

## 12. Add-new-backend checklist

For every new website backend:

```text
1. Choose app slug: <app>.
2. Choose API domain: api.<domain>.
3. Choose internal port.
4. Create /srv/apps/<app>/.
5. Create /etc/app-env/<app>.env.
6. Create systemd service <app>-api.service.
7. Create Nginx site api.<domain>.conf.
8. Add DNS api.<domain> -> VPS public IP.
9. Issue SSL certificate.
10. Start service.
11. Run health checks.
12. Document in docs/shared-backend-vps-inventory.md.
```

## 13. VLGN placement

For Việc Làm Gần Nhà in the new structure:

```text
App slug: vlgn
Frontend: vieclamgannha.me on Vercel
Backend API: api.vieclamgannha.me on shared backend VPS
Service: vlgn-api.service
Port: 3001
Repo path: /srv/apps/vlgn/repo
Runtime/current path: /srv/apps/vlgn/current
Env: /etc/app-env/vlgn.env
Logs: /var/log/apps/vlgn/
```

Transition from old paths must be explicit and backed up.

Old paths:

```text
/var/www/viec-lam-gan-nha-source
/var/www/viec-lam-gan-nha/backend
/var/www/viec-lam-gan-nha/data/applications.db
```

Do not delete old paths until:

```text
- Vercel frontend is verified.
- API domain is verified.
- DB migration/transition is verified.
- Backups are confirmed restorable.
```
