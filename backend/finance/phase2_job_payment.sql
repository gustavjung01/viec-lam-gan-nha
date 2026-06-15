-- PHASE 2 FINANCE: COMPANY JOB PAYMENT CORE
-- Depends on backend/finance/phase1.sql

CREATE TABLE IF NOT EXISTS finance_packages (
  id UUID PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price BIGINT NOT NULL,
  currency VARCHAR(10) DEFAULT 'VND',
  job_post_limit INTEGER DEFAULT 1,
  boost_days INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_orders (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  package_id UUID REFERENCES finance_packages(id),
  job_id UUID,
  order_code VARCHAR(50) NOT NULL UNIQUE,
  amount BIGINT NOT NULL,
  currency VARCHAR(10) DEFAULT 'VND',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | paid | cancelled | expired | refunded
  payment_method VARCHAR(50),
  payment_provider VARCHAR(50),
  payment_reference TEXT,
  expires_at TIMESTAMP,
  paid_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  meta JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES job_orders(id),
  company_id UUID NOT NULL,
  amount BIGINT NOT NULL,
  currency VARCHAR(10) DEFAULT 'VND',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending | processing | succeeded | failed | cancelled
  provider VARCHAR(50) NOT NULL,
  provider_reference TEXT,
  checkout_url TEXT,
  raw_payload JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_events (
  id BIGSERIAL PRIMARY KEY,
  payment_intent_id UUID REFERENCES payment_intents(id),
  order_id UUID REFERENCES job_orders(id),
  provider VARCHAR(50),
  event_type VARCHAR(100) NOT NULL,
  event_id TEXT,
  payload JSONB,
  received_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fin_packages_active ON finance_packages(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_job_orders_company ON job_orders(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_orders_status ON job_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_orders_job ON job_orders(job_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_order ON payment_intents(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_provider_event ON payment_events(provider, event_id);

-- Optional seed packages. Replace UUIDs if your migration tool requires generated IDs.
-- INSERT INTO finance_packages (id, code, name, description, price, job_post_limit, boost_days, sort_order)
-- VALUES
--   ('00000000-0000-0000-0000-000000000499', 'basic_499k', 'Gói cơ bản 499k', 'Đăng tin tuyển dụng cơ bản', 499000, 1, 0, 10),
--   ('00000000-0000-0000-0000-000000000799', 'premium_799k', 'Gói nổi bật 799k', 'Đăng tin kèm ưu tiên hiển thị', 799000, 1, 7, 20),
--   ('00000000-0000-0000-0000-000000000999', 'vip_999k', 'Gói VIP 999k', 'Đăng tin VIP và boost dài ngày', 999000, 1, 14, 30)
-- ON CONFLICT (code) DO NOTHING;
