import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'data', 'applications.db');

let db = null;

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function initDatabase() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('❌ Database connection failed:', err.message);
        return reject(err);
      }
      
      console.log('✅ Database connected');
      
      // Create applications table
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS applications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          full_name TEXT NOT NULL,
          phone TEXT NOT NULL,
          area TEXT NOT NULL,
          note TEXT,
          job_id TEXT,
          job_slug TEXT,
          job_title TEXT,
          company_code TEXT NOT NULL,
          target_code TEXT NOT NULL,
          telegram_sent INTEGER DEFAULT 0,
          telegram_error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_applications_phone ON applications(phone);
        CREATE INDEX IF NOT EXISTS idx_applications_company ON applications(company_code);
        CREATE INDEX IF NOT EXISTS idx_applications_created ON applications(created_at);
      `;
      
      db.exec(createTableSQL, (err) => {
        if (err) {
          console.error('❌ Failed to create tables:', err.message);
          return reject(err);
        }
        
        console.log('✅ Database initialized at:', DB_PATH);
        resolve(db);
      });
    });
  });
}

export function saveApplication(data) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT INTO applications 
      (full_name, phone, area, note, job_id, job_slug, job_title, company_code, target_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const params = [
      data.fullName,
      data.phone,
      data.area,
      data.note || null,
      data.jobId || null,
      data.jobSlug || null,
      data.jobTitle || null,
      data.companyCode,
      data.targetCode
    ];
    
    db.run(sql, params, function(err) {
      if (err) {
        console.error('❌ Failed to save application:', err.message);
        return reject(err);
      }
      
      resolve({
        id: this.lastID,
        ...data
      });
    });
  });
}

export function updateTelegramStatus(applicationId, sent, error = null) {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE applications 
      SET telegram_sent = ?, telegram_error = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`;
    
    db.run(sql, [sent ? 1 : 0, error, applicationId], function(err) {
      if (err) {
        console.error('❌ Failed to update telegram status:', err.message);
        return reject(err);
      }
      resolve();
    });
  });
}

export function getApplications(limit = 50, offset = 0) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM applications 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?`;
    
    db.all(sql, [limit, offset], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

export function getApplicationsByCompany(companyCode, limit = 50) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM applications 
      WHERE company_code = ?
      ORDER BY created_at DESC 
      LIMIT ?`;
    
    db.all(sql, [companyCode, limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

export function getApplicationStats() {
  return new Promise((resolve, reject) => {
    const sql = `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN telegram_sent = 1 THEN 1 ELSE 0 END) as sent_to_telegram,
      SUM(CASE WHEN telegram_sent = 0 THEN 1 ELSE 0 END) as pending,
      COUNT(DISTINCT company_code) as companies
     FROM applications`;
    
    db.get(sql, [], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// Initialize marketplace tables
export async function initMarketplaceTables() {
  return new Promise((resolve, reject) => {
    const marketplaceSchema = `
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
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

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
          requirements TEXT,
          bounty_amount INTEGER NOT NULL,
          ctv_reward_amount INTEGER NOT NULL,
          platform_fee_amount INTEGER NOT NULL,
          qualification_days INTEGER DEFAULT 7,
          max_leads INTEGER DEFAULT 50,
          current_leads INTEGER DEFAULT 0,
          status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'paused', 'closed')),
          start_date DATE,
          end_date DATE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies(id)
      );

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

      CREATE TABLE IF NOT EXISTS lead_submissions (
          id TEXT PRIMARY KEY,
          lead_code TEXT UNIQUE NOT NULL,
          campaign_id TEXT NOT NULL,
          ctv_id TEXT NOT NULL,
          candidate_id TEXT NOT NULL,
          status TEXT DEFAULT 'submitted' CHECK (status IN ('new', 'submitted', 'approved', 'claimed', 'interviewing', 'hired', 'qualified', 'rejected', 'disputed', 'paid')),
          is_anonymous INTEGER DEFAULT 1,
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

      CREATE TABLE IF NOT EXISTS lead_claims (
          id TEXT PRIMARY KEY,
          lead_id TEXT NOT NULL,
          campaign_id TEXT NOT NULL,
          company_id TEXT NOT NULL,
          claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          claimed_by_role TEXT,
          claimed_by_id TEXT,
          bounty_paid INTEGER DEFAULT 0,
          FOREIGN KEY (lead_id) REFERENCES lead_submissions(id),
          FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
          FOREIGN KEY (company_id) REFERENCES companies(id)
      );

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

      CREATE TABLE IF NOT EXISTS wallet_transactions (
          id TEXT PRIMARY KEY,
          company_id TEXT NOT NULL,
          transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'lead_claim', 'refund')),
          amount INTEGER NOT NULL,
          balance_after INTEGER NOT NULL,
          reference_id TEXT,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies(id)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          action TEXT NOT NULL,
          actor_role TEXT,
          actor_id TEXT,
          details TEXT,
          ip_address TEXT,
          user_agent TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS phone_locks (
          id TEXT PRIMARY KEY,
          normalized_phone TEXT NOT NULL,
          campaign_id TEXT NOT NULL,
          lead_id TEXT NOT NULL,
          locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME,
          UNIQUE(normalized_phone, campaign_id)
      );

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
    `;

    db.exec(marketplaceSchema, (err) => {
      if (err) {
        console.error('❌ Failed to create marketplace tables:', err.message);
        return reject(err);
      }
      console.log('✅ Marketplace tables initialized');
      resolve();
    });
  });
}

export { db };

// Helper: Open database for marketplace routes (Promise-based)
export async function openDb() {
  const { open } = await import('sqlite');
  const sqlite3Module = await import('sqlite3');
  return open({
    filename: DB_PATH,
    driver: sqlite3Module.default.Database
  });
}
