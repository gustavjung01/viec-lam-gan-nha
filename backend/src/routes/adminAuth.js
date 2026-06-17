import { Router } from 'express';
import crypto from 'crypto';
import { openDb } from '../database.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { listNotificationsForRecipient, subscribeUser } from '../utils/notification.js';

const router = Router();

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidPasswordHash(storedHash) {
  const parts = String(storedHash || '').trim().split(':');
  if (parts.length !== 3) return false;
  const [algo, saltHex, hashHex] = parts;
  if (algo !== 'pbkdf2' || !saltHex || !hashHex) return false;
  if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(hashHex)) return false;
  return saltHex.length % 2 === 0 && hashHex.length % 2 === 0;
}

async function verifyPassword(password, storedHash) {
  if (!storedHash || !password || !isValidPasswordHash(storedHash)) return false;
  try {
    const [algo, saltHex, hashHex] = String(storedHash).trim().split(':');
    if (algo !== 'pbkdf2') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const storedDerivedKey = Buffer.from(hashHex, 'hex');
    if (salt.length === 0 || storedDerivedKey.length === 0) return false;
    return await new Promise(resolve => {
      crypto.pbkdf2(password, salt, 100000, storedDerivedKey.length, 'sha512', (err, derivedKey) => {
        if (err) return resolve(false);
        if (derivedKey.length !== storedDerivedKey.length) return resolve(false);
        try { resolve(crypto.timingSafeEqual(derivedKey, storedDerivedKey)); } catch { resolve(false); }
      });
    });
  } catch {
    return false;
  }
}

function createSessionToken(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const unsignedToken = `${header}.${payloadEncoded}`;
  const signature = crypto.createHmac('sha256', secret).update(unsignedToken).digest('base64url');
  return `${unsignedToken}.${signature}`;
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

function adminNotificationWhere() {
  return {
    where: "target_role = 'admin' AND (target_id IS NULL OR target_id = '' OR target_id = 'admin')",
    args: [],
  };
}

async function unreadAdminNotificationCount(db) {
  const { where, args } = adminNotificationWhere();
  const row = await db.get(`SELECT COUNT(*) as count FROM notification_inbox WHERE ${where} AND read_at IS NULL`, args);
  return Number(row?.count || 0);
}

function emptyAdminNotificationFallback(warning) {
  return {
    success: true,
    data: [],
    pagination: { limit: 20, offset: 0, nextOffset: null, hasMore: false },
    unreadCount: 0,
    warning,
  };
}

router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ success: false, message: 'MISSING_ADMIN_CREDENTIALS' });

    const ADMIN_LOGIN_EMAIL = normalizeEmail(process.env.ADMIN_LOGIN_EMAIL);
    const ADMIN_PASSWORD_HASH = String(process.env.ADMIN_PASSWORD_HASH || '').trim();
    const ADMIN_SESSION_SECRET = String(process.env.ADMIN_SESSION_SECRET || '').trim();
    if (!ADMIN_LOGIN_EMAIL || !ADMIN_PASSWORD_HASH || !ADMIN_SESSION_SECRET || !isValidPasswordHash(ADMIN_PASSWORD_HASH)) {
      console.error('[AdminAuth] Missing or invalid admin login env');
      return res.status(503).json({ success: false, message: 'ADMIN_LOGIN_NOT_CONFIGURED' });
    }
    if (email !== ADMIN_LOGIN_EMAIL) return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu quản trị không đúng' });
    const isPasswordValid = await verifyPassword(password, ADMIN_PASSWORD_HASH);
    if (!isPasswordValid) return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu quản trị không đúng' });

    const payload = { email: ADMIN_LOGIN_EMAIL, role: 'super_admin', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + (60 * 60 * 8) };
    return res.json({ success: true, token: createSessionToken(payload, ADMIN_SESSION_SECRET) });
  } catch (error) {
    console.error('[AdminAuth] Login failed:', error);
    return res.status(500).json({ success: false, message: 'ADMIN_LOGIN_FAILED' });
  }
});

router.get('/me', (req, res) => {
  return res.json({ success: true, user: req.user });
});

router.get('/notifications', adminAuth, async (req, res) => {
  try {
    const unreadOnly = ['1', 'true', 'yes'].includes(String(req.query.unreadOnly || '').toLowerCase());
    const result = await listNotificationsForRecipient({ roles: ['admin'], limit: req.query.limit, offset: req.query.offset, unreadOnly });
    res.json({ success: true, data: result.items, pagination: result.pagination, unreadCount: result.unreadCount });
  } catch (error) {
    console.error('Get admin notifications failed:', error);
    res.json(emptyAdminNotificationFallback('ADMIN_NOTIFICATIONS_UNAVAILABLE'));
  }
});

router.post('/notifications/mark-all-read', adminAuth, async (req, res) => {
  let db;
  try {
    const { where, args } = adminNotificationWhere();
    db = await openDb();
    await ensureNotificationInboxTable(db);
    const result = await db.run(`UPDATE notification_inbox SET read_at = datetime('now') WHERE ${where} AND read_at IS NULL`, args);
    const unreadCount = await unreadAdminNotificationCount(db);
    await db.close(); db = null;
    res.json({ success: true, updatedCount: Number(result?.changes || 0), unreadCount });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Mark all admin notifications read failed:', error);
    res.json({ success: true, updatedCount: 0, unreadCount: 0, warning: 'ADMIN_MARK_ALL_NOTIFICATIONS_UNAVAILABLE' });
  }
});

router.post('/notifications/:id/read', adminAuth, async (req, res) => {
  let db;
  try {
    const notificationId = String(req.params.id || '').trim();
    if (!notificationId) return res.status(400).json({ success: false, error: 'MISSING_NOTIFICATION_ID' });
    const { where, args } = adminNotificationWhere();
    db = await openDb();
    await ensureNotificationInboxTable(db);
    const row = await db.get(`SELECT id, read_at FROM notification_inbox WHERE id = ? AND ${where}`, [notificationId, ...args]);
    if (!row) {
      await db.close(); db = null;
      return res.json({ success: true, data: { id: notificationId, readAt: null, alreadyRead: false, missing: true }, unreadCount: 0, warning: 'NOTIFICATION_NOT_FOUND' });
    }
    if (!row.read_at) await db.run("UPDATE notification_inbox SET read_at = datetime('now') WHERE id = ?", [notificationId]);
    const updated = await db.get('SELECT id, read_at FROM notification_inbox WHERE id = ?', [notificationId]);
    const unreadCount = await unreadAdminNotificationCount(db);
    await db.close(); db = null;
    res.json({ success: true, data: { id: updated.id, readAt: updated.read_at, alreadyRead: Boolean(row.read_at) }, unreadCount });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Mark admin notification read failed:', error);
    res.json({ success: true, data: { id: String(req.params.id || ''), readAt: null, alreadyRead: false }, unreadCount: 0, warning: 'ADMIN_MARK_NOTIFICATION_UNAVAILABLE' });
  }
});

router.post('/notifications/subscribe', adminAuth, async (req, res) => {
  try {
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ success: false, error: 'MISSING_PLAYER_ID' });
    const result = await subscribeUser('admin', 'admin', playerId, 'admin');
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/leads/:id/history', adminAuth, async (req, res) => {
  let db;
  try {
    const id = String(req.params.id || '').trim();
    db = await openDb();
    const rows = await db.all(`
      SELECT id, lead_id, from_status, to_status, changed_by_role, changed_by_id, reason, created_at
      FROM lead_status_history
      WHERE lead_id = ? OR lead_id = (SELECT id FROM lead_submissions WHERE lead_code = ? LIMIT 1)
      ORDER BY datetime(created_at) DESC, id DESC
    `, [id, id]);
    await db.close(); db = null;
    res.json({ success: true, data: rows });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Get lead history failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
