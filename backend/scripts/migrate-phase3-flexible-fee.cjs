const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/applications.db');
const backupPath = path.join(__dirname, `../data/applications.db.bak.phase3.${Date.now()}`);

console.log('--- Starting Migration: Phase 3 Flexible Platform Fee ---');

// 1. Backup DB
try {
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✅ Backup created at: ${backupPath}`);
} catch (err) {
  console.error('❌ Failed to create backup:', err);
  process.exit(1);
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 2. Check if column exists
  db.all("PRAGMA table_info(campaigns)", (err, rows) => {
    if (err) {
      console.error('❌ Failed to get table info:', err);
      process.exit(1);
    }

    const hasFeeCol = rows.some(r => r.name === 'platform_fee_percentage');

    if (!hasFeeCol) {
      db.run("ALTER TABLE campaigns ADD COLUMN platform_fee_percentage INTEGER DEFAULT 20", (err) => {
        if (err) {
          console.error('❌ Failed to add platform_fee_percentage:', err);
        } else {
          console.log('✅ Added column: platform_fee_percentage to campaigns table');
          
          // 3. Update existing data
          db.run("UPDATE campaigns SET platform_fee_percentage = 20 WHERE platform_fee_percentage IS NULL", (err) => {
            if (err) console.error('❌ Failed to update default values:', err);
            else console.log('✅ Initialized existing campaigns with 20% fee');
            
            finish();
          });
        }
      });
    } else {
      console.log('ℹ️ Column platform_fee_percentage already exists');
      finish();
    }
  });

  function finish() {
    console.log('--- Verification ---');
    db.all("SELECT id, title, platform_fee_percentage FROM campaigns LIMIT 3", (err, rows) => {
      if (err) console.error(err);
      else console.table(rows);
      db.close();
      console.log('✅ Migration Phase 3 Finished');
    });
  }
});
