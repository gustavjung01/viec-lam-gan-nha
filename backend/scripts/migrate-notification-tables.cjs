const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/applications.db');
const backupPath = path.join(__dirname, `../data/applications.db.bak.notification.${Date.now()}`);

console.log('--- Starting Migration: Notification Tables ---');

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
  // 2. Create notification_subscriptions table
  db.run(`
    CREATE TABLE IF NOT EXISTS notification_subscriptions (
      id TEXT PRIMARY KEY,
      clerk_user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      entity_id TEXT,
      provider TEXT DEFAULT 'onesignal',
      player_id TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(clerk_user_id, player_id)
    )
  `, (err) => {
    if (err) console.error('❌ Failed to create notification_subscriptions:', err);
    else console.log('✅ Table notification_subscriptions ready');
  });

  // 3. Create notification_logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS notification_logs (
      id TEXT PRIMARY KEY,
      target_role TEXT,
      target_id TEXT,
      title TEXT,
      message TEXT,
      url TEXT,
      provider TEXT DEFAULT 'onesignal',
      provider_message_id TEXT,
      status TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('❌ Failed to create notification_logs:', err);
    else console.log('✅ Table notification_logs ready');
  });

  // 4. Verify results
  console.log('--- Verification ---');
  db.all("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'notification_%'", (err, rows) => {
    if (err) {
      console.error('❌ Verification failed:', err);
    } else {
      console.table(rows);
      console.log('✅ Notification migration finished successfully');
    }
    db.close();
  });
});
