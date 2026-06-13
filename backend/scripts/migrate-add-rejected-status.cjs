const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

let dbPath = null;
const dbArgIndex = args.indexOf('--db');
if (dbArgIndex !== -1 && args.length > dbArgIndex + 1) {
  dbPath = args[dbArgIndex + 1];
}

if (!dbPath) {
  console.error('Error: Mising --db argument.');
  console.error('Usage: node migrate-add-rejected-status.cjs --db <path/to/db> [--dry-run]');
  console.error('Example: node migrate-add-rejected-status.cjs --db ./data/applications.db --dry-run');
  process.exit(1);
}

const DB_PATH = path.resolve(dbPath);

console.log(`Starting migration to add 'rejected' status...`);
console.log(`Target DB: ${DB_PATH}`);
if (dryRun) console.log('*** DRY RUN MODE ***');

if (!fs.existsSync(DB_PATH)) {
  console.error(`Database not found at ${DB_PATH}`);
  process.exit(1);
}

// Backup DB if not dry run
if (!dryRun) {
  const backupPath = `${DB_PATH}.backup_${Date.now()}`;
  console.log(`Creating database backup at ${backupPath}...`);
  fs.copyFileSync(DB_PATH, backupPath);
  console.log('Backup created successfully.');
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
});

function runSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (dryRun && !sql.trim().toUpperCase().startsWith('SELECT') && !sql.trim().toUpperCase().startsWith('PRAGMA')) {
      console.log(`[DRY-RUN] Would execute: ${sql.substring(0, 150).replace(/\n/g, ' ')}...`);
      return resolve();
    }
    db.run(sql, params, function (err) {
      if (err) {
        console.error(`Error executing SQL: ${sql.substring(0, 100)}...`, err.message);
        return reject(err);
      }
      resolve(this);
    });
  });
}

function allSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function migrate() {
  try {
    // Collect pre-migration stats
    console.log('\n--- Pre-migration Checks ---');
    const preCtvCount = (await allSql('SELECT COUNT(*) as count FROM ctv_accounts'))[0].count;
    const preCompCount = (await allSql('SELECT COUNT(*) as count FROM companies'))[0].count;
    console.log(`Initial ctv_accounts count: ${preCtvCount}`);
    console.log(`Initial companies count: ${preCompCount}`);

    const preMaster = await allSql(`SELECT name, type, sql FROM sqlite_master WHERE tbl_name IN ('ctv_accounts', 'companies')`);
    
    // Start Migration
    console.log('\n--- Starting Migration ---');
    await runSql('PRAGMA foreign_keys = OFF;');
    await runSql('BEGIN IMMEDIATE;');

    // MIGRATING CTV_ACCOUNTS
    console.log('Migrating ctv_accounts...');
    const ctvCols = await allSql(`PRAGMA table_info(ctv_accounts)`);
    const ctvColNames = ctvCols.map(c => `"${c.name}"`).join(', ');

    await runSql(`
      CREATE TABLE ctv_accounts_new (
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
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'suspended', 'banned')),
          trust_score INTEGER DEFAULT 100,
          total_earned INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          clerk_user_id TEXT,
          rejection_reason TEXT,
          submitted_at DATETIME,
          approved_at DATETIME,
          approved_by TEXT
      )
    `);

    await runSql(`INSERT INTO ctv_accounts_new (${ctvColNames}) SELECT ${ctvColNames} FROM ctv_accounts`);
    await runSql(`DROP TABLE ctv_accounts`);
    await runSql(`ALTER TABLE ctv_accounts_new RENAME TO ctv_accounts`);

    // MIGRATING COMPANIES
    console.log('Migrating companies...');
    const compCols = await allSql(`PRAGMA table_info(companies)`);
    const compColNames = compCols.map(c => `"${c.name}"`).join(', ');

    await runSql(`
      CREATE TABLE companies_new (
          id TEXT PRIMARY KEY,
          company_code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          address TEXT,
          province TEXT,
          district TEXT,
          tax_code TEXT,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'suspended')),
          wallet_balance INTEGER DEFAULT 0,
          credit_limit INTEGER DEFAULT 10000000,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          clerk_user_id TEXT,
          rejection_reason TEXT,
          submitted_at DATETIME,
          approved_at DATETIME,
          approved_by TEXT
      )
    `);

    await runSql(`INSERT INTO companies_new (${compColNames}) SELECT ${compColNames} FROM companies`);
    await runSql(`DROP TABLE companies`);
    await runSql(`ALTER TABLE companies_new RENAME TO companies`);

    await runSql('COMMIT;');
    console.log('Transaction committed successfully.');
    
    // Post-migration Checks
    console.log('\n--- Post-migration Checks ---');
    await runSql('PRAGMA foreign_keys = ON;');

    if (!dryRun) {
      const postCtvCount = (await allSql('SELECT COUNT(*) as count FROM ctv_accounts'))[0].count;
      const postCompCount = (await allSql('SELECT COUNT(*) as count FROM companies'))[0].count;
      console.log(`Final ctv_accounts count: ${postCtvCount} (Expected: ${preCtvCount})`);
      console.log(`Final companies count: ${postCompCount} (Expected: ${preCompCount})`);
      
      if (postCtvCount !== preCtvCount || postCompCount !== preCompCount) {
        console.error('❌ Data count mismatch! Manual review required.');
      } else {
        console.log('✅ Data counts match.');
      }

      const fkCheck = await allSql('PRAGMA foreign_key_check;');
      if (fkCheck.length > 0) {
        console.error('❌ Foreign key check returned issues:', fkCheck);
      } else {
        console.log('✅ Foreign key check passed.');
      }

      const integrityCheck = await allSql('PRAGMA integrity_check;');
      if (integrityCheck[0].integrity_check !== 'ok') {
        console.error('❌ Integrity check failed:', integrityCheck);
      } else {
        console.log('✅ Integrity check passed.');
      }

      const postMaster = await allSql(`SELECT name, type, sql FROM sqlite_master WHERE tbl_name IN ('ctv_accounts', 'companies')`);
      console.log(`\nsqlite_master comparison:`);
      console.log(`Pre-migration elements: ${preMaster.length}`);
      console.log(`Post-migration elements: ${postMaster.length}`);
      // Usually drops and renames might recreate autoindexes, lengths should match or differ slightly depending on sqlite version, but user indexes would need recreating if we had any.
    }
  } catch (error) {
    console.error('❌ Migration failed, rolling back...', error);
    try {
      await runSql('ROLLBACK;');
    } catch (e) {} // ignore rollback errors if tx wasn't active
  } finally {
    await runSql('PRAGMA foreign_keys = ON;');
    db.close();
    console.log('\nDone.');
  }
}

migrate();