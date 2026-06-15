# Safe VPS Release Procedure

This is the standard release flow for `vieclamgannha.me`.
Use it when you want to update code without losing newer code or live database data.

## Goals

- Keep Git source current on the VPS.
- Keep live SQLite data intact.
- Deploy frontend files only to the dedicated frontend target.
- Avoid `rsync --delete` against live root directories.
- Prefer migrations over replacing the database.

## Paths

- Source repo on VPS: `/var/www/viec-lam-gan-nha-source`
- Live frontend target: `/var/www/viec-lam-gan-nha-frontend`
- Live web root: `/var/www/viec-lam-gan-nha`
- Live database: `/var/www/viec-lam-gan-nha/data/applications.db`
- Backup directory: `/srv/backups/vlgn/db`

## Standard Flow

1. Pull the latest code on the VPS source repo.

```bash
cd /var/www/viec-lam-gan-nha-source
git fetch origin
git checkout admin-phase7-mobile-pwa
git pull --ff-only origin admin-phase7-mobile-pwa
```

2. Build the frontend from the source repo.

```bash
npm install
npm run build
```

3. Verify the release artifacts and the live database before deployment.

```bash
bash scripts/verify-release-safety.sh dist /var/www/viec-lam-gan-nha/data/applications.db
```

4. Back up the live database.

```bash
bash scripts/backup-db-safe.sh /var/www/viec-lam-gan-nha/data/applications.db /srv/backups/vlgn/db
```

5. Deploy only the frontend build output to the dedicated frontend target.

```bash
bash scripts/deploy-frontend-safe.sh dist /var/www/viec-lam-gan-nha-frontend
```

6. Reload Nginx after checking the config.

```bash
sudo nginx -t
sudo systemctl reload nginx
```

7. Verify public endpoints.

```bash
curl -I https://vieclamgannha.me/
curl -I https://vieclamgannha.me/viec-lam
curl -I https://vieclamgannha.me/admin.html
curl -I https://vieclamgannha.me/api/jobs
```

## Database Rules

- Never overwrite the live DB with an older backup unless the restore is intentional and approved.
- Never treat a database restore as a frontend deploy step.
- If the code expects a new column, add it with a migration or `ALTER TABLE ... ADD COLUMN ...`.
- Do not replace live data just because a schema is missing a column.

## Nginx Rules

- Keep one active config for the site.
- Do not leave duplicate `server_name` blocks enabled.
- Keep static assets and app shell served from the intended frontend target.
- If the homepage or SPA route returns the wrong status, fix Nginx routing before touching app code.

## What Not To Do

- Do not run `rsync --delete dist/ /var/www/viec-lam-gan-nha/`.
- Do not copy build output into the live root that also contains backend or data folders.
- Do not `git reset --hard` on a dirty VPS repo unless you know exactly what local drift is safe to discard.
- Do not restore an old SQLite file over a newer live DB just to satisfy a build or route error.

## Recommended Automation

The repo already includes safety scripts:

- `scripts/verify-release-safety.sh`
- `scripts/backup-db-safe.sh`
- `scripts/deploy-frontend-safe.sh`
- `scripts/deploy-release-safe.sh`

Use `scripts/deploy-release-safe.sh` when you want the full safe flow in one place.

## Quick Mental Model

Think in three separate layers:

- Code layer: Git pull from `admin-phase7-mobile-pwa`
- Build layer: `dist/` output from `npm run build`
- Data layer: live SQLite DB plus backups and migrations

If one layer fails, do not "fix" it by overwriting another layer.
