-- PHASE 5 FINANCE: AUDIT, RECONCILIATION, AND ADMIN OVERVIEW
-- Depends on Phase 1 ledger, Phase 2 job payment, Phase 3 commission, Phase 4 payout.

CREATE TABLE IF NOT EXISTS finance_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id UUID,
  actor_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id TEXT,
  before_data JSONB,
  after_data JSONB,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id UUID PRIMARY KEY,
  run_code VARCHAR(80) NOT NULL UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- pending | running | completed | failed | cancelled
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  total_ledger_credit BIGINT DEFAULT 0,
  total_ledger_debit BIGINT DEFAULT 0,
  total_job_order_paid BIGINT DEFAULT 0,
  total_commission_approved BIGINT DEFAULT 0,
  total_withdrawal_paid BIGINT DEFAULT 0,
  mismatch_count INTEGER DEFAULT 0,
  started_by UUID,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  failure_reason TEXT,
  meta JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reconciliation_items (
  id BIGSERIAL PRIMARY KEY,
  reconciliation_run_id UUID NOT NULL REFERENCES reconciliation_runs(id),
  severity VARCHAR(30) NOT NULL DEFAULT 'info',
  -- info | warning | critical
  item_type VARCHAR(100) NOT NULL,
  -- missing_ledger | amount_mismatch | duplicate_source | orphan_payment | orphan_payout
  entity_type VARCHAR(80),
  entity_id TEXT,
  expected_amount BIGINT,
  actual_amount BIGINT,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  -- open | ignored | fixed
  note TEXT,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by UUID
);

CREATE TABLE IF NOT EXISTS finance_daily_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL UNIQUE,
  total_revenue BIGINT DEFAULT 0,
  total_refunds BIGINT DEFAULT 0,
  total_commission_pending BIGINT DEFAULT 0,
  total_commission_approved BIGINT DEFAULT 0,
  total_commission_paid BIGINT DEFAULT 0,
  total_withdrawal_pending BIGINT DEFAULT 0,
  total_withdrawal_paid BIGINT DEFAULT 0,
  total_wallet_available BIGINT DEFAULT 0,
  total_wallet_pending BIGINT DEFAULT 0,
  active_ctv_count INTEGER DEFAULT 0,
  paying_company_count INTEGER DEFAULT 0,
  meta JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finance_alerts (
  id BIGSERIAL PRIMARY KEY,
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(30) NOT NULL DEFAULT 'warning',
  -- info | warning | critical
  entity_type VARCHAR(80),
  entity_id TEXT,
  title TEXT NOT NULL,
  message TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  -- open | acknowledged | resolved | dismissed
  assigned_to UUID,
  acknowledged_by UUID,
  resolved_by UUID,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  resolved_at TIMESTAMP,
  dismissed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_finance_audit_actor ON finance_audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_audit_entity ON finance_audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_period ON reconciliation_runs(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_status ON reconciliation_runs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliation_items_run ON reconciliation_items(reconciliation_run_id, severity, status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_items_entity ON reconciliation_items(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_finance_alerts_status ON finance_alerts(status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_alerts_entity ON finance_alerts(entity_type, entity_id);
