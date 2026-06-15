-- PHASE 3 FINANCE: CTV REFERRAL AND COMMISSION CORE
-- Depends on phase1 ledger and phase2 job payment schema.

CREATE TABLE IF NOT EXISTS ctv_referral_links (
  id UUID PRIMARY KEY,
  ctv_id UUID NOT NULL,
  job_id UUID,
  code VARCHAR(80) NOT NULL UNIQUE,
  target_url TEXT,
  click_count INTEGER DEFAULT 0,
  application_count INTEGER DEFAULT 0,
  hired_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ctv_referrals (
  id UUID PRIMARY KEY,
  ctv_id UUID NOT NULL,
  referral_link_id UUID REFERENCES ctv_referral_links(id),
  candidate_id UUID,
  job_id UUID NOT NULL,
  application_id UUID,
  referral_code VARCHAR(80),
  status VARCHAR(30) NOT NULL DEFAULT 'clicked',
  -- clicked | applied | interviewed | hired | rejected | cancelled
  source_ip_hash TEXT,
  user_agent_hash TEXT,
  clicked_at TIMESTAMP DEFAULT NOW(),
  applied_at TIMESTAMP,
  interviewed_at TIMESTAMP,
  hired_at TIMESTAMP,
  rejected_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  meta JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commission_rules (
  id UUID PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  amount BIGINT NOT NULL,
  currency VARCHAR(10) DEFAULT 'VND',
  trigger_event VARCHAR(50) NOT NULL,
  -- applied | hired | probation_passed
  hold_days INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ctv_commissions (
  id UUID PRIMARY KEY,
  referral_id UUID NOT NULL REFERENCES ctv_referrals(id),
  ctv_id UUID NOT NULL,
  candidate_id UUID,
  job_id UUID NOT NULL,
  application_id UUID,
  rule_id UUID REFERENCES commission_rules(id),
  amount BIGINT NOT NULL,
  currency VARCHAR(10) DEFAULT 'VND',
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- pending | approved | rejected | cancelled | paid
  eligible_at TIMESTAMP,
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  paid_at TIMESTAMP,
  ledger_transaction_id BIGINT REFERENCES financial_transactions(id),
  rejection_reason TEXT,
  meta JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commission_events (
  id BIGSERIAL PRIMARY KEY,
  referral_id UUID REFERENCES ctv_referrals(id),
  commission_id UUID REFERENCES ctv_commissions(id),
  event_type VARCHAR(100) NOT NULL,
  actor_user_id UUID,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctv_referral_links_ctv ON ctv_referral_links(ctv_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ctv_referral_links_job ON ctv_referral_links(job_id);
CREATE INDEX IF NOT EXISTS idx_ctv_referrals_ctv ON ctv_referrals(ctv_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ctv_referrals_job ON ctv_referrals(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ctv_referrals_candidate ON ctv_referrals(candidate_id);
CREATE INDEX IF NOT EXISTS idx_ctv_referrals_application ON ctv_referrals(application_id);
CREATE INDEX IF NOT EXISTS idx_ctv_referrals_status ON ctv_referrals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commission_rules_active ON commission_rules(is_active, trigger_event);
CREATE INDEX IF NOT EXISTS idx_ctv_commissions_ctv ON ctv_commissions(ctv_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ctv_commissions_status ON ctv_commissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ctv_commissions_referral ON ctv_commissions(referral_id);
CREATE INDEX IF NOT EXISTS idx_ctv_commissions_ledger ON ctv_commissions(ledger_transaction_id);
CREATE INDEX IF NOT EXISTS idx_commission_events_referral ON commission_events(referral_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commission_events_commission ON commission_events(commission_id, created_at DESC);

-- Optional seed rules. Replace UUIDs if your migration tool requires generated IDs.
-- INSERT INTO commission_rules (id, code, name, description, amount, trigger_event, hold_days)
-- VALUES
--   ('10000000-0000-0000-0000-000000000001', 'guard_hired_basic', 'Hoa hồng bảo vệ nhận việc', 'CTV được ghi nhận khi ứng viên được tuyển', 100000, 'hired', 0),
--   ('10000000-0000-0000-0000-000000000002', 'labor_hired_basic', 'Hoa hồng lao động phổ thông nhận việc', 'CTV được ghi nhận khi ứng viên được tuyển', 100000, 'hired', 0),
--   ('10000000-0000-0000-0000-000000000003', 'probation_passed_bonus', 'Thưởng qua thử việc', 'CTV được thưởng thêm khi ứng viên qua thử việc', 200000, 'probation_passed', 7)
-- ON CONFLICT (code) DO NOTHING;
