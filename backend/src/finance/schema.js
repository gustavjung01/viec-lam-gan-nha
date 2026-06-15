export async function initFinanceSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users_wallet (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
      available_balance INTEGER DEFAULT 0,
      pending_balance INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'VND',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS financial_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
      amount INTEGER NOT NULL CHECK (amount > 0),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'failed', 'rejected')),
      source_type TEXT,
      source_id TEXT,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmed_at DATETIME,
      cancelled_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS finance_packages (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      currency TEXT DEFAULT 'VND',
      job_post_limit INTEGER DEFAULT 1,
      boost_days INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS job_orders (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      package_id TEXT,
      job_id TEXT,
      order_code TEXT NOT NULL UNIQUE,
      amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'VND',
      status TEXT NOT NULL DEFAULT 'pending',
      payment_method TEXT,
      payment_provider TEXT,
      payment_reference TEXT,
      expires_at DATETIME,
      paid_at DATETIME,
      cancelled_at DATETIME,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (package_id) REFERENCES finance_packages(id)
    );

    CREATE TABLE IF NOT EXISTS payment_intents (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'VND',
      status TEXT NOT NULL DEFAULT 'pending',
      provider TEXT NOT NULL,
      provider_reference TEXT,
      checkout_url TEXT,
      raw_payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (order_id) REFERENCES job_orders(id)
    );

    CREATE TABLE IF NOT EXISTS payment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_intent_id TEXT,
      order_id TEXT,
      provider TEXT,
      event_type TEXT NOT NULL,
      event_id TEXT,
      payload TEXT,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      FOREIGN KEY (payment_intent_id) REFERENCES payment_intents(id),
      FOREIGN KEY (order_id) REFERENCES job_orders(id)
    );

    CREATE TABLE IF NOT EXISTS ctv_referral_links (
      id TEXT PRIMARY KEY,
      ctv_id TEXT NOT NULL,
      job_id TEXT,
      code TEXT NOT NULL UNIQUE,
      target_url TEXT,
      click_count INTEGER DEFAULT 0,
      application_count INTEGER DEFAULT 0,
      hired_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ctv_referrals (
      id TEXT PRIMARY KEY,
      ctv_id TEXT NOT NULL,
      referral_link_id TEXT,
      candidate_id TEXT,
      job_id TEXT NOT NULL,
      application_id TEXT,
      referral_code TEXT,
      status TEXT NOT NULL DEFAULT 'clicked',
      source_ip_hash TEXT,
      user_agent_hash TEXT,
      clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      applied_at DATETIME,
      interviewed_at DATETIME,
      hired_at DATETIME,
      rejected_at DATETIME,
      cancelled_at DATETIME,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (referral_link_id) REFERENCES ctv_referral_links(id)
    );

    CREATE TABLE IF NOT EXISTS commission_rules (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'VND',
      trigger_event TEXT NOT NULL,
      hold_days INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      starts_at DATETIME,
      ends_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ctv_commissions (
      id TEXT PRIMARY KEY,
      referral_id TEXT NOT NULL,
      ctv_id TEXT NOT NULL,
      candidate_id TEXT,
      job_id TEXT NOT NULL,
      application_id TEXT,
      rule_id TEXT,
      amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'VND',
      status TEXT NOT NULL DEFAULT 'pending',
      eligible_at DATETIME,
      approved_at DATETIME,
      rejected_at DATETIME,
      paid_at DATETIME,
      ledger_transaction_id INTEGER,
      rejection_reason TEXT,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (referral_id) REFERENCES ctv_referrals(id),
      FOREIGN KEY (rule_id) REFERENCES commission_rules(id),
      FOREIGN KEY (ledger_transaction_id) REFERENCES financial_transactions(id)
    );

    CREATE TABLE IF NOT EXISTS commission_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referral_id TEXT,
      commission_id TEXT,
      event_type TEXT NOT NULL,
      actor_user_id TEXT,
      payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (referral_id) REFERENCES ctv_referrals(id),
      FOREIGN KEY (commission_id) REFERENCES ctv_commissions(id)
    );

    CREATE TABLE IF NOT EXISTS withdrawal_methods (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      method_type TEXT NOT NULL DEFAULT 'bank_transfer',
      account_holder TEXT NOT NULL,
      bank_name TEXT,
      bank_branch TEXT,
      bank_account_number TEXT,
      wallet_provider TEXT,
      wallet_phone TEXT,
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      verified_at DATETIME,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS withdrawal_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      withdrawal_method_id TEXT,
      amount INTEGER NOT NULL,
      fee INTEGER DEFAULT 0,
      net_amount INTEGER NOT NULL,
      currency TEXT DEFAULT 'VND',
      status TEXT NOT NULL DEFAULT 'pending',
      request_note TEXT,
      admin_note TEXT,
      approved_by TEXT,
      rejected_by TEXT,
      processed_by TEXT,
      rejection_reason TEXT,
      ledger_transaction_id INTEGER,
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME,
      rejected_at DATETIME,
      processing_at DATETIME,
      paid_at DATETIME,
      cancelled_at DATETIME,
      failed_at DATETIME,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (withdrawal_method_id) REFERENCES withdrawal_methods(id),
      FOREIGN KEY (ledger_transaction_id) REFERENCES financial_transactions(id)
    );

    CREATE TABLE IF NOT EXISTS payout_batches (
      id TEXT PRIMARY KEY,
      batch_code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'draft',
      total_amount INTEGER DEFAULT 0,
      total_fee INTEGER DEFAULT 0,
      total_net_amount INTEGER DEFAULT 0,
      item_count INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'VND',
      provider TEXT,
      provider_reference TEXT,
      created_by TEXT,
      processed_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processing_at DATETIME,
      completed_at DATETIME,
      failed_at DATETIME,
      cancelled_at DATETIME,
      meta TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payout_batch_items (
      id TEXT PRIMARY KEY,
      payout_batch_id TEXT NOT NULL,
      withdrawal_request_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      fee INTEGER DEFAULT 0,
      net_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      provider_reference TEXT,
      failure_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      paid_at DATETIME,
      failed_at DATETIME,
      meta TEXT,
      FOREIGN KEY (payout_batch_id) REFERENCES payout_batches(id),
      FOREIGN KEY (withdrawal_request_id) REFERENCES withdrawal_requests(id)
    );

    CREATE TABLE IF NOT EXISTS withdrawal_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      withdrawal_request_id TEXT,
      payout_batch_id TEXT,
      event_type TEXT NOT NULL,
      actor_user_id TEXT,
      payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (withdrawal_request_id) REFERENCES withdrawal_requests(id),
      FOREIGN KEY (payout_batch_id) REFERENCES payout_batches(id)
    );

    CREATE TABLE IF NOT EXISTS finance_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      before_data TEXT,
      after_data TEXT,
      ip_hash TEXT,
      user_agent_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reconciliation_runs (
      id TEXT PRIMARY KEY,
      run_code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      period_start DATETIME NOT NULL,
      period_end DATETIME NOT NULL,
      total_ledger_credit INTEGER DEFAULT 0,
      total_ledger_debit INTEGER DEFAULT 0,
      total_job_order_paid INTEGER DEFAULT 0,
      total_commission_approved INTEGER DEFAULT 0,
      total_withdrawal_paid INTEGER DEFAULT 0,
      mismatch_count INTEGER DEFAULT 0,
      started_by TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      failed_at DATETIME,
      failure_reason TEXT,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reconciliation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reconciliation_run_id TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      item_type TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      expected_amount INTEGER,
      actual_amount INTEGER,
      status TEXT NOT NULL DEFAULT 'open',
      note TEXT,
      payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      resolved_by TEXT,
      FOREIGN KEY (reconciliation_run_id) REFERENCES reconciliation_runs(id)
    );

    CREATE TABLE IF NOT EXISTS finance_daily_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_date TEXT NOT NULL UNIQUE,
      total_revenue INTEGER DEFAULT 0,
      total_refunds INTEGER DEFAULT 0,
      total_commission_pending INTEGER DEFAULT 0,
      total_commission_approved INTEGER DEFAULT 0,
      total_commission_paid INTEGER DEFAULT 0,
      total_withdrawal_pending INTEGER DEFAULT 0,
      total_withdrawal_paid INTEGER DEFAULT 0,
      total_wallet_available INTEGER DEFAULT 0,
      total_wallet_pending INTEGER DEFAULT 0,
      active_ctv_count INTEGER DEFAULT 0,
      paying_company_count INTEGER DEFAULT 0,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS finance_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning',
      entity_type TEXT,
      entity_id TEXT,
      title TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      assigned_to TEXT,
      acknowledged_by TEXT,
      resolved_by TEXT,
      payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      acknowledged_at DATETIME,
      resolved_at DATETIME,
      dismissed_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_fin_tx_user ON financial_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_fin_tx_source ON financial_transactions(source_type, source_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_tx_source_unique ON financial_transactions(source_type, source_id) WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_fin_packages_active ON finance_packages(is_active, sort_order);
    CREATE INDEX IF NOT EXISTS idx_job_orders_company ON job_orders(company_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_job_orders_status ON job_orders(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ctv_commissions_ctv ON ctv_commissions(ctv_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON withdrawal_requests(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_finance_audit_entity ON finance_audit_logs(entity_type, entity_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reconciliation_items_run ON reconciliation_items(reconciliation_run_id, severity, status);
    CREATE INDEX IF NOT EXISTS idx_finance_alerts_status ON finance_alerts(status, severity, created_at DESC);
  `);

  await seedFinanceDefaults(db);
}

async function seedFinanceDefaults(db) {
  await db.run(`
    INSERT OR IGNORE INTO finance_packages (id, code, name, description, price, job_post_limit, boost_days, sort_order)
    VALUES
      ('pkg_basic_499k', 'basic_499k', 'Gói cơ bản 499k', 'Đăng tin tuyển dụng cơ bản', 499000, 1, 0, 10),
      ('pkg_premium_799k', 'premium_799k', 'Gói nổi bật 799k', 'Đăng tin kèm ưu tiên hiển thị', 799000, 1, 7, 20),
      ('pkg_vip_999k', 'vip_999k', 'Gói VIP 999k', 'Đăng tin VIP và boost dài ngày', 999000, 1, 14, 30)
  `);

  await db.run(`
    INSERT OR IGNORE INTO commission_rules (id, code, name, description, amount, trigger_event, hold_days)
    VALUES
      ('rule_guard_hired_basic', 'guard_hired_basic', 'Hoa hồng bảo vệ nhận việc', 'CTV được ghi nhận khi ứng viên được tuyển', 100000, 'hired', 0),
      ('rule_labor_hired_basic', 'labor_hired_basic', 'Hoa hồng lao động phổ thông nhận việc', 'CTV được ghi nhận khi ứng viên được tuyển', 100000, 'hired', 0),
      ('rule_probation_passed_bonus', 'probation_passed_bonus', 'Thưởng qua thử việc', 'CTV được thưởng thêm khi ứng viên qua thử việc', 200000, 'probation_passed', 7)
  `);
}
