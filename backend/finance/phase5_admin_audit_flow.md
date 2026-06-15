# Finance Phase 5 - Audit, reconciliation, and admin overview

Phase 5 adds the finance control layer for admin reporting, audit logs, reconciliation, and alerts.

## Scope

- Finance audit logs
- Reconciliation runs
- Reconciliation mismatch items
- Daily finance snapshots
- Finance alerts
- Admin finance overview contract

This phase is schema and workflow contract only. It does not modify live frontend behavior.

## Admin overview metrics

```txt
Total revenue
Paid job orders
Pending job orders
Approved commissions
Pending commissions
Paid withdrawals
Pending withdrawals
Wallet available total
Wallet pending total
Open finance alerts
Reconciliation mismatch count
```

## Reconciliation checks

```txt
Paid job order without ledger transaction
Ledger transaction without source record
Commission approved without ledger transaction
Withdrawal paid without debit ledger transaction
Duplicate ledger source_type/source_id
Payment intent succeeded but order not paid
Payout item paid but withdrawal not paid
Amount mismatch between source and ledger
```

## API contract

```txt
GET  /api/admin/finance/overview
GET  /api/admin/finance/audit-logs
GET  /api/admin/finance/alerts
POST /api/admin/finance/alerts/:id/acknowledge
POST /api/admin/finance/alerts/:id/resolve
POST /api/admin/finance/reconciliation-runs
GET  /api/admin/finance/reconciliation-runs
GET  /api/admin/finance/reconciliation-runs/:id
GET  /api/admin/finance/reconciliation-runs/:id/items
POST /api/admin/finance/reconciliation-items/:id/ignore
POST /api/admin/finance/reconciliation-items/:id/mark-fixed
GET  /api/admin/finance/daily-snapshots
```

## Reconciliation flow

1. Admin starts reconciliation for a date range.
2. System creates `reconciliation_runs` with status `running`.
3. System scans job orders, payment intents, commissions, withdrawals, payout items, and ledger transactions.
4. System writes mismatch rows to `reconciliation_items`.
5. System updates aggregate totals on the run.
6. If mismatch count is zero, status becomes `completed`.
7. If mismatch exists, status still becomes `completed` but alerts are opened.

## Audit log rules

Every finance status change should create a `finance_audit_logs` row.

Examples:

```txt
job_order.confirm_payment
commission.approve
commission.reject
withdrawal.approve
withdrawal.reject
withdrawal.mark_paid
payout_batch.process
payout_batch.complete
reconciliation.start
reconciliation.resolve_item
```

## Alert rules

Create `finance_alerts` when:

```txt
Reconciliation has critical mismatch
Withdrawal is paid but no debit ledger exists
Commission is approved but no credit ledger exists
Payment succeeded but job order is still pending
Duplicate ledger source is detected
```

## Safety rules

- Audit logs should be append-only.
- Reconciliation items should not be deleted, only ignored or fixed.
- Alerts should not be deleted, only resolved or dismissed.
- Admin overview must calculate from ledger and source tables, not from frontend values.
- Any manual adjustment must create a ledger transaction with source_type = manual_adjustment.

## Next phase

Phase 6 should implement backend service code and routes for the finance engine.
