# SQLite to Heroku Postgres migration runbook

This runbook prepares a data import into the isolated `vlgn` schema without cutting over live traffic.

## Safety rules

- Do not set `DATABASE_URL` on the VPS runtime before cutover.
- Do not run `DROP`, `DELETE`, or `TRUNCATE` against the live SQLite database.
- Keep SQLite as the source of truth until count checks pass and cutover is approved.
- Run the migration scripts from a controlled local or staging machine first, not from the live service process.

## 1. Back up SQLite

```bash
mkdir -p /srv/backups/vlgn/pre-pg-import/$(date +%Y%m%d_%H%M%S)
cp /var/www/viec-lam-gan-nha/data/applications.db /srv/backups/vlgn/pre-pg-import/$(date +%Y%m%d_%H%M%S)/applications.db
```

## 2. Audit SQLite source

```bash
cd backend
SQLITE_DB_PATH=/path/to/applications.db npm run db:audit:sqlite > sqlite-audit.json
```

## 3. Dry-run migration plan

```bash
cd backend
SQLITE_DB_PATH=/path/to/applications.db \
DATABASE_URL='postgres://...' \
npm run db:migrate:sqlite-to-pg > pg-import-dry-run.json
```

Dry-run prints source tables, source counts, shared columns, and existing target tables. It does not write to Postgres.

## 4. Import into `vlgn`

Only run this after reviewing the dry-run output.

```bash
cd backend
SQLITE_DB_PATH=/path/to/applications.db \
DATABASE_URL='postgres://...' \
MIGRATE_WRITE=1 \
npm run db:migrate:sqlite-to-pg > pg-import-result.json
```

The import script creates app tables in `vlgn` using the backend initialization path, inserts rows with `ON CONFLICT DO NOTHING`, and resets Postgres serial sequences. It refuses to write if the target schema already contains base tables unless `MIGRATE_ALLOW_EXISTING_TARGET=1` is explicitly set.

## 5. Verify before cutover

Compare `source_count`, `inserted`, and `target_after` in `pg-import-result.json`. Do not cut over until mismatches are understood.

## 6. Cutover is a separate phase

After verification, schedule a short write-free window, back up SQLite again, run a final import, then set `DATABASE_URL` on the runtime and restart `vlgn-api.service`.
