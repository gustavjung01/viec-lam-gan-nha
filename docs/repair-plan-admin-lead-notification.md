# Repair plan: Admin, Lead, Notification, AI DB

Baseline: `master` at local/remote commit `f2e3e7f` is the current canonical branch.

This file records the confirmed repo-level defects found during the audit and the ordered repair plan. Do not revive old branches or merge stale branch code back into `master`.

## Confirmed defects

### P0: lead registration -> admin notification pipeline is broken

1. `backend/src/routes/apply.js` creates `applications`, bridges to `lead_submissions`, writes `lead_status_history`, writes `phone_locks`, writes `audit_logs`, then sends Telegram.
2. The same flow does not call `sendNotification()` for `role: 'admin'` after a lead is created.
3. Result: OneSignal can be fully configured but admin still receives no lead-new notification because no admin notification event is emitted.

Files:
- `backend/src/routes/apply.js`
- `backend/src/utils/notification.js`

### P0: notification subscription table is not guaranteed

1. `backend/src/utils/notification.js::subscribeUser()` writes to `notification_subscriptions`.
2. Main DB bootstrap in `backend/src/database.js` does not create `notification_subscriptions`.
3. Result: admin/browser subscription can fail with `no such table: notification_subscriptions`, or push has no targets.

Files:
- `backend/src/database.js`
- `backend/src/utils/notification.js`
- `backend/src/routes/adminAuth.js`

### P0: admin lead refresh is tab-gated

1. `src/pages/admin/useAdminConsole.ts` only refreshes leads when `activeTab === 'Lead'`.
2. Result: new registrations do not visibly update admin while admin is on overview/company/CTV/campaign/config tabs.

Files:
- `src/pages/admin/useAdminConsole.ts`

### P0: lead history route path mismatch

1. Frontend calls `/api/admin/leads/:id/history`.
2. Backend route currently lives inside `adminAuthRoutes`, mounted under `/api/admin/auth`, so the effective path is `/api/admin/auth/leads/:id/history`.
3. Result: admin lead history modal/API can 404.

Files:
- `src/pages/admin/useAdminConsole.ts`
- `backend/src/routes/adminAuth.js`
- `backend/server.js`

### P0: AI config reads/writes can use wrong DB

1. `backend/src/database.js` uses `process.env.DATABASE_PATH || backend/data/applications.db`.
2. `backend/src/aiConfigs.js` hard-codes `backend/data/applications.db` and ignores `DATABASE_PATH`.
3. Result: live backend can use one DB while AI config uses another DB.

Files:
- `backend/src/aiConfigs.js`
- `backend/src/database.js`

### P1: campaign creation schema mismatch

1. `backend/src/routes/marketplace.js` inserts `visibility = 'public'` or `visibility = 'ctv_public'`.
2. DB schema only allows `draft`, `public_candidate`, `ctv_private`, `internal`.
3. Route also inserts `platform_fee_percentage`, which is not part of the audited base campaign schema.
4. Result: company campaign creation can fail with CHECK constraint or missing column error.

Files:
- `backend/src/routes/marketplace.js`
- `backend/src/database.js`

### P1: wallet adjust schema mismatch

1. `wallet_transactions.transaction_type` only allows `deposit`, `withdrawal`, `lead_claim`, `refund`.
2. `backend/src/routes/marketplace.js` inserts `admin_adjustment`.
3. Result: admin wallet adjustment can fail with CHECK constraint.

Files:
- `backend/src/routes/marketplace.js`
- `backend/src/database.js`

### P1: status values are inconsistent

1. DB company statuses: `pending`, `active`, `suspended`.
2. DB CTV statuses: `pending`, `active`, `suspended`, `banned`.
3. Frontend/admin types expect `pending`, `active`, `rejected`, `blocked`.
4. Result: approve/reject/block UI and DB can drift.

Files:
- `backend/src/database.js`
- `src/pages/admin/types.ts`
- `backend/src/routes/adminConsole.js`
- `backend/src/routes/marketplace.js`

### P2: marketplace flow is incomplete

1. Current `backend/src/routes/marketplace.js` only contains a small subset: public jobs, company campaign create, admin company update, wallet deposit, wallet adjust.
2. Several business flows appear absent or truncated: full CTV flow, company lead claiming, lead status transitions, payout/finance actions.
3. Result: admin/company/CTV features can look present in UI but have no full backend spine.

Files:
- `backend/src/routes/marketplace.js`

### P2: finance routes may not be mounted

1. `backend/server.js` imports/mounts several route groups but audited server mount does not show `financeRoutes` mounted.
2. Result: finance UI can exist while finance API is unavailable.

Files:
- `backend/server.js`
- `backend/src/routes/finance.js`
- `backend/scripts/mount-finance-routes.cjs`

## Repair order

### Phase 1: restore the live admin lead spine

Goal: public registration appears in admin and triggers admin notification/inbox.

Tasks:
1. Add/ensure `notification_subscriptions` schema in `backend/src/database.js`.
2. Harden `backend/src/utils/notification.js` so `sendNotification()` always records inbox first and never breaks lead registration if OneSignal fails.
3. In `backend/src/routes/apply.js`, after a `lead_submissions` record is successfully created, call `sendNotification({ role: 'admin', title: 'Lead mới', ... })`.
4. Add enough metadata in notification data: `event`, `lead_id`, `lead_code`, `candidate_name`, `candidate_phone`, `campaign_id`, `company_code`.
5. Make admin refresh logic watch notification unread/new lead events and refresh Lead + Overview even when active tab is not `Lead`.

Acceptance checks:
- Submit a public application.
- `applications` row exists.
- `lead_submissions` row exists.
- `notification_inbox` row exists with `target_role='admin'`.
- Admin can see new lead without manual page reload.
- If OneSignal has a registered player id, push is attempted.
- If OneSignal target is absent/fails, admin inbox still has the notification.

### Phase 2: fix admin API mismatches

Tasks:
1. Expose lead history at `/api/admin/leads/:id/history` or change frontend to `/api/admin/auth/leads/:id/history`. Prefer backend route alias to preserve frontend contract.
2. Avoid letting one failing admin API collapse the whole admin screen. Load each admin section independently or preserve partial data with per-section errors.

Acceptance checks:
- Lead history opens from admin lead modal.
- One broken optional section does not blank all admin data.

### Phase 3: fix AI DB path

Tasks:
1. Update `backend/src/aiConfigs.js` to import/reuse `DB_PATH` from `database.js`, or calculate the exact same `process.env.DATABASE_PATH || ...` path.
2. Confirm AI Config CRUD and chatbot runtime use the same database.

Acceptance checks:
- AI config saved in admin exists in the same DB used by backend runtime.
- Chatbot reads the active config that admin saved.

### Phase 4: fix schema mismatches

Tasks:
1. Replace campaign visibility insert values:
   - public -> `public_candidate`
   - ctv_public -> `ctv_private`
2. Remove `platform_fee_percentage` insert unless migration guarantees the column exists.
3. Replace wallet adjustment transaction type with an allowed value or migrate CHECK safely to include `admin_adjustment`.
4. Standardize company/CTV statuses or add explicit mapper functions for UI values.

Acceptance checks:
- Company can create campaign.
- Admin can adjust wallet without SQLite CHECK error.
- Company/CTV status update and display are consistent.

### Phase 5: restore marketplace and finance flows

Tasks:
1. Audit missing endpoints from UI calls.
2. Rebuild marketplace route by route from the UI contract, not by copying stale branch files.
3. Mount finance routes only after checking schema and API contract.

Acceptance checks:
- Company/CTV/finance tabs call real endpoints and receive expected shapes.
- No silent 404s for active UI actions.

## Deployment rule

After each phase:
1. Commit to `master`.
2. Pull/update local canonical repo.
3. Pull/update VPS source.
4. Build frontend.
5. Restart backend.
6. Reload Nginx only if config changed.
7. Run API smoke checks before moving to the next phase.

## Smoke commands to prepare

Backend health:

```bash
curl -s https://vieclamgannha.me/api/health
```

Admin APIs after login token is available:

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" https://vieclamgannha.me/api/admin/leads?page=1\&limit=5
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" https://vieclamgannha.me/api/admin/auth/notifications
```

DB verification on VPS:

```bash
sqlite3 /var/www/viec-lam-gan-nha/data/applications.db "
.tables
SELECT COUNT(*) FROM applications;
SELECT COUNT(*) FROM lead_submissions;
SELECT COUNT(*) FROM notification_inbox;
SELECT COUNT(*) FROM notification_subscriptions;
"
```
