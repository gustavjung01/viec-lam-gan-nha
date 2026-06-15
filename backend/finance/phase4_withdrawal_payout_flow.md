# Finance Phase 4 - Withdrawal and payout flow

Phase 4 adds the CTV withdrawal and payout foundation.

## Scope

- Saved withdrawal methods
- Withdrawal requests
- Admin approval and rejection
- Payout batches
- Payout batch items
- Withdrawal event audit trail
- Debit ledger bridge to Phase 1 transactions

This phase is schema and workflow contract only. It does not send money automatically until payout provider integration is added.

## Main flow

1. CTV has confirmed commission balance.
2. CTV adds a withdrawal method.
3. CTV creates a withdrawal request.
4. System validates available balance.
5. Admin approves or rejects the request.
6. Approved request enters payout processing.
7. Admin or provider marks payout as paid.
8. System creates confirmed debit transaction in `financial_transactions`.
9. Withdrawal request stores `ledger_transaction_id` for audit.

## Withdrawal lifecycle

```txt
pending -> approved -> processing -> paid
pending -> rejected
pending -> cancelled
processing -> failed
failed -> processing -> paid
```

## Payout batch lifecycle

```txt
draft -> processing -> completed
draft -> cancelled
processing -> failed
```

## API contract

```txt
GET  /api/ctv/withdrawal-methods
POST /api/ctv/withdrawal-methods
PATCH /api/ctv/withdrawal-methods/:id
POST /api/ctv/withdrawals
GET  /api/ctv/withdrawals
GET  /api/ctv/withdrawals/:id
POST /api/ctv/withdrawals/:id/cancel

GET  /api/admin/finance/withdrawals
POST /api/admin/finance/withdrawals/:id/approve
POST /api/admin/finance/withdrawals/:id/reject
POST /api/admin/finance/payout-batches
POST /api/admin/finance/payout-batches/:id/process
POST /api/admin/finance/payout-batches/:id/complete
POST /api/admin/finance/payout-batches/:id/fail
```

## Ledger bridge when paid

```txt
user_id = withdrawal.user_id
type = debit
amount = withdrawal.amount
status = confirmed
source_type = withdrawal
source_id = withdrawal.id
```

## Balance rule

Available balance must be calculated from confirmed ledger transactions.

```txt
available = confirmed credits - confirmed debits - pending approved withdrawals
```

## Safety rules

- Client must not decide available balance.
- Server must validate balance before creating withdrawal request.
- Server must validate balance again before approval.
- Withdrawal request cannot be paid twice.
- Debit ledger transaction must be idempotent by `source_type = withdrawal` and `source_id = withdrawal.id`.
- Bank or wallet data should be masked in admin lists.
- Every status change must write a `withdrawal_events` row.

## Next phase

Phase 5 should add audit reports, reconciliation, fraud checks, and admin finance overview.
