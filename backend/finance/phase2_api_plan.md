# Finance Phase 2 - Job payment plan

Phase 2 adds the company-side payment foundation for paid job posting packages.

## Scope

- Finance packages for 499k / 799k / 999k style plans
- Job orders created by companies before payment
- Payment intents created for external providers or manual transfer
- Payment events for webhook/audit tracking
- Ledger bridge from successful order payment to `financial_transactions`

This phase is schema and API contract only. It does not turn on real payment collection until provider integration is added.

## Order lifecycle

```txt
pending -> paid -> refunded
pending -> expired
pending -> cancelled
```

## Payment intent lifecycle

```txt
pending -> processing -> succeeded
pending -> failed
pending -> cancelled
```

## API contract

### Public/company package list

```txt
GET /api/finance/packages
```

Returns active finance packages ordered by `sort_order`.

### Create job order

```txt
POST /api/company/job-orders
```

Server decides the amount from `finance_packages`. Client must not send trusted amount.

```json
{
  "packageCode": "basic_499k",
  "jobId": "uuid-optional"
}
```

### Create payment intent

```txt
POST /api/company/job-orders/:orderId/payment-intents
```

```json
{
  "provider": "manual_bank_transfer"
}
```

### Confirm order payment, admin/provider only

```txt
POST /api/admin/finance/job-orders/:orderId/confirm-payment
```

On success:

1. Mark `payment_intents.status = succeeded`
2. Mark `job_orders.status = paid`
3. Create confirmed platform revenue ledger transaction
4. Unlock/publish paid job feature if connected later

### Cancel order

```txt
POST /api/company/job-orders/:orderId/cancel
```

Allowed only while order is pending.

### Admin order list

```txt
GET /api/admin/finance/job-orders?status=pending
GET /api/admin/finance/payment-events?orderId=uuid
```

## Ledger bridge

When a job order becomes paid, create one ledger record:

```txt
user_id: company_id
transaction type: debit
amount: order.amount
status: confirmed
source_type: job_order
source_id: order.id
meta: package code, provider, payment_reference
```

If later a platform revenue account is added, create the matching credit transaction for that internal platform account.

## Safety rules

- Never trust amount from frontend.
- Only server reads package price.
- Payment webhook must be idempotent by `(provider, event_id)`.
- Do not mark an order paid without a payment intent or admin audit reason.
- Every paid order must have a ledger `source_type = job_order`.
