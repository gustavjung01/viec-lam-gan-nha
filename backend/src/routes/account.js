/**
 * Account API Routes
 * Handles CTV and Company registration with Clerk authentication
 */

import express from 'express';
import { userAuth } from '../middleware/userAuth.js';
import { accountAutoLink } from '../middleware/accountAutoLink.js';
import { openDb } from '../database.js';
import { subscribeUser, listNotificationsForRecipient } from '../utils/notification.js';

const router = express.Router();
export const clerkLookupRoutes = express.Router();

// Keep company/CTV rows linked to the current Clerk identity whenever account routes run.
router.use(userAuth, accountAutoLink);

function generateCode(prefix) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

async function createAuditLog(db, entityType, entityId, action, actorRole, actorId, details) {
  await db.run(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [generateCode('AUD'), entityType, entityId, action, actorRole, actorId, JSON.stringify(details)]);
}

function ctvPayload(row, email) {
  if (!row) return null;
  return {
    id: row.id,
    ctvCode: row.ctv_code,
    name: row.name,
    phone: row.phone,
    email: row.email || email,
    zaloPhone: row.zalo_phone,
    province: row.province,
    district: row.district,
    bankAccount: row.bank_account,
    bankName: row.bank_name,
    status: row.status,
    wallet_balance: row.wallet_balance,
    credit_limit: row.credit_limit,
    plan_code: row.plan_code,
    rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
  };
}

function companyPayload(row, email) {
  if (!row) return null;
  return {
    id: row.id,
    companyCode: row.company_code,
    name: row.name,
    phone: row.phone,
    email: row.email || email,
    address: row.address,
    taxCode: row.tax_code,
    province: row.province,
    district: row.district,
    status: row.status,
    wallet_balance: row.wallet_balance,
    credit_limit: row.credit_limit,
    free_job_posts_limit: row.free_job_posts_limit,
    used_job_posts_count: row.used_job_posts_count,
    weekly_push_limit: row.weekly_push_limit,
    used_push_count: row.used_push_count,
    plan_code: row.plan_code,
    rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
  };
}

async function getAccountNotificationRoles(clerkUserId) {
  let db;
  try {
    db = await openDb();
    const roles = ['user'];
    const ctvAccount = await db.get('SELECT id FROM ctv_accounts WHERE clerk_user_id = ?', [clerkUserId]);
    const companyAccount = await db.get('SELECT id FROM companies WHERE clerk_user_id = ?', [clerkUserId]);
    if (ctvAccount) roles.push('ctv');
    if (companyAccount) roles.push('company');
    return roles;
  } catch (error) {
    console.error('Get account notification roles failed:', error);
    return ['user'];
  } finally {
    try { await db?.close?.(); } catch {}
  }
}

function buildNotificationRecipientWhere(clerkUserId, roles = []) {
  const clauses = ['target_id = ?'];
  const args = [clerkUserId];
  const normalizedRoles = [...new Set(roles.map((role) => String(role || '').trim()).filter(Boolean))];
  if (normalizedRoles.length > 0) {
    clauses.push(`(target_role IN (${normalizedRoles.map(() => '?').join(', ')}) AND (target_id IS NULL OR target_id = ''))`);
    args.push(...normalizedRoles);
  }
  return { where: `(${clauses.join(' OR ')})`, args };
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

async function unreadCountForRecipient(db, clerkUserId, roles) {
  const { where, args } = buildNotificationRecipientWhere(clerkUserId, roles);
  const row = await db.get(`
    SELECT COUNT(*) as count
    FROM notification_inbox
    WHERE ${where} AND read_at IS NULL
  `, args);
  return Number(row?.count || 0);
}

// POST /api/account/notifications/subscribe - Register device for notifications
router.post('/notifications/subscribe', userAuth, async (req, res) => {
  try {
    const { playerId, role, entityId } = req.body;
    const { clerkUserId } = req.user;
    if (!playerId) return res.status(400).json({ success: false, error: 'MISSING_PLAYER_ID' });
    const result = await subscribeUser(clerkUserId, role || 'guest', playerId, entityId);
    res.json(result);
  } catch (error) {
    console.error('Account notification subscribe failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/account/notifications - Get current user's notification inbox
router.get('/notifications', userAuth, async (req, res) => {
  try {
    const { clerkUserId } = req.user;
    const roles = await getAccountNotificationRoles(clerkUserId);
    const unreadOnly = ['1', 'true', 'yes'].includes(String(req.query.unreadOnly || '').toLowerCase());
    const result = await listNotificationsForRecipient({
      clerkUserId,
      roles,
      limit: req.query.limit,
      offset: req.query.offset,
      unreadOnly,
    });
    res.json({ success: true, data: result.items, pagination: result.pagination, unreadCount: result.unreadCount });
  } catch (error) {
    console.error('Get account notifications failed:', error);
    res.json({
      success: true,
      data: [],
      pagination: { limit: 20, offset: 0, nextOffset: null, hasMore: false },
      unreadCount: 0,
      warning: 'ACCOUNT_NOTIFICATIONS_UNAVAILABLE',
    });
  }
});

// POST /api/account/notifications/:id/read - Mark one notification as read
router.post('/notifications/:id/read', userAuth, async (req, res) => {
  let db;
  try {
    const { clerkUserId } = req.user;
    const notificationId = String(req.params.id || '').trim();
    if (!notificationId) return res.status(400).json({ success: false, error: 'MISSING_NOTIFICATION_ID' });

    const roles = await getAccountNotificationRoles(clerkUserId);
    const { where, args } = buildNotificationRecipientWhere(clerkUserId, roles);

    db = await openDb();
    await ensureNotificationInboxTable(db);
    const row = await db.get(`
      SELECT id, read_at
      FROM notification_inbox
      WHERE id = ? AND ${where}
    `, [notificationId, ...args]);

    if (!row) {
      await db.close();
      db = null;
      return res.status(404).json({ success: false, error: 'NOTIFICATION_NOT_FOUND' });
    }

    if (!row.read_at) {
      await db.run('UPDATE notification_inbox SET read_at = datetime(\'now\') WHERE id = ?', [notificationId]);
    }

    const updated = await db.get('SELECT id, read_at FROM notification_inbox WHERE id = ?', [notificationId]);
    const unreadCount = await unreadCountForRecipient(db, clerkUserId, roles);
    await db.close();
    db = null;

    res.json({
      success: true,
      data: {
        id: updated.id,
        readAt: updated.read_at,
        alreadyRead: Boolean(row.read_at),
      },
      unreadCount,
    });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Mark notification read failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/account/notifications/mark-all-read - Mark all notifications as read
router.post('/notifications/mark-all-read', userAuth, async (req, res) => {
  let db;
  try {
    const { clerkUserId } = req.user;
    const roles = await getAccountNotificationRoles(clerkUserId);
    const { where, args } = buildNotificationRecipientWhere(clerkUserId, roles);

    db = await openDb();
    await ensureNotificationInboxTable(db);
    const result = await db.run(`
      UPDATE notification_inbox
      SET read_at = datetime('now')
      WHERE ${where} AND read_at IS NULL
    `, args);
    const unreadCount = await unreadCountForRecipient(db, clerkUserId, roles);
    await db.close();
    db = null;

    res.json({
      success: true,
      updatedCount: Number(result?.changes || 0),
      unreadCount,
    });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Mark all notifications read failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ctv/by-clerk/:clerkId - Get CTV by clerk ID
clerkLookupRoutes.get('/ctv/by-clerk/:clerkId', userAuth, async (req, res) => {
  try {
    const clerkUserId = req.params.clerkId;
    const { email } = req.user;
    if (clerkUserId !== req.user.clerkUserId) return res.status(403).json({ success: false, error: 'FORBIDDEN' });
    const db = await openDb();
    const ctvAccount = await db.get('SELECT * FROM ctv_accounts WHERE clerk_user_id = ?', [clerkUserId]);
    await db.close();
    res.json({ success: true, data: ctvPayload(ctvAccount, email) });
  } catch (error) {
    console.error('Get CTV by clerk failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/company/by-clerk/:clerkId - Get Company by clerk ID
clerkLookupRoutes.get('/company/by-clerk/:clerkId', userAuth, async (req, res) => {
  try {
    const clerkUserId = req.params.clerkId;
    const { email } = req.user;
    if (clerkUserId !== req.user.clerkUserId) return res.status(403).json({ success: false, error: 'FORBIDDEN' });
    const db = await openDb();
    const companyAccount = await db.get('SELECT * FROM companies WHERE clerk_user_id = ?', [clerkUserId]);
    await db.close();
    res.json({ success: true, data: companyPayload(companyAccount, email) });
  } catch (error) {
    console.error('Get Company by clerk failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/account/me - Get current user's account status
router.get('/me', async (req, res) => {
  let db;
  const fallbackEmail = req.user?.email || null;
  try {
    db = await openDb();
    const { clerkUserId, email } = req.user;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    let ctvAccount = await db.get('SELECT * FROM ctv_accounts WHERE clerk_user_id = ?', [clerkUserId]);
    let companyAccount = await db.get('SELECT * FROM companies WHERE clerk_user_id = ?', [clerkUserId]);

    if (!ctvAccount && normalizedEmail) {
      const fallbackCtv = await db.get(`
        SELECT * FROM ctv_accounts
        WHERE LOWER(TRIM(email)) = ?
          AND (clerk_user_id IS NULL OR TRIM(clerk_user_id) = '')
        ORDER BY created_at DESC
        LIMIT 1
      `, [normalizedEmail]);

      if (fallbackCtv) {
        await db.run(`
          UPDATE ctv_accounts
          SET clerk_user_id = ?, updated_at = datetime('now')
          WHERE id = ? AND (clerk_user_id IS NULL OR TRIM(clerk_user_id) = '')
        `, [clerkUserId, fallbackCtv.id]);

        ctvAccount = await db.get('SELECT * FROM ctv_accounts WHERE id = ?', [fallbackCtv.id]);
      }
    }

    if (!companyAccount && normalizedEmail) {
      const fallbackCompany = await db.get(`
        SELECT * FROM companies
        WHERE LOWER(TRIM(email)) = ?
          AND (clerk_user_id IS NULL OR TRIM(clerk_user_id) = '')
        ORDER BY created_at DESC
        LIMIT 1
      `, [normalizedEmail]);

      if (fallbackCompany) {
        await db.run(`
          UPDATE companies
          SET clerk_user_id = ?, updated_at = datetime('now')
          WHERE id = ? AND (clerk_user_id IS NULL OR TRIM(clerk_user_id) = '')
        `, [clerkUserId, fallbackCompany.id]);

        companyAccount = await db.get('SELECT * FROM companies WHERE id = ?', [fallbackCompany.id]);
      }
    }

    await db.close();
    db = null;

    res.json({
      success: true,
      data: {
        ctv: ctvPayload(ctvAccount, email),
        company: companyPayload(companyAccount, email),
        email,
      },
    });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Get account status failed:', error);
    res.json({
      success: true,
      data: { ctv: null, company: null, email: fallbackEmail },
      warning: 'ACCOUNT_STATUS_UNAVAILABLE',
    });
  }
});

// POST /api/account/ctv-registration - Register CTV account
router.post('/ctv-registration', userAuth, async (req, res) => {
  let db;
  try {
    db = await openDb();
    const { clerkUserId, email } = req.user;
    const { name, phone, zaloPhone, bankAccount, bankName, province, district } = req.body;

    if (!name || !name.trim()) {
      await db.close(); db = null;
      return res.status(400).json({ success: false, error: 'MISSING_NAME', message: 'Họ tên là bắt buộc.' });
    }
    if (!phone || !phone.trim()) {
      await db.close(); db = null;
      return res.status(400).json({ success: false, error: 'MISSING_PHONE', message: 'Số điện thoại là bắt buộc.' });
    }

    const existingCtv = await db.get('SELECT id, status, ctv_code FROM ctv_accounts WHERE clerk_user_id = ?', [clerkUserId]);
    let ctvId;
    let ctvCode;
    let isNew = false;
    let previousStatus = null;

    if (existingCtv) {
      if (existingCtv.status === 'approved') {
        await db.run(`
          UPDATE ctv_accounts
          SET name = ?, phone = ?, zalo_phone = ?, bank_account = ?, bank_name = ?,
              province = ?, district = ?, updated_at = datetime('now')
          WHERE id = ?
        `, [name, phone, zaloPhone || null, bankAccount || null, bankName || null, province || null, district || null, existingCtv.id]);
        await db.close(); db = null;
        return res.json({ success: true, status: 'approved', message: 'Hồ sơ CTV đã được duyệt. Thông tin đã được cập nhật.', ctvCode: existingCtv.ctv_code });
      }

      if (existingCtv.status === 'pending') {
        await db.run(`
          UPDATE ctv_accounts
          SET name = ?, phone = ?, zalo_phone = ?, bank_account = ?, bank_name = ?,
              province = ?, district = ?, updated_at = datetime('now')
          WHERE id = ?
        `, [name, phone, zaloPhone || null, bankAccount || null, bankName || null, province || null, district || null, existingCtv.id]);
        await db.close(); db = null;
        return res.json({ success: true, status: 'pending', message: 'Hồ sơ CTV đang chờ admin duyệt.' });
      }

      if (existingCtv.status === 'rejected') {
        previousStatus = 'rejected';
        ctvId = existingCtv.id;
        ctvCode = existingCtv.ctv_code;
        await db.run(`
          UPDATE ctv_accounts
          SET status = 'pending', name = ?, phone = ?, zalo_phone = ?, bank_account = ?, bank_name = ?,
              province = ?, district = ?, rejection_reason = NULL,
              submitted_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `, [name, phone, zaloPhone || null, bankAccount || null, bankName || null, province || null, district || null, existingCtv.id]);
      } else {
        await db.close(); db = null;
        return res.status(403).json({ success: false, error: 'ACCOUNT_SUSPENDED', message: 'Tài khoản CTV đang bị tạm dừng hoặc bị cấm.' });
      }
    } else {
      isNew = true;
      ctvId = 'ctv-' + Date.now();
      ctvCode = generateCode('CTV');
      await db.run(`
        INSERT INTO ctv_accounts
        (id, ctv_code, clerk_user_id, name, phone, email, zalo_phone, bank_account, bank_name,
         province, district, status, submitted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'), datetime('now'))
      `, [ctvId, ctvCode, clerkUserId, name, phone, email || null, zaloPhone || null, bankAccount || null, bankName || null, province || null, district || null]);
    }

    await createAuditLog(db, 'ctv_accounts', ctvId, previousStatus ? 'resubmitted' : (isNew ? 'created' : 'updated'), 'ctv', ctvId, { previousStatus, submittedBy: clerkUserId });
    await db.close(); db = null;
    res.json({ success: true, status: 'pending', message: 'Đăng ký CTV thành công. Hồ sơ đang chờ admin duyệt.', ctvCode });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('CTV registration failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/account/company-registration - Register Company account
router.post('/company-registration', userAuth, async (req, res) => {
  let db;
  try {
    db = await openDb();
    const { clerkUserId, email } = req.user;
    const { companyName, phone, email: companyEmail, taxId, address, province, district } = req.body;

    if (!companyName || !companyName.trim()) {
      await db.close(); db = null;
      return res.status(400).json({ success: false, error: 'MISSING_COMPANY_NAME', message: 'Tên công ty là bắt buộc.' });
    }
    if (!phone || !phone.trim()) {
      await db.close(); db = null;
      return res.status(400).json({ success: false, error: 'MISSING_PHONE', message: 'Số điện thoại là bắt buộc.' });
    }
    if (!taxId || !taxId.trim()) {
      await db.close(); db = null;
      return res.status(400).json({ success: false, error: 'MISSING_TAX_CODE', message: 'Mã số thuế là bắt buộc để xác minh công ty.' });
    }

    const existingCompany = await db.get('SELECT id, company_code, status FROM companies WHERE clerk_user_id = ?', [clerkUserId]);
    let companyId;
    let companyCode;
    let isNew = false;
    let previousStatus = null;

    if (existingCompany) {
      if (existingCompany.status === 'approved') {
        await db.run(`
          UPDATE companies
          SET name = ?, phone = ?, email = ?, tax_code = ?, address = ?,
              province = ?, district = ?, updated_at = datetime('now')
          WHERE id = ?
        `, [companyName, phone, companyEmail || email || null, taxId || null, address || null, province || null, district || null, existingCompany.id]);
        await db.close(); db = null;
        return res.json({ success: true, status: 'approved', message: 'Hồ sơ công ty đã được duyệt. Thông tin đã được cập nhật.', companyCode: existingCompany.company_code });
      }

      if (existingCompany.status === 'pending') {
        await db.run(`
          UPDATE companies
          SET name = ?, phone = ?, email = ?, tax_code = ?, address = ?,
              province = ?, district = ?, updated_at = datetime('now')
          WHERE id = ?
        `, [companyName, phone, companyEmail || email || null, taxId || null, address || null, province || null, district || null, existingCompany.id]);
        await db.close(); db = null;
        return res.json({ success: true, status: 'pending', message: 'Hồ sơ công ty đang chờ admin duyệt.' });
      }

      if (existingCompany.status === 'rejected') {
        previousStatus = 'rejected';
        companyId = existingCompany.id;
        companyCode = existingCompany.company_code;
        await db.run(`
          UPDATE companies
          SET status = 'pending', name = ?, phone = ?, email = ?, tax_code = ?, address = ?,
              province = ?, district = ?, rejection_reason = NULL,
              submitted_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ?
        `, [companyName, phone, companyEmail || email || null, taxId || null, address || null, province || null, district || null, existingCompany.id]);
      } else {
        await db.close(); db = null;
        return res.status(403).json({ success: false, error: 'ACCOUNT_SUSPENDED', message: 'Tài khoản công ty đang bị tạm dừng.' });
      }
    } else {
      isNew = true;
      companyId = 'comp-' + Date.now();
      companyCode = generateCode('CMP');
      await db.run(`
        INSERT INTO companies
        (id, company_code, clerk_user_id, name, phone, email, tax_code, address,
         province, district, status, submitted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'), datetime('now'))
      `, [companyId, companyCode, clerkUserId, companyName, phone, companyEmail || email || null, taxId || null, address || null, province || null, district || null]);
    }

    await createAuditLog(db, 'companies', companyId, previousStatus ? 'resubmitted' : (isNew ? 'created' : 'updated'), 'company', companyId, { previousStatus, submittedBy: clerkUserId });
    await db.close(); db = null;
    res.json({ success: true, status: 'pending', message: 'Đăng ký công ty thành công. Hồ sơ đang chờ admin duyệt.', companyCode });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Company registration failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
