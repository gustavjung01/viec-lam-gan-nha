# Branching Model

Status: Canonical branch structure
Last updated: 2026-06-16

This document defines the long-term branch model for the Việc Làm Gần Nhà repository.

The repository is a monorepo:

```text
src/        Frontend React/Vite application
backend/    Backend Node/Express API
docs/       Project plans and operating documents
scripts/    Deploy, verification, backup, and maintenance scripts
infra/      Infrastructure templates when present
```

## 1. Canonical branches

The repository uses five long-lived branches:

```text
master
staging
frontend
backend
platform
```

Do not create long-lived `rebuild/*`, `develop`, `foundation`, `ops`, or `advanced` branches.

Short-lived task branches are allowed only when needed, and they must merge back into the correct long-lived branch.

## 2. Branch roles

### master

Production branch.

Purpose:

```text
- Stable production code only.
- Final release branch after staging passes.
- Production frontend and backend releases should be based on this branch.
```

Rules:

```text
- No direct commits.
- No experiments.
- No emergency live patch commits unless explicitly approved.
- Merge only from staging after build, smoke test, and rollback checklist pass.
```

### staging

Pre-production integration branch.

Purpose:

```text
- Test combined frontend, backend, and platform changes before production.
- Run staging or preview deployments.
- Catch integration bugs before merging to master.
```

Rules:

```text
- frontend, backend, and platform must merge here before master.
- Do not treat staging as a scratchpad.
- Staging must remain deployable.
```

### frontend

Frontend branch.

Purpose:

```text
- React/Vite UI work.
- Vercel frontend configuration.
- Public job pages.
- Admin UI.
- Company UI.
- CTV UI.
- Candidate/apply UI.
- Frontend PWA work when re-enabled.
```

Allowed scope:

```text
src/
public/
index.html
vite.config.*
package.json and frontend build config when relevant
Vercel frontend config when relevant
frontend assets/styles
```

Do not change here:

```text
- backend business logic
- production DB migration
- VPS systemd service files
- Nginx backend API vhosts
- backend deployment scripts unless purely frontend-related
```

### backend

Backend/API branch.

Purpose:

```text
- Node/Express API work.
- Business logic.
- Auth middleware.
- Lead/application APIs.
- Company APIs.
- CTV APIs.
- Campaign APIs.
- Finance APIs.
- Notification API endpoints.
- Database access layer.
- API validation.
- health/version/db-health endpoints.
```

Allowed scope:

```text
backend/
backend/src/routes/
backend/src/middleware/
backend/src/services/
backend/src/db/ or backend/src/database/ when present
backend/src/migrations/ when present
backend/scripts/ when backend-specific
backend tests when present
```

Do not change here:

```text
- frontend UI
- Vercel frontend-only settings
- VPS Nginx/systemd deployment templates
- production backup/cutover scripts unless they are backend-local helpers
```

### platform

Infrastructure and operations branch.

Purpose:

```text
- VPS backend hub structure.
- Nginx API vhosts.
- systemd service templates.
- deploy scripts.
- backup scripts.
- env matrix and examples.
- PostgreSQL migration/cutover plan.
- CI/CD.
- monitoring and release checklist.
- operational docs.
```

Allowed scope:

```text
docs/*infra*
docs/*deploy*
docs/*database*
docs/*branch*
docs/*release*
scripts/deploy*
scripts/verify*
scripts/backup*
scripts/restore*
infra/
.env.example files when defining environment structure
```

Do not change here:

```text
- product UI features
- backend business feature logic
- API route behavior unless required only for deploy/config compatibility
```

## 3. Database ownership

Database files and database code are different things.

```text
Live DB/runtime data       -> no branch, outside Git
DB schema/migration code   -> backend
DB cutover/backup/infra    -> platform
DB seed/mock data          -> backend or platform depending on use
DB backup files            -> no branch, outside Git
```

### Live DB/runtime data

The real production database file is runtime data, not code.

Current temporary live SQLite path:

```text
/var/www/viec-lam-gan-nha/data/applications.db
```

Never commit these files:

```text
*.db
*.sqlite
*.sqlite3
*.db-wal
*.db-shm
*.sql.gz
*.dump
production .env files
```

### DB code in backend

Put application DB logic in `backend`:

```text
- schema used by app
- migration scripts executed by backend
- query/repository layer
- validation before DB write
- API read/write behavior
- db-health endpoint
```

### DB operations in platform

Put operational DB work in `platform`:

```text
- SQLite to PostgreSQL migration plan
- backup scripts
- restore scripts
- Heroku Postgres or managed Postgres setup notes
- DATABASE_URL / DATABASE_PATH matrix
- cutover checklist
- rollback checklist
- monitoring checks
```

## 4. Merge flow

All work must pass through staging before production.

```text
frontend  -> staging -> master
backend   -> staging -> master
platform  -> staging -> master
```

Do not merge directly:

```text
frontend -> master
backend  -> master
platform -> master
```

## 5. Short-lived task branches

Use short-lived branches only for focused work.

Examples:

```text
feature/admin-lead-list       -> based on frontend or backend depending on scope
feature/company-campaigns     -> based on frontend/backend split as needed
fix/api-health                -> based on backend
infra/nginx-api-domain        -> based on platform
infra/postgres-migration      -> based on platform
```

Rules:

```text
- Delete short-lived branches after merge.
- Do not deploy production directly from short-lived branches.
- Do not create vague names like fix-final, test-vps, final-final.
```

## 6. Work classification

Use this table before choosing a branch.

| Work type | Branch |
|---|---|
| React UI, pages, styling, admin/company/CTV UI | frontend |
| Vercel frontend build/config | frontend |
| API routes, middleware, business logic | backend |
| DB access/query/migration code used by app | backend |
| Live DB file, backup dump, production env | no branch, outside Git |
| VPS backend hub, Nginx, systemd | platform |
| Deploy scripts, backup scripts, env matrix | platform |
| SQLite to PostgreSQL cutover procedure | platform |
| Combined pre-production testing | staging |
| Production release | master |

## 7. Release checklist

Before merging staging into master:

```text
1. Frontend build passes.
2. Backend install/test or smoke check passes.
3. /api/health returns 200.
4. /api/version returns expected commit/version if available.
5. /api/db-health returns OK if available.
6. Nginx config test passes when platform changed.
7. DB backup exists before migration/cutover.
8. Rollback command is documented.
9. No production secrets are committed.
10. No database files are committed.
```

## 8. Final rule

When unsure:

```text
UI goes to frontend.
API and app DB code go to backend.
VPS, deploy, Nginx, systemd, env, backup, and DB cutover go to platform.
Everything must pass staging before master.
```
