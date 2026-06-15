import fetch from 'node-fetch';
import { openDb } from '../database.js';
import { startLeadSlaEngine } from '../services/leadSlaEngine.js';

const APPROVED_LEAD_NOTIFICATION_POLL_MS = 15000;
const approvedLeadNotifierStartedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
const approvedLeadNotificationSeen = new Set();
let approvedLeadNotifierStarted = false;

function isPrematureCompanyLeadNotification({ clerkUserId, role, title, message, url }) {
  return Boolean(
    clerkUserId &&
    !role &&
    url === '/company/leads' &&
    String(title || '').trim() === 'Ứng viên mới' &&
    String(message || '').includes('vừa được gửi vào chiến dịch')
  );
}

function generateNotificationId(prefix = 'NIN') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return '{}';
  }
}

function normalizeLimit(value, fallback = 20, max = 100) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function normalizeOffset(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function normalizeRoles(roles = []) {
  return [...new Set(
    (Array.isArray(roles) ? roles : [roles])
      .map((role) => String(role || '').trim())
      .filter(Boolean)
  )];
}

async function ensureNotificationInboxTable(db) {
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
}

async function ensureNotificationLogTables(db) {
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
}

async function ensureNotificationSubscriptionTable(db) {
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
}

async function recordInboxNotification(db, { targetRole, targetId, title, message, url, data, source = 'system', providerStatus = 'pending', providerMessageId = null }) {
  if (!title) return null;
  const id = generateNotificationId('NIN');
  await db.run(`
    INSERT INTO notification_inbox (
      id, target_role, target_id, title, message, url, data_json, source, provider_status, provider_message_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    targetRole || 'user',
    targetId || null,
    String(title || '').trim(),
    String(message || '').trim(),
    url || null,
    safeJsonStringify(data),
    source,
    providerStatus,
    providerMessageId,
  ]);
  return id;
}

async function updateInboxProviderStatus(db, inboxIds = [], { providerMessageId = null, providerStatus = 'sent' } = {}) {
  const ids = inboxIds.filter(Boolean);
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(', ');
  await db.run(`
    UPDATE notification_inbox
    SET provider_message_id = COALESCE(?, provider_message_id), provider_status = ?
    WHERE id IN (${placeholders})
  `, [providerMessageId, providerStatus, ...ids]);
}

function buildNotificationRecipientWhere({ clerkUserId, roles = [] }) {
  const clauses = [];
  const args = [];

  if (clerkUserId) {
    clauses.push('target_id = ?');
    args.push(clerkUserId);
  }

  const normalizedRoles = normalizeRoles(roles);
  if (normalizedRoles.length > 0) {
    clauses.push(`(target_role IN (${normalizedRoles.map(() => '?').join(', ')}) AND (target_id IS NULL OR target_id = ''))`);
    args.push(...normalizedRoles);
  }

  if (clauses.length === 0) {
    clauses.push('1 = 0');
  }

  return { where: `(${clauses.join(' OR ')})`, args };
}

export async function listNotificationsForRecipient({ clerkUserId, roles = [], limit = 20, offset = 0, unreadOnly = false } = {}) {
  const safeLimit = normalizeLimit(limit);
  const safeOffset = normalizeOffset(offset);
  const db = await openDb();

  try {
    await ensureNotificationInboxTable(db);
    const { where, args } = buildNotificationRecipientWhere({ clerkUserId, roles });
    const unreadClause = unreadOnly ? ' AND read_at IS NULL' : '';

    const rows = await db.all(`
      SELECT id, target_role, target_id, title, message, url, data_json, source,
             provider, provider_message_id, provider_status, read_at, created_at
      FROM notification_inbox
      WHERE ${where}${unreadClause}
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT ? OFFSET ?
    `, [...args, safeLimit + 1, safeOffset]);

    const unreadRow = await db.get(`
      SELECT COUNT(*) as count
      FROM notification_inbox
      WHERE ${where} AND read_at IS NULL
    `, args);

    const hasMore = rows.length > safeLimit;
    const pageRows = hasMore ? rows.slice(0, safeLimit) : rows;

    return {
      items: pageRows.map((row) => {
        let data = {};
        try {
          data = row.data_json ? JSON.parse(row.data_json) : {};
        } catch {
          data = {};
        }
        return {
          id: row.id,
          targetRole: row.target_role,
          targetId: row.target_id,
          title: row.title,
          message: row.message,
          url: row.url,
          data,
          source: row.source,
          provider: row.provider,
          providerMessageId: row.provider_message_id,
          providerStatus: row.provider_status,
          readAt: row.read_at,
          createdAt: row.created_at,
          isRead: Boolean(row.read_at),
        };
      }),
      pagination: {
        limit: safeLimit,
        offset: safeOffset,
        nextOffset: hasMore ? safeOffset + safeLimit : null,
        hasMore,
      },
      unreadCount: Number(unreadRow?.count || 0),
    };
  } finally {
    await db.close();
  }
}

/**
 * Helper to send OneSignal notifications.
 * Inbox rows are written before push delivery, so admin history still works when push has no target.
 */
export async function sendNotification({ clerkUserId, playerIds = [], role, title, message, url, data }) {
  if (isPrematureCompanyLeadNotification({ clerkUserId, role, title, message, url })) {
    console.log('[Notification] Suppressed company notification for submitted lead. Company will be notified after admin approval.');
    return { success: false, error: 'SUPPRESSED_UNAPPROVED_LEAD' };
  }

  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  let db;
  const inboxIds = [];

  try {
    db = await openDb();
    await ensureNotificationInboxTable(db);
    await ensureNotificationLogTables(db);
    await ensureNotificationSubscriptionTable(db);

    const inboxTargetRole = role || 'user';
    const inboxTargetId = clerkUserId || null;
    const inboxId = await recordInboxNotification(db, {
      targetRole: inboxTargetRole,
      targetId: inboxTargetId,
      title,
      message,
      url,
      data,
      source: data?.event || 'system',
      providerStatus: appId && apiKey ? 'pending' : 'not_configured',
    });
    if (inboxId) inboxIds.push(inboxId);

    if (!appId || !apiKey) {
      console.warn('[Notification] OneSignal is not configured (missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY)');
      await db.close();
      db = null;
      return { success: false, error: 'NOT_CONFIGURED', inboxIds };
    }

    let targets = [...playerIds];

    if (clerkUserId) {
      const subs = await db.all('SELECT player_id FROM notification_subscriptions WHERE clerk_user_id = ? AND status = "active"', [clerkUserId]);
      targets.push(...subs.map(s => s.player_id));
    }

    if (role && !clerkUserId && playerIds.length === 0) {
      const subs = await db.all('SELECT player_id FROM notification_subscriptions WHERE role = ? AND status = "active"', [role]);
      targets.push(...subs.map(s => s.player_id));
    }

    targets = [...new Set(targets.filter(Boolean))];

    if (targets.length === 0) {
      console.log(`[Notification] No active subscriptions found for ${clerkUserId || role || 'unknown'}`);
      await updateInboxProviderStatus(db, inboxIds, { providerStatus: 'no_targets' });
      await db.close();
      db = null;
      return { success: false, error: 'NO_TARGETS', inboxIds };
    }

    const payload = {
      app_id: appId,
      include_player_ids: targets,
      headings: { en: title, vi: title },
      contents: { en: message, vi: message },
      url: url || undefined,
      data: data || {}
    };

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    let result = {};
    try {
      result = await response.json();
    } catch {
      result = { errors: [`Invalid OneSignal JSON response (${response.status})`] };
    }

    const providerStatus = response.ok && result.id ? 'sent' : 'failed';
    await updateInboxProviderStatus(db, inboxIds, { providerMessageId: result.id || null, providerStatus });

    const logId = `NOTI-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    await db.run(`
      INSERT INTO notification_logs (id, target_role, target_id, title, message, url, provider_message_id, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      logId,
      role || 'user',
      clerkUserId || targets[0],
      title,
      message,
      url,
      result.id || null,
      providerStatus,
      result.errors ? JSON.stringify(result.errors) : null
    ]);

    await db.close();
    db = null;
    return { success: providerStatus === 'sent', providerId: result.id, inboxIds, error: providerStatus === 'failed' ? result.errors : undefined };
  } catch (error) {
    console.error('[Notification] Send failed:', error);
    try {
      if (db && inboxIds.length > 0) {
        await updateInboxProviderStatus(db, inboxIds, { providerStatus: 'failed' });
      }
    } catch {}
    try { await db?.close?.(); } catch {}
    return { success: false, error: error.message, inboxIds };
  }
}

async function notifyCompanyForRecentlyApprovedLeads() {
  let db;
  try {
    db = await openDb();
    const leads = await db.all(`
      SELECT
        ls.id,
        ls.lead_code,
        c.title as campaign_title,
        co.clerk_user_id as company_clerk_user_id,
        h.created_at as approved_at
      FROM lead_status_history h
      JOIN lead_submissions ls ON h.lead_id = ls.id
      JOIN campaigns c ON ls.campaign_id = c.id
      JOIN companies co ON c.company_id = co.id
      WHERE h.to_status = 'approved'
        AND h.changed_by_role = 'admin'
        AND h.created_at >= ?
        AND ls.status = 'approved'
        AND co.clerk_user_id IS NOT NULL
      ORDER BY h.created_at ASC
      LIMIT 25
    `, [approvedLeadNotifierStartedAt]);

    await db.close();
    db = null;

    for (const lead of leads) {
      if (!lead?.id || approvedLeadNotificationSeen.has(lead.id)) continue;
      approvedLeadNotificationSeen.add(lead.id);

      await sendNotification({
        clerkUserId: lead.company_clerk_user_id,
        title: 'Lead đã được duyệt',
        message: `Lead ${lead.lead_code} đã được admin duyệt cho chiến dịch "${lead.campaign_title}".`,
        url: '/company/leads',
        data: {
          event: 'lead_approved',
          lead_id: lead.id,
          lead_code: lead.lead_code,
        },
      });
    }
  } catch (error) {
    console.warn('[Notification] Approved lead notification scan failed:', error.message);
    try {
      await db?.close?.();
    } catch {
      // Ignore close errors in background notification scan.
    }
  }
}

function startApprovedLeadCompanyNotifier() {
  if (approvedLeadNotifierStarted) return;
  approvedLeadNotifierStarted = true;

  const run = () => {
    void notifyCompanyForRecentlyApprovedLeads();
  };

  setTimeout(run, 5000);
  setInterval(run, APPROVED_LEAD_NOTIFICATION_POLL_MS);
}

startApprovedLeadCompanyNotifier();
startLeadSlaEngine({ sendNotification });

/**
 * Register or update device subscription
 */
export async function subscribeUser(clerkUserId, role, playerId, entityId = null) {
  const db = await openDb();
  const id = `SUB-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

  try {
    await ensureNotificationSubscriptionTable(db);
    await db.run(`
      INSERT INTO notification_subscriptions (id, clerk_user_id, role, entity_id, player_id, status, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
      ON CONFLICT(clerk_user_id, player_id) DO UPDATE SET
        role = excluded.role,
        entity_id = COALESCE(excluded.entity_id, entity_id),
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
    `, [id, clerkUserId, role, entityId, playerId]);

    await db.close();
    return { success: true };
  } catch (error) {
    console.error('[Notification] Subscribe failed:', error);
    await db.close();
    return { success: false, error: error.message };
  }
}
