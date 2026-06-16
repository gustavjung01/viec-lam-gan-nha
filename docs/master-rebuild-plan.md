# Master Rebuild Plan - Việc Làm Gần Nhà

Status: Canonical planning document
Last updated: 2026-06-16

This document replaces older partial plans and VPS repair procedures. It is the single planning source for the next rebuild pass. Do not use old plan/procedure files as the source of truth unless this document explicitly references them.

## 0. Decision

We are not patching the current live stack piece by piece.

Current rule:

```text
NO live edits.
NO blind rollback.
NO direct DB writes.
NO deploy until audit and architecture are agreed.
NO frontend/backend/PWA/notification changes in the same step.
```

The current repo is treated as the latest code snapshot for audit. It is not automatically treated as production-safe.

## 1. Deprecated planning files

The following files are superseded by this document and should not guide new work:

```text
docs/repair-plan-admin-lead-notification.md
backend/finance/phase2_api_plan.md
docs/safe-vps-release-procedure.md
```

Reason:

- They describe partial repairs against the old single-VPS/static-Nginx/SQLite deployment.
- They do not reflect the new target architecture: Vercel frontend, separated backend API, separated database, workers, backup/monitoring, and staging.
- They encourage local/VPS deploy thinking, while the new direction is release discipline and environment separation.

If these files are still present, either delete them in a cleanup commit or move them under an archive folder such as:

```text
docs/archive/old-plans/
```

Do not keep them beside the canonical plan without a deprecation note.

## 2. Current audit summary

Known live/system findings from audit:

```text
- Public API is alive: /api/health and /api/jobs return 200.
- Live database still has data.
- Frontend live build does not match current repo HEAD.
- Backend has previously run against both the real DB path and a backend/data DB path.
- Nginx has shown duplicate server_name warnings.
- PWA/service worker is active and can keep stale assets during bad releases.
- OneSignal/admin bridge changes are mixed into frontend boot paths.
- OneSignal backend env has had placeholder-style config in systemd drop-ins.
```

Main diagnosis:

```text
The product is not only broken by code bugs. The release model is broken.
Frontend, backend, DB, PWA, Nginx, env, and runtime files are too tightly mixed.
```

## 3. Target architecture

### 3.1 Frontend

```text
Platform: Vercel
Domain: vieclamgannha.me
Preview: Vercel preview deployments
Framework: Vite React
API base: https://api.vieclamgannha.me
```

Frontend rules:

```text
- No frontend static deploy through VPS/Nginx after migration.
- No rsync dist/ to production web root.
- No hardcoded same-origin /api unless Vercel rewrites are intentionally configured.
- PWA and OneSignal must be disabled or safe-mode until core web is stable.
```

### 3.2 Backend API

```text
Platform: VPS-2
Domain: api.vieclamgannha.me
Runtime: Node/Express via systemd
Proxy: Nginx API-only reverse proxy
```

Backend rules:

```text
- Backend VPS does not serve frontend static files.
- Backend production does not create or use backend/data/applications.db.
- Backend must expose /api/health, /api/version, /api/db-health.
- Backend must reject unsafe production DB configuration.
- Backend must use strict CORS for Vercel production and preview domains.
```

### 3.3 Database

Recommended target:

```text
Platform: VPS-1
Database: PostgreSQL
```

Reason:

```text
The desired architecture separates DB from backend. SQLite is file-based and is not a clean fit for multi-server production. If the DB is on a separate VPS, move to PostgreSQL instead of mounting a SQLite file over the network.
```

Migration rule:

```text
SQLite remains source of truth until a verified PostgreSQL migration is complete.
No production cutover without row counts, schema checks, smoke tests, and rollback plan.
```

### 3.4 Worker / Cron / Notification

```text
Platform: VPS-3
Scope:
- Lead SLA engine
- OneSignal push delivery
- Telegram bot jobs
- Scheduled cleanup
- Retry jobs
```

Rule:

```text
API handles requests. Worker handles background work.
```

### 3.5 Backup / Monitoring / Logs

```text
Platform: VPS-4
Scope:
- PostgreSQL backup archive
- Restore drills
- Uptime checks
- Central logs
- Error reports
```

### 3.6 Staging / Sandbox

```text
Platform: VPS-5 or lightweight staging VPS
Domains:
- staging.vieclamgannha.me
- api-staging.vieclamgannha.me
```

Use staging before production for DB migration, admin/company/CTV flows, PWA, and notification tests.

## 4. Repo cleanup plan

### 4.1 Planning cleanup

Action:

```text
- Keep this file: docs/master-rebuild-plan.md
- Delete or archive old partial planning docs
- Add a short docs/README.md pointing to this file
```

Files to review/remove/archive:

```text
docs/repair-plan-admin-lead-notification.md
backend/finance/phase2_api_plan.md
docs/safe-vps-release-procedure.md
```

### 4.2 Script cleanup

Old VPS repair/deploy scripts must be reviewed before reuse because the target architecture changes.

Review list:

```text
scripts/repair-vps-admin-frontend.sh
scripts/deploy-frontend-safe.sh
scripts/deploy-release-safe.sh
scripts/verify-release-safety.sh
scripts/backup-db-safe.sh
infra/nginx/viec-lam-gan-nha.conf.example
```

New rule:

```text
- Frontend deploy scripts should not be production-critical after moving to Vercel.
- Backend deploy scripts should only deploy API to VPS-2.
- DB migration scripts must be separate from app deploy scripts.
- Nginx examples must be API-only for VPS-2 after cutover.
```

### 4.3 Runtime path cleanup

Audit and remove assumptions around:

```text
/var/www/viec-lam-gan-nha-frontend
/var/www/viec-lam-gan-nha/backend/data/applications.db
/var/www/viec-lam-gan-nha-source/backend/data/applications.db
```

Production runtime should use:

```text
DATABASE_URL=postgres://...
```

During transition only:

```text
DATABASE_PATH=/var/www/viec-lam-gan-nha/data/applications.db
```

## 5. Rebuild phases

### Phase 0 - Freeze and baseline

Goal: preserve evidence and prevent further drift.

Tasks:

```text
1. Tag current repo state: audit-current-master.
2. Backup live SQLite DB.
3. Backup current Nginx configs.
4. Backup systemd service/drop-ins.
5. Backup env files with secrets redacted in audit notes.
6. Export DB schema and row counts.
7. Record current frontend build-info and backend commit/version.
```

Acceptance:

```text
- Current state can be restored if needed.
- We know exactly what is live.
- No code has been changed during audit.
```

### Phase 1 - Repo and config separation

Goal: make the repo understandable before migration.

Tasks:

```text
1. Document frontend env keys.
2. Document backend env keys.
3. Document worker env keys.
4. Document DB env keys.
5. Add API base configuration for frontend.
6. Remove/disable frontend imports that should not run at core boot:
   - admin OneSignal bootstrap
   - adminCompanyActionBridge monkey patch
   - PWA auto-update if it can affect core boot
7. Add /api/version and /api/db-health.
```

Acceptance:

```text
- npm run build passes.
- Backend starts locally with explicit env.
- Frontend can target a configurable API URL.
- Core public pages do not depend on PWA/OneSignal/admin bridge.
```

### Phase 2 - Frontend to Vercel

Goal: move public frontend out of VPS static hosting.

Tasks:

```text
1. Create Vercel project from GitHub repo.
2. Configure production env.
3. Configure preview env.
4. Set VITE_API_BASE_URL to API domain.
5. Deploy preview first.
6. Verify Home, Jobs, Job Detail, Apply.
7. Point domain to Vercel only after preview passes.
```

Acceptance:

```text
- vieclamgannha.me serves from Vercel.
- Frontend deployment is tied to Git commit.
- No manual rsync frontend deploy remains in production flow.
```

### Phase 3 - Backend API to VPS-2

Goal: create a clean API host.

Tasks:

```text
1. Provision VPS-2.
2. Install Node runtime.
3. Deploy backend only.
4. Configure systemd service.
5. Configure Nginx for api.vieclamgannha.me only.
6. Add strict CORS for Vercel domains.
7. Verify /api/health, /api/version, /api/db-health.
```

Acceptance:

```text
- api.vieclamgannha.me responds through VPS-2.
- Backend does not serve frontend files.
- Backend does not use backend/data DB.
```

### Phase 4 - Database migration

Goal: move from SQLite to PostgreSQL safely.

Tasks:

```text
1. Export SQLite schema.
2. Design PostgreSQL schema.
3. Create migrations.
4. Import data into staging PostgreSQL.
5. Compare row counts and critical sample rows.
6. Point staging backend at PostgreSQL.
7. Test all critical API flows.
8. Schedule production cutover.
```

Acceptance:

```text
- Counts match for applications, companies, ctv_accounts, campaigns, lead_submissions, platform_fees, ctv_payouts.
- Key flows work against PostgreSQL.
- Rollback plan exists before production cutover.
```

### Phase 5 - Core product flows

Goal: restore business value before advanced features.

Priority order:

```text
1. Candidate view jobs and apply.
2. Admin login and view leads.
3. Company registration/profile/dashboard.
4. Company create campaign.
5. CTV registration/dashboard/campaign list/submit lead.
6. Admin approve/reject/company/CTV/campaign/lead status.
7. Finance and payouts.
```

Acceptance:

```text
- Each flow has API smoke tests.
- Each UI flow has manual test steps.
- No active UI button calls a missing endpoint.
```

### Phase 6 - Worker and notification

Goal: reintroduce background features safely.

Tasks:

```text
1. Move Lead SLA engine to worker.
2. Move Telegram bot jobs to worker where appropriate.
3. Keep notification inbox independent from push delivery.
4. Configure OneSignal only after backend/worker/env are correct.
5. Add retry and failure logs.
```

Acceptance:

```text
- Lead creation does not fail if OneSignal fails.
- Inbox rows are created before push attempts.
- Worker can be restarted without affecting public API.
```

### Phase 7 - PWA

Goal: add install/update experience only after core is stable.

Tasks:

```text
1. Keep service worker disabled or minimal until final verification.
2. Rebuild service worker as a versioned, non-destructive update layer.
3. Test normal browser and installed PWA separately.
4. Test iOS install path separately.
```

Acceptance:

```text
- Browser web cannot become white-screened by stale PWA cache.
- PWA update flow is observable and reversible.
```

### Phase 8 - CI/CD and operations

Goal: prevent the same drift from returning.

Tasks:

```text
1. GitHub branch protection.
2. Vercel preview for frontend PRs.
3. Backend deploy script/action for VPS-2.
4. DB migration command with status table.
5. Smoke test command after each deploy.
6. Release checklist.
7. Monitoring and backup restore drill.
```

Acceptance:

```text
- Every production release has commit SHA, deploy log, smoke result, and rollback note.
```

## 6. Module-specific notes

### Admin lead notification

Old repair work may contain useful fixes, but it is not the guiding plan anymore.

Keep concept:

```text
- Inbox row before push.
- Push failure must not break lead registration.
- Admin lead refresh must not be tab-gated.
```

Revalidate implementation in the new backend/worker split.

### Finance phase 2

Old finance API plan is useful as raw material only.

Finance must not be rebuilt until:

```text
- User/company/CTV core flows are stable.
- DB migration strategy is fixed.
- Ledger schema is reviewed for PostgreSQL.
```

### Campaign creation

Known schema mismatch area:

```text
- platform_fee_percentage
- visibility values
- wallet transaction types
- campaign status values
```

Campaign creation must be covered by API tests before enabling company dashboard production use.

## 7. Required audit still pending

Before editing implementation, complete these audits:

```text
1. Repo file map: frontend, backend, scripts, infra, docs.
2. Hardcoded API/path/env scan.
3. Full SQLite schema export.
4. Runtime file inventory from live VPS.
5. UI endpoint map: every fetch path used by frontend.
6. Backend route map: every Express route mounted.
7. Nginx/domain map before Vercel cutover.
8. Secrets/env matrix.
```

## 8. Stop conditions

Stop work immediately if any of these happens:

```text
- A command would overwrite the live DB.
- A command deploys frontend and backend together without separate smoke tests.
- A migration has no backup and rollback path.
- A fix touches PWA/OneSignal while debugging core web blank screen.
- Frontend and backend release SHAs cannot be identified.
```

## 9. Immediate next action

Do not edit product code yet.

Next valid PR/commit should only do documentation cleanup:

```text
1. Keep this canonical plan.
2. Delete or archive old partial plan files.
3. Add docs/README.md pointing to this plan.
4. Add an audit checklist file if needed.
```

After that, start Phase 0 audit and tagging.
