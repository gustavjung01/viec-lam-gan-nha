-- Marketplace Database Schema
-- Phase 3-lite: Lead engine với SQLite

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    company_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    province TEXT,
    district TEXT,
    tax_code TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
        wallet_balance INTEGER DEFAULT 0,
    credit_limit INTEGER DEFAULT 10000000,
    trust_level TEXT DEFAULT 'normal' CHECK (trust_level IN ('normal', 'verified', 'priority', 'vip')),
    deposit_status TEXT DEFAULT 'none' CHECK (deposit_status IN ('none', 'pending', 'partial', 'confirmed', 'waived')),
    lead_trial_limit INTEGER DEFAULT 2,
    require_deposit_after_leads INTEGER DEFAULT 2,
    is_featured INTEGER DEFAULT 0,
    plan_code TEXT DEFAULT 'free' CHECK (plan_code IN ('free', 'basic', 'pro', 'vip')),
    free_job_posts_limit INTEGER DEFAULT 5,
    weekly_push_limit INTEGER DEFAULT 5,
    used_job_posts_count INTEGER DEFAULT 0,
    used_push_count INTEGER DEFAULT 0,
    push_week_start DATETIME,
    plan_expired_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CTV Accounts table
CREATE TABLE IF NOT EXISTS ctv_accounts (
    id TEXT PRIMARY KEY,
    ctv_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    zalo_phone TEXT,
    bank_account TEXT,
    bank_name TEXT,
    id_card_number TEXT,
    province TEXT,
    district TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'banned')),
    trust_score INTEGER DEFAULT 100,
    total_earned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    campaign_code TEXT UNIQUE NOT NULL,
    company_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    job_type TEXT,
    location TEXT,
    province TEXT,
    district TEXT,
    salary_text TEXT,
    shift_text TEXT,
    quantity_needed INTEGER DEFAULT 1,
    requirements TEXT, -- JSON array
    visibility TEXT DEFAULT 'ctv_private' CHECK (visibility IN ('draft', 'public_candidate', 'ctv_private', 'internal')),
    is_public INTEGER DEFAULT 0,
    ctv_enabled INTEGER DEFAULT 0,
    bounty_amount INTEGER NOT NULL, -- Total amount
    ctv_reward_amount INTEGER NOT NULL, -- 80% = bounty * 0.8
    platform_fee_amount INTEGER NOT NULL, -- 20% = bounty * 0.2
    qualification_days INTEGER DEFAULT 7, -- Days to auto qualify hired leads
    sla_enabled INTEGER DEFAULT 1,
    sla_approved_response_hours INTEGER DEFAULT 6, -- Company must confirm approved lead
    sla_claimed_interview_hours INTEGER DEFAULT 24, -- Company must move claimed lead to interviewing
    sla_interviewing_result_hours INTEGER DEFAULT 72, -- Company must report interview result
    sla_reminder_before_minutes INTEGER DEFAULT 60,
    sla_auto_reclaim_enabled INTEGER DEFAULT 0, -- Safe default: admin handles overdue manually
    sla_auto_transfer_enabled INTEGER DEFAULT 0, -- Reserved for future transfer routing
    max_leads INTEGER DEFAULT 50,
    current_leads INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'paused', 'closed')),
    start_date DATE,
    end_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Candidates table (normalized phone info)
CREATE TABLE IF NOT EXISTS candidates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    normalized_phone TEXT NOT NULL UNIQUE,
    zalo_phone TEXT,
    birth_year INTEGER,
    age_range TEXT,
    province TEXT,
    district TEXT,
    desired_job TEXT,
    desired_shift TEXT,
    available_date TEXT,
    note TEXT,
    consent_status TEXT DEFAULT 'pending' CHECK (consent_status IN ('pending', 'granted', 'revoked')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Lead Submissions table
CREATE TABLE IF NOT EXISTS lead_submissions (
    id TEXT PRIMARY KEY,
    lead_code TEXT UNIQUE NOT NULL,
    campaign_id TEXT NOT NULL,
    ctv_id TEXT,
    source_type TEXT DEFAULT 'ctv',
    owner_type TEXT DEFAULT 'ctv',
    assigned_admin_id TEXT,
    assignment_method TEXT,
    source_metadata TEXT,
    candidate_id TEXT NOT NULL,
    status TEXT DEFAULT 'submitted' CHECK (status IN ('new', 'submitted', 'approved', 'claimed', 'interviewing', 'hired', 'qualified', 'rejected', 'disputed', 'paid')),
    is_anonymous INTEGER DEFAULT 1, -- 1 = true, 0 = false
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    claimed_at DATETIME,
    claimed_by_company_id TEXT,
    qualified_at DATETIME,
    rejected_at DATETIME,
    rejected_reason TEXT,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (ctv_id) REFERENCES ctv_accounts(id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id),
    FOREIGN KEY (claimed_by_company_id) REFERENCES companies(id)
);

-- Lead Claims table (audit trail)
CREATE TABLE IF NOT EXISTS lead_claims (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    claimed_by_role TEXT,
    claimed_by_id TEXT,
    bounty_paid INTEGER DEFAULT 0, -- Amount deducted from wallet
    FOREIGN KEY (lead_id) REFERENCES lead_submissions(id),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Lead Status History table
CREATE TABLE IF NOT EXISTS lead_status_history (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by_role TEXT,
    changed_by_id TEXT,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES lead_submissions(id)
);

-- Lead SLA Events table (dedupe reminders/overdue/auto actions)
CREATE TABLE IF NOT EXISTS lead_sla_events (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    campaign_id TEXT,
    event_key TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL,
    due_at DATETIME,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES lead_submissions(id),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- Platform Fees table (20%)
CREATE TABLE IF NOT EXISTS platform_fees (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    fee_amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'invoiced', 'paid')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    invoiced_at DATETIME,
    paid_at DATETIME,
    FOREIGN KEY (lead_id) REFERENCES lead_submissions(id),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- CTV Payouts table (80%)
CREATE TABLE IF NOT EXISTS ctv_payouts (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    ctv_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    payout_amount INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'paid', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    paid_at DATETIME,
    transaction_reference TEXT,
    FOREIGN KEY (lead_id) REFERENCES lead_submissions(id),
    FOREIGN KEY (ctv_id) REFERENCES ctv_accounts(id),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- Wallet Transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'lead_claim', 'refund')),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reference_id TEXT, -- lead_id or other reference
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL, -- 'lead', 'campaign', 'company', 'ctv'
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_role TEXT,
    actor_id TEXT,
    details TEXT, -- JSON
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Phone Lock table (anti-duplicate)
CREATE TABLE IF NOT EXISTS phone_locks (
    id TEXT PRIMARY KEY,
    normalized_phone TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    lead_id TEXT NOT NULL,
    locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME, -- Cooldown expiration
    UNIQUE(normalized_phone, campaign_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON lead_submissions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_ctv ON lead_submissions(ctv_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON lead_submissions(status);
CREATE INDEX IF NOT EXISTS idx_leads_company ON lead_submissions(claimed_by_company_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_company ON campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_candidates_phone ON candidates(normalized_phone);
CREATE INDEX IF NOT EXISTS idx_phone_locks ON phone_locks(normalized_phone, campaign_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_wallet_company ON wallet_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_lead_sla_events_lead ON lead_sla_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_sla_events_key ON lead_sla_events(event_key);
