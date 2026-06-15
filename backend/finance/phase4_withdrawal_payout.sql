-- PHASE 4 FINANCE: WITHDRAWAL AND PAYOUT CORE
-- Depends on Phase 1 ledger and Phase 3 CTV commission schema.

CREATE TABLE IF NOT EXISTS withdrawal_methods (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  method_type VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
  -- bank_transfer | momo | zalopay | cash
  account_holder TEXT NOT NULL,
  bank_name TEXT,
  bank_branch TEXT,
  bank_account_number TEXT,
  wallet_provider TEXT,
  wallet_phone TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  verified_at TIMESTAMP,
  meta JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  withdrawal_method_id UUID REFERENCES withdrawal_methods(id),
  amount BIGINT NOT NULL,
  fee BIGINT DEFAULT 0,
  net_amount BIGINT NOT NULL,
  currency VARCHAR(10) DEFAULT 'VND',
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- pending | approved | rejected | processing | paid | cancelled | failed
  request_note TEXT,
  admin_note TEXT,
  approved_by UUID,
  rejected_by UUID,
  processed_by UUID,
  rejection_reason TEXT,
  ledger_transaction_id BIGINT REFERENCES financial_transactions(id),
  requested_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  processing_at TIMESTAMP,
  paid_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  failed_at TIMESTAMP,
  meta JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payout_batches (
  id UUID PRIMARY KEY,
  batch_code VARCHAR(80) NOT NULL UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  -- draft | processing | completed | failed | cancelled
  total_amount BIGINT DEFAULT 0,
  total_fee BIGINT DEFAULT 0,
  total_net_amount BIGINT DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'VND',
  provider VARCHAR(50),
  provider_reference TEXT,
  created_by UUID,
  processed_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  processing_at TIMESTAMP,
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  meta JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payout_batch_items (
  id UUID PRIMARY KEY,
  payout_batch_id UUID NOT NULL REFERENCES payout_batches(id),
  withdrawal_request_id UUID NOT NULL REFERENCES withdrawal_requests(id),
  user_id UUID NOT NULL,
  amount BIGINT NOT NULL,
  fee BIGINT DEFAULT 0,
  net_amount BIGINT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- pending | processing | paid | failed | cancelled
  provider_reference TEXT,
  failure_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  paid_at TIMESTAMP,
  failed_at TIMESTAMP,
  meta JSONB
);

CREATE TABLE IF NOT EXISTS withdrawal_events (
  id BIGSERIAL PRIMARY KEY,
  withdrawal_request_id UUID REFERENCES withdrawal_requests(id),
  payout_batch_id UUID REFERENCES payout_batches(id),
  event_type VARCHAR(100) NOT NULL,
  actor_user_id UUID,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_methods_user ON withdrawal_methods(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON withdrawal_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_ledger ON withdrawal_requests(ledger_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON payout_batches(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_batch_items_batch ON payout_batch_items(payout_batch_id);
CREATE INDEX IF NOT EXISTS idx_payout_batch_items_request ON payout_batch_items(withdrawal_request_id);
CREATE INDEX IF NOT EXISTS idx_payout_batch_items_user ON payout_batch_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_events_request ON withdrawal_events(withdrawal_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_events_batch ON withdrawal_events(payout_batch_id, created_at DESC);
