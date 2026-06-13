// Migration script for Phase 3-8 features
// Creates tables for commissions, payouts, anti-fraud, disputes, and trust scoring

import { openDb } from '../src/database.js';

async function migrate() {
  const db = await openDb();
  console.log('🔄 Starting Phase 3-8 migration...');

  try {
    // 1. commissions table (80/20 split, 14-day hold)
    await db.run(`
      CREATE TABLE IF NOT EXISTS commissions (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL,
        ctv_id TEXT NOT NULL,
        campaign_id TEXT,
        amount INTEGER NOT NULL,
        status TEXT DEFAULT 'held', -- held, available, payout_pending, paid, cancelled
        hold_until TEXT,
        released_at TEXT,
        paid_at TEXT,
        payout_request_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lead_id) REFERENCES lead_submissions(id),
        FOREIGN KEY (ctv_id) REFERENCES ctv_accounts(id)
      )
    `);
    console.log('✅ commissions table created');

    // 2. platform_fees table (20% platform cut)
    await db.run(`
      CREATE TABLE IF NOT EXISTS platform_fees (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lead_id) REFERENCES lead_submissions(id)
      )
    `);
    console.log('✅ platform_fees table created');

    // 3. payout_requests table
    await db.run(`
      CREATE TABLE IF NOT EXISTS payout_requests (
        id TEXT PRIMARY KEY,
        ctv_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        commission_ids TEXT, -- JSON array
        status TEXT DEFAULT 'pending', -- pending, approved, rejected
        bank_account TEXT,
        bank_name TEXT,
        requested_at TEXT,
        processed_at TEXT,
        processed_by TEXT,
        notes TEXT,
        FOREIGN KEY (ctv_id) REFERENCES ctv_accounts(id)
      )
    `);
    console.log('✅ payout_requests table created');

    // 4. dispute_resolutions table
    await db.run(`
      CREATE TABLE IF NOT EXISTS dispute_resolutions (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL,
        resolution TEXT NOT NULL, -- upheld, overturned, partial
        refund_bounty INTEGER DEFAULT 0,
        adjust_commission INTEGER DEFAULT 0,
        resolved_by TEXT,
        resolved_at TEXT,
        FOREIGN KEY (lead_id) REFERENCES lead_submissions(id)
      )
    `);
    console.log('✅ dispute_resolutions table created');

    // 5. ip_blocks table (anti-fraud)
    await db.run(`
      CREATE TABLE IF NOT EXISTS ip_blocks (
        id TEXT PRIMARY KEY,
        ip_address TEXT NOT NULL,
        reason TEXT,
        blocked_until TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ ip_blocks table created');

    // 6. fraud_alerts table
    await db.run(`
      CREATE TABLE IF NOT EXISTS fraud_alerts (
        id TEXT PRIMARY KEY,
        alert_type TEXT NOT NULL,
        details TEXT,
        ctv_id TEXT,
        lead_id TEXT,
        ip_address TEXT,
        fingerprint TEXT,
        status TEXT DEFAULT 'open', -- open, investigating, resolved, false_positive
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        resolved_at TEXT,
        FOREIGN KEY (ctv_id) REFERENCES ctv_accounts(id),
        FOREIGN KEY (lead_id) REFERENCES lead_submissions(id)
      )
    `);
    console.log('✅ fraud_alerts table created');

    // 7. Add trust_score and fraud_flags to ctv_accounts
    try {
      await db.run(`ALTER TABLE ctv_accounts ADD COLUMN trust_score INTEGER DEFAULT 100`);
      console.log('✅ Added trust_score to ctv_accounts');
    } catch (e) {
      console.log('ℹ️ trust_score column already exists');
    }

    try {
      await db.run(`ALTER TABLE ctv_accounts ADD COLUMN fraud_flags INTEGER DEFAULT 0`);
      console.log('✅ Added fraud_flags to ctv_accounts');
    } catch (e) {
      console.log('ℹ️ fraud_flags column already exists');
    }

    // 8. Add anti-fraud columns to lead_submissions
    try {
      await db.run(`ALTER TABLE lead_submissions ADD COLUMN submitted_ip TEXT`);
      console.log('✅ Added submitted_ip to lead_submissions');
    } catch (e) {
      console.log('ℹ️ submitted_ip column already exists');
    }

    try {
      await db.run(`ALTER TABLE lead_submissions ADD COLUMN user_agent TEXT`);
      console.log('✅ Added user_agent to lead_submissions');
    } catch (e) {
      console.log('ℹ️ user_agent column already exists');
    }

    try {
      await db.run(`ALTER TABLE lead_submissions ADD COLUMN fingerprint TEXT`);
      console.log('✅ Added fingerprint to lead_submissions');
    } catch (e) {
      console.log('ℹ️ fingerprint column already exists');
    }

    // 9. Add admin review columns to lead_submissions
    try {
      await db.run(`ALTER TABLE lead_submissions ADD COLUMN admin_reviewed_at TEXT`);
      console.log('✅ Added admin_reviewed_at to lead_submissions');
    } catch (e) {
      console.log('ℹ️ admin_reviewed_at column already exists');
    }

    try {
      await db.run(`ALTER TABLE lead_submissions ADD COLUMN admin_reviewer_id TEXT`);
      console.log('✅ Added admin_reviewer_id to lead_submissions');
    } catch (e) {
      console.log('ℹ️ admin_reviewer_id column already exists');
    }

    try {
      await db.run(`ALTER TABLE lead_submissions ADD COLUMN dispute_resolved_at TEXT`);
      console.log('✅ Added dispute_resolved_at to lead_submissions');
    } catch (e) {
      console.log('ℹ️ dispute_resolved_at column already exists');
    }

    // 10. Create indexes for performance
    await db.run(`CREATE INDEX IF NOT EXISTS idx_commissions_ctv ON commissions(ctv_id, status)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_commissions_lead ON commissions(lead_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_payout_ctv ON payout_requests(ctv_id, status)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_fraud_alerts_ctv ON fraud_alerts(ctv_id, status)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_ip_blocks_ip ON ip_blocks(ip_address, blocked_until)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_leads_ip ON lead_submissions(submitted_ip)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_leads_fingerprint ON lead_submissions(fingerprint)`);
    console.log('✅ Indexes created');

    console.log('\n🎉 Phase 3-8 migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await db.close();
  }
}

migrate();
