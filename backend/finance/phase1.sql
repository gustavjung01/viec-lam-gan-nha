-- PHASE 1 FINANCE LEDGER CORE

CREATE TABLE IF NOT EXISTS users_wallet (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  available_balance BIGINT DEFAULT 0,
  pending_balance BIGINT DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'VND',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL,
  amount BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL,
  source_type VARCHAR(50),
  source_id UUID,
  meta JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fin_tx_user ON financial_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_source ON financial_transactions(source_type, source_id);
