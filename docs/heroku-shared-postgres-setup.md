# Heroku Shared Postgres Setup

Status: Setup plan before migration
Branch owner: platform
Last updated: 2026-06-16

This document defines the safe setup for using the existing Heroku Postgres database as a shared database for multiple small websites.

## 1. Existing Heroku resource

```text
Heroku app: data-total
Postgres add-on: postgresql-closed-73486
Plan: Essential-0
Current use: existing small website database
```

The existing database must not be reset, restored over, detached, destroyed, or promoted during VLGN setup.

## 2. Goal

Use the same Heroku Postgres instance for multiple small websites by separating each app into its own schema.

```text
postgresql-closed-73486
  public     existing app data, do not touch
  vlgn       Việc Làm Gần Nhà schema, new and isolated
  web2       future website schema
  web3       future website schema
```

## 3. Safe first action

Only create an empty schema for VLGN:

```sql
CREATE SCHEMA IF NOT EXISTS vlgn;
COMMENT ON SCHEMA vlgn IS 'Việc Làm Gần Nhà isolated schema';
```

Do not import SQLite data yet.
Do not change the production backend env yet.
Do not set `DATABASE_URL` on the VPS yet.

## 4. Required backup before setup

A manual Heroku Postgres backup must exist before creating or changing schema.

Current known backup from UI:

```text
Backup name: b1
Status: finished
```

## 5. What is allowed now

```text
- Verify database health
- Verify manual backup exists
- Create schema vlgn
- List schemas
- List existing tables without changing them
```

## 6. What is forbidden now

```text
- DROP SCHEMA
- DROP TABLE
- DELETE
- TRUNCATE
- ALTER TABLE public.*
- RESET DATABASE
- RESTORE BACKUP
- DESTROY ADD-ON
- DETACH ADD-ON
- ROTATE CREDENTIALS
- SET VPS production DATABASE_URL
- Import VLGN SQLite data
```

## 7. Verification SQL

```sql
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name IN ('public', 'vlgn')
ORDER BY schema_name;

SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename;
```

Expected after setup:

```text
public exists and keeps old tables
vlgn exists and is empty
```

## 8. Environment plan for later

When VLGN is ready to use Postgres, the VPS env will eventually include:

```text
DATABASE_URL=<Heroku Postgres DATABASE_URL>
DATABASE_SCHEMA=vlgn
PGSSLMODE=require
PG_POOL_MAX=3
```

This is not applied during schema creation.

## 9. Migration comes later

The real migration happens later and must be handled in a separate backend/platform change:

```text
1. Export/backup SQLite live DB
2. Build Postgres schema/migration code in backend branch
3. Test import into vlgn schema
4. Verify row counts and API behavior
5. Update staging env only
6. Cutover production after rollback plan is ready
```
