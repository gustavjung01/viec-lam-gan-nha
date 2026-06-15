# Finance Phase 6 - Backend service and API routes

Phase 6 turns the Phase 1-5 finance schema into usable backend code for the current Express + SQLite backend.

## Added files

```txt
backend/src/finance/schema.js
backend/src/finance/ledgerService.js
backend/src/finance/reportService.js
backend/src/routes/finance.js
backend/scripts/mount-finance-routes.cjs
```

## Why there is a mount helper

The live backend runs from `backend/server.js`, which is a large single Express entrypoint. The helper script updates `server.js` idempotently by adding:

```js
import financeRoutes from './src/routes/finance.js';
app.use('/api/finance', financeRoutes);
```

The script is safe to run multiple times.

## API endpoints

### Public health

```txt
GET /api/finance/health
```

Creates the finance SQLite tables if they are missing and returns module health.

### Admin schema init

```txt
POST /api/finance/admin/migrate
```

Requires admin auth. Initializes all finance tables and seed package/rule data.

### Admin overview

```txt
GET /api/finance/admin/overview
```

Requires admin auth. Returns revenue, commission, withdrawal, wallet, alert, and reconciliation summary.

### Admin reconciliation

```txt
GET  /api/finance/admin/reconciliation
POST /api/finance/admin/reconciliation-runs
```

Requires admin auth. Creates and reads reconciliation runs.

### Wallet and ledger

```txt
GET  /api/finance/wallet/:userId
GET  /api/finance/transactions/:userId
GET  /api/finance/transactions/id/:id
POST /api/finance/transactions
POST /api/finance/transactions/:id/confirm
POST /api/finance/transactions/:id/cancel
```

All ledger write/read endpoints require admin auth for this phase.

## Transaction payload

```json
{
  "userId": "ctv-or-company-id",
  "type": "credit",
  "amount": 100000,
  "status": "pending",
  "sourceType": "ctv_commission",
  "sourceId": "commission-id",
  "meta": {
    "note": "approved commission"
  }
}
```

Allowed transaction types:

```txt
credit
debit
```

Allowed statuses:

```txt
pending
confirmed
cancelled
failed
rejected
```

## Deployment note

After pulling the branch on VPS source repo, run:

```bash
cd /var/www/viec-lam-gan-nha-source/backend
node scripts/mount-finance-routes.cjs
```

Then sync backend to the live backend folder and restart the systemd service.

## Test commands

```bash
curl -sS http://localhost:3001/api/health
curl -sS http://localhost:3001/api/finance/health
```

For admin endpoints, pass either a bearer admin session or the legacy token header:

```bash
curl -sS -H "x-admin-token: $ADMIN_API_TOKEN" http://localhost:3001/api/finance/admin/overview
```
