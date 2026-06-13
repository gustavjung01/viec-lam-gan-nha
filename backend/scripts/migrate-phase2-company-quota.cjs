const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/applications.db');
const backupPath = path.join(__dirname, `../data/applications.db.bak.phase2.${Date.now()}`);

console.log('--- Starting Migration: Phase 2 Company Quota & Trust ---');

// 1. Backup DB
try {
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✅ Backup created at: ${backupPath}`);
} catch (err) {
  console.error('❌ Failed to create backup:', err);
  process.exit(1);
}

const db = new sqlite3.Database(dbPath);

const newColumns = [
  { name: 'trust_level', type: "TEXT DEFAULT 'normal' CHECK (trust_level IN ('normal', 'verified', 'priority', 'vip'))" },
  { name: 'deposit_status', type: "TEXT DEFAULT 'none' CHECK (deposit_status IN ('none', 'pending', 'partial', 'confirmed', 'waived'))" },
  { name: 'lead_trial_limit', type: 'INTEGER DEFAULT 2' },
  { name: 'require_deposit_after_leads', type: 'INTEGER DEFAULT 2' },
  { name: 'is_featured', type: 'INTEGER DEFAULT 0' },
  { name: 'plan_code', type: "TEXT DEFAULT 'free' CHECK (plan_code IN ('free', 'basic', 'pro', 'vip'))" },
  { name: 'free_job_posts_limit', type: 'INTEGER DEFAULT 5' },
  { name: 'weekly_push_limit', type: 'INTEGER DEFAULT 5' },
  { name: 'used_job_posts_count', type: 'INTEGER DEFAULT 0' },
  { name: 'used_push_count', type: 'INTEGER DEFAULT 0' },
  { name: 'push_week_start', type: 'DATETIME' },
  { name: 'plan_expired_at', type: 'DATETIME' }
];

db.serialize(() => {
  // 2. Add Missing Columns
  db.all("PRAGMA table_info(companies)", (err, rows) => {
    if (err) {
      console.error('❌ Failed to get table info:', err);
      process.exit(1);
    }

    const existingColumns = rows.map(r => r.name);
    
    newColumns.forEach(col => {
      if (!existingColumns.includes(col.name)) {
        db.run(`ALTER TABLE companies ADD COLUMN ${col.name} ${col.type}`, (err) => {
          if (err) console.error(`❌ Failed to add ${col.name}:`, err);
          else console.log(`✅ Added column: ${col.name}`);
        });
      } else {
        console.log(`ℹ️ Column ${col.name} already exists`);
      }
    });

    // 3. Update used_job_posts_count based on existing campaigns
    console.log('⏳ Updating used_job_posts_count for existing companies...');
    db.run(`
      UPDATE companies 
      SET used_job_posts_count = (
        SELECT COUNT(*) FROM campaigns 
        WHERE campaigns.company_id = companies.id
      )
    `, (err) => {
      if (err) {
        console.error('❌ Failed to update used_job_posts_count:', err);
      } else {
        console.log('✅ Updated used_job_posts_count successfully');
        
        // 4. Verify results
        console.log('--- Verification (Top 5 companies) ---');
        db.all("SELECT id, name, used_job_posts_count, trust_level, plan_code FROM companies LIMIT 5", (err, rows) => {
          if (err) {
            console.error('❌ Verification failed:', err);
          } else {
            console.table(rows);
            console.log('✅ Migration Phase 2 finished successfully');
          }
          db.close();
        });
      }
    });
  });
});
