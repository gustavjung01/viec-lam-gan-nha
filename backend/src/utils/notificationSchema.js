import { openDb } from '../database.js';

export async function ensureNotificationSchema() {
  const db = await openDb();
  try {
    await db.run(`
      CREATE TABLE IF NOT EXISTS notification_inbox (
        id TEXT PRIMARY KEY,
        target_role TEXT,
        target_id TEXT,
        title TEXT NOT NULL,
        message TEXT,
        url TEXT,
        data_json TEXT,
        source TEXT DEFAULT 'system',
        provider TEXT DEFAULT 'onesignal',
        provider_message_id TEXT,
        provider_status TEXT DEFAULT 'pending',
        read_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.run('CREATE INDEX IF NOT EXISTS idx_notification_inbox_target ON notification_inbox(target_role, target_id, created_at)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_notification_inbox_read ON notification_inbox(target_role, target_id, read_at)');

    await db.run(`
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
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS notification_subscriptions (
        id TEXT PRIMARY KEY,
        clerk_user_id TEXT NOT NULL,
        role TEXT,
        entity_id TEXT,
        player_id TEXT NOT NULL,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(clerk_user_id, player_id)
      )
    `);
    await db.run('CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_user ON notification_subscriptions(clerk_user_id, status)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_role ON notification_subscriptions(role, status)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_player ON notification_subscriptions(player_id)');
  } finally {
    await db.close();
  }
}
