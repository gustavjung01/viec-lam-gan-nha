const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/applications.db');
const backupPath = path.join(__dirname, `../data/applications.db.bak.${Date.now()}`);

console.log('--- Starting Migration: Phase 1 Affiliate Flags ---');

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
  // 2. Check and Add Columns
  db.all("PRAGMA table_info(campaigns)", (err, rows) => {
    if (err) {
      console.error('❌ Failed to get table info:', err);
      process.exit(1);
    }

    const columns = rows.map(r => r.name);
    const hasIsPublic = columns.includes('is_public');
    const hasCtvEnabled = columns.includes('ctv_enabled');

    if (!hasIsPublic) {
      db.run("ALTER TABLE campaigns ADD COLUMN is_public INTEGER DEFAULT 0", (err) => {
        if (err) console.error('❌ Failed to add is_public:', err);
        else console.log('✅ Added column: is_public');
      });
    } else {
      console.log('ℹ️ Column is_public already exists');
    }

    if (!hasCtvEnabled) {
      db.run("ALTER TABLE campaigns ADD COLUMN ctv_enabled INTEGER DEFAULT 0", (err) => {
        if (err) console.error('❌ Failed to add ctv_enabled:', err);
        else console.log('✅ Added column: ctv_enabled');
      });
    } else {
      console.log('ℹ️ Column ctv_enabled already exists');
    }

    // 3. Mapping Data from visibility
    // Mapping:
    // visibility='public_candidate' => is_public=1, ctv_enabled=0
    // visibility='ctv_private' => is_public=1, ctv_enabled=1
    // visibility='internal' => is_public=0, ctv_enabled=0
    // visibility='draft' => is_public=0, ctv_enabled=0

    console.log('⏳ Mapping data from visibility column...');
    
    db.run(`
      UPDATE campaigns 
      SET is_public = CASE 
        WHEN visibility = 'public_candidate' THEN 1 
        WHEN visibility = 'ctv_private' THEN 1 
        ELSE 0 
      END,
      ctv_enabled = CASE 
        WHEN visibility = 'ctv_private' THEN 1 
        ELSE 0 
      END
    `, (err) => {
      if (err) {
        console.error('❌ Data mapping failed:', err);
      } else {
        console.log('✅ Data mapping completed');
        
        // 4. Verify results
        console.log('--- Verification ---');
        db.all("SELECT visibility, is_public, ctv_enabled, COUNT(*) AS count FROM campaigns GROUP BY visibility, is_public, ctv_enabled", (err, rows) => {
          if (err) {
            console.error('❌ Verification failed:', err);
          } else {
            console.table(rows);
            console.log('✅ Migration finished successfully');
          }
          db.close();
        });
      }
    });
  });
});
