# Finance Phase 3 - CTV referral to commission flow

Phase 3 adds the affiliate and headhunt foundation for CTV referrals and commission tracking.

## Main flow

1. CTV creates and shares a referral link.
2. Candidate opens the link.
3. System creates a referral record with status `clicked`.
4. Candidate applies to a job.
5. Referral status becomes `applied`.
6. Employer or admin marks candidate as `hired`.
7. Commission rule creates a pending commission.
8. Admin approves commission.
9. System creates a confirmed credit transaction for the CTV in `financial_transactions`.

## Referral lifecycle

```txt
clicked -> applied -> interviewed -> hired
clicked -> applied -> rejected
clicked -> cancelled
```

## Commission lifecycle

```txt
pending -> approved -> paid
pending -> rejected
pending -> cancelled
```

## API contract

```txt
POST /api/ctv/referral-links
POST /api/referrals/track-click
POST /api/applications/:applicationId/attach-referral
POST /api/admin/referrals/:referralId/status
POST /api/admin/commissions/calculate
POST /api/admin/commissions/:commissionId/approve
POST /api/admin/commissions/:commissionId/reject
GET  /api/ctv/commissions
GET  /api/ctv/referrals
GET  /api/ctv/referral-links
```

## Ledger bridge on approval

```txt
user_id = ctv_id
type = credit
amount = commission.amount
status = confirmed
source_type = ctv_commission
source_id = commission.id
```

## Safety rules

- One application should have one active referral attribution.
- Do not create duplicate commission for the same referral and trigger event.
- Referral code must belong to an active CTV.
- Commission amount must come from `commission_rules`, not frontend input.
- Admin approval must write a `commission_events` audit row.
- Ledger creation must be idempotent by source type and source id.
