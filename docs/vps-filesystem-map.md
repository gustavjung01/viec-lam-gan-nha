# VPS Filesystem Map

Snapshot target: Ubuntu VPS for `vieclamgannha.me`

## Purpose

This file gives a readable map of the VPS filesystem so another person can understand:
- Where the app source lives
- Where the live web files live
- Where Nginx and systemd configs are stored
- Where backups and temp artifacts are located

## Top-Level `/` Structure

```text
/
|-- bin -> usr/bin
|-- boot
|-- dev
|-- etc
|-- home
|-- lib -> usr/lib
|-- lib32 -> usr/lib32
|-- lib64 -> usr/lib64
|-- libx32 -> usr/libx32
|-- lost+found
|-- media
|-- mnt
|-- opt
|-- proc
|-- root
|-- run
|-- sbin -> usr/sbin
|-- snap
|-- srv
|-- swapfile
|-- sys
|-- tmp
|-- usr
`-- var
```

## Main Web App Locations

### Source repo
```text
/var/www/viec-lam-gan-nha-source
|-- backend/
|-- deploy-staging/
|-- dist/
|-- docs/
|-- e2e/
|-- infra/
|-- node_modules/
|-- public/
|-- scripts/
`-- src/
```

### Live web root
```text
/var/www/viec-lam-gan-nha
|-- assets/
|-- backend/
|   `-- data/
|-- data/
|-- images/
|-- js/
`-- admin.html, index.html, sw.js, manifest.webmanifest, build-info.json, ...
```

### Static frontend backup folder
```text
/var/www/viec-lam-gan-nha-frontend
|-- assets/
|-- images/
|-- js/
`-- static frontend build files
```

## Backend Source Layout

```text
/var/www/viec-lam-gan-nha-source/backend
|-- finance/
|-- migrations/
|-- node_modules/
|-- scripts/
`-- src/
    |-- db/
    |-- finance/
    |-- middleware/
    |-- routes/
    |-- services/
    `-- utils/
```

### Important backend routes
- `account.js`
- `adminAuth.js`
- `apply.js`
- `candidates.js`
- `finance.js`
- `jobs.js`
- `marketplace.js`
- `matching.js`

## Frontend Source Layout

```text
/var/www/viec-lam-gan-nha-source/src
|-- components/
|-- config/
|-- contexts/
|-- data/
|-- hooks/
|-- lib/
|-- mocks/
|-- pages/
|-- types/
`-- app entry files
```

### Main page groups
- Public pages: home, jobs, job detail, employer landing, candidate profile, account
- CTV pages: landing, registration, dashboard, campaigns, commission
- Company pages: dashboard and profile views
- Admin pages: console, campaigns, leads, reports
- Legal pages: privacy, data deletion, legal frame

## Nginx Configuration

```text
/etc/nginx
|-- conf.d/
|-- disabled-sites/
|-- modules-available/
|-- modules-enabled/
|-- sites-available/
|-- sites-enabled/
`-- snippets/
```

### Relevant Nginx files
- `/etc/nginx/sites-available/viec-lam-gan-nha.conf`
- `/etc/nginx/sites-enabled/viec-lam-gan-nha.conf`
- Disabled/backup variants are stored under `/etc/nginx/disabled-sites/`

## systemd Configuration

```text
/etc/systemd/system
|-- viec-lam-gan-nha.service
|-- viec-lam-gan-nha.service.d/
|   |-- 20-admin-env.conf
|   `-- override.conf
`-- multi-user.target.wants/
    `-- viec-lam-gan-nha.service
```

### Service purpose
- Runs the backend Node.js process
- Points to the live backend under `/var/www/viec-lam-gan-nha/backend`
- Loads admin and OneSignal environment overrides

## Database and Backups

### Live database path
```text
/var/www/viec-lam-gan-nha/data/applications.db
```

### Backup paths
```text
/srv/backups/vlgn/db
/root/vlgn-db-final-restore-*/
/root/vlgn-db-restore-*/
```

### Notes
- The live DB is SQLite.
- `backend/data/applications.db` is a symlink/working path used by the service.

## Home Directories and Temporary Artifacts

```text
/home/ubuntu
|-- .cache/
|-- .config/
|   `-- clerk/
|-- .local/
|-- .npm/
|-- .ssh/
|-- $BACKUP_DIR/
|-- data/
|-- src/
`-- stray temp paths created by earlier shell commands
```

### Important note
Some odd-looking directories exist under `/home/ubuntu` because of earlier shell/script expansion issues during restoration and backup work. They are not part of the application design, but they are present on the VPS filesystem snapshot.

## Deployment & Staging Assets

```text
/var/www/viec-lam-gan-nha-source/deploy-staging
|-- backend/
|-- frontend/
|-- nginx/
|-- scripts/
|-- setup-vps.sh
|-- DEPLOY_README.md
`-- viec-lam-gan-nha.service
```

Purpose:
- Reference deployment bundle
- Helps reproduce the VPS deploy layout and nginx/systemd setup

## Documentation Folders

```text
/var/www/viec-lam-gan-nha-source/docs
|-- qa-screenshots/
|-- ui-reference/
|-- various product and implementation notes
`-- repository-structure-and-features.md
```

## Practical Summary

If someone is taking over this VPS, the mental model is:
1. **Source code** lives in `/var/www/viec-lam-gan-nha-source`
2. **Live static site** lives in `/var/www/viec-lam-gan-nha`
3. **Backend runtime** runs via systemd service `viec-lam-gan-nha.service`
4. **Nginx** is configured under `/etc/nginx`
5. **Database** is SQLite at `/var/www/viec-lam-gan-nha/data/applications.db`
6. **Backups** are kept under `/srv/backups/vlgn/db`

## Notes for Maintainers

- This is a VPS filesystem map, not just a git-tracked tree.
- Some folders are build output (`dist/`), node dependencies (`node_modules/`), or operational state (`data/`, backups, Nginx, systemd).
- For code review or change review, inspect the source repo separately from the live web root.
