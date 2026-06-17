/**
 * Marketplace API Routes
 * Phase 3-lite: Lead engine API
 */

import express from 'express';
const router = express.Router();
import { openDb } from '../database.js';
import { userAuth } from '../middleware/userAuth.js';
import companyDashboardRoutes from './companyDashboard.js';
import savedJobsRoutes from './savedJobs.js';

function normalizePhone(phone) {
  let normalized = String(phone || '').replace(/\D/g, '');
  if (normalized.startsWith('0')) normalized = '84' + normalized.substring(1);
  if (normalized && !normalized.startsWith('84')) normalized = '84' + normalized;
  return normalized;
}

function generateCode(prefix) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

function normalizeAdminAction(action) {
  const value = String(action || '').trim().toLowerCase();
  if (['approve', 'reject', 'block', 'unblock'].includes(value)) return value;
  return '';
}

function actionToAccountStatus(action) {
  if (action === 'approve' || action === 'unblock') return 'active';
  if (action === 'block' || action === 'reject') return 'suspended';
  return null;
}

async function updateAccountStatus({ db, table, entityType, id, action, adminId, reason }) {
  const status = actionToAccountStatus(action);
  if (!status) {
    const error = new Error('Invalid account action');
    error.statusCode = 400;
    throw error;
  }

  const clearReason = action === 'approve' || action === 'unblock';
  const nextReason = clearReason ? null : (String(reason || '').trim() || null);
  const nowStatusFields = status === 'active' ? ', approved_at = datetime(\'now\'), approved_by = ?' : '';
  const statusArgs = status === 'active' ? [adminId || 'admin'] : [];

  const result = await db.run(`
    UPDATE ${table}
    SET status = ?,
        rejection_reason = ?,
        updated_at = datetime('now')
        ${nowStatusFields}
    WHERE id = ?
  `, [status, nextReason, ...statusArgs, id]);

  if (!Number(result?.changes || 0)) {
    const error = new Error('Account not found');
    error.statusCode = 404;
    throw error;
  }

  await db.run(`
    INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
    VALUES (?, ?, ?, ?, 'admin', ?, ?)
  `, [generateCode('AUD'), entityType, id, `${entityType}_${action}`, adminId || 'admin', JSON.stringify({ status, reason: nextReason })]);

  return { status, rejection_reason: nextReason };
}

async function ensureCampaignPublicColumns(db) {
  const tableInfo = await db.all(`PRAGMA table_info(campaigns)`);
  const existing = new Set(tableInfo.map((column) => String(column.name || '').trim()));
  if (!existing.has('promoted_until')) await db.exec(`ALTER TABLE campaigns ADD COLUMN promoted_until TEXT`);
  if (!existing.has('is_public')) await db.exec(`ALTER TABLE campaigns ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1`);
}

function pickCampaignVisibility({ isPublic, ctvEnabled }) {
  if (isPublic) return 'public_candidate';
  if (ctvEnabled) return 'ctv_private';
  return 'draft';
}

router.use(companyDashboardRoutes);
router.use('/account', savedJobsRoutes);

router.get('/jobs', async (req, res) => {
  let db;
  try {
    db = await openDb();
    await ensureCampaignPublicColumns(db);
    const jobs = await db.all(`
      SELECT c.id, c.campaign_code, c.title, c.job_type, c.location, c.province, c.district,
             c.salary_text, c.shift_text, c.quantity_needed, c.updated_at,
             comp.name as company_name, comp.company_code,
             CASE WHEN c.promoted_until IS NOT NULL AND datetime(c.promoted_until) > datetime('now') THEN 1 ELSE 0 END as is_promoted
      FROM campaigns c
      JOIN companies comp ON c.company_id = comp.id
      WHERE c.status = 'active' AND COALESCE(c.is_public, 1) = 1
      ORDER BY is_promoted DESC, c.updated_at DESC
    `);
    await db.close();
    db = null;
    res.json({ success: true, data: jobs });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Fetch public jobs failed:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

router.post('/company/campaigns', userAuth, async (req, res) => {
  let db;
  try {
    db = await openDb();
    const clerkUserId = req.user.clerkUserId;
    const company = await db.get('SELECT * FROM companies WHERE clerk_user_id = ?', [clerkUserId]);

    if (!company) {
      await db.close();
      db = null;
      return res.status(403).json({ success: false, error: 'COMPANY_NOT_REGISTERED', message: 'You have not registered a company profile.' });
    }

    if (company.status !== 'approved' && company.status !== 'active') {
      await db.close();
      db = null;
      return res.status(403).json({ success: false, error: 'COMPANY_NOT_APPROVED', message: 'Your company profile is not approved yet.' });
    }

    if (company.plan_code === 'free' && Number(company.used_job_posts_count || 0) >= Number(company.free_job_posts_limit || 0)) {
      await db.close();
      db = null;
      return res.status(403).json({ success: false, error: 'QUOTA_EXCEEDED', message: 'Công ty đã dùng hết số tin đăng miễn phí.' });
    }

    const { title, description, job_type, province, district, location, salary_text, shift_text, quantity_needed, bounty_amount, qualification_days, is_public, ctv_enabled, status } = req.body;
    if (!title || !String(title).trim()) {
      await db.close();
      db = null;
      return res.status(400).json({ success: false, error: 'MISSING_TITLE', message: 'Thiếu tiêu đề chiến dịch.' });
    }

    const finalBounty = Number(bounty_amount || 0);
    const finalCtvReward = Number(req.body.ctv_reward_amount) || Math.floor(finalBounty * 0.8);
    const finalPlatformFee = Math.max(0, finalBounty - finalCtvReward);
    const publicFlag = is_public === true || is_public === 1 || is_public === '1';
    const ctvFlag = ctv_enabled === true || ctv_enabled === 1 || ctv_enabled === '1';

    if (ctvFlag && finalBounty <= 0 && !req.body.ctv_reward_amount) {
      await db.close();
      db = null;
      return res.status(400).json({ success: false, error: 'MISSING_BOUNTY', message: 'Campaign with CTV enabled requires bounty or ctv_reward_amount' });
    }

    const campaignId = `CP${Date.now()}`;
    const campaignCode = generateCode('CMP');
    const now = new Date().toISOString();
    const visibility = pickCampaignVisibility({ isPublic: publicFlag, ctvEnabled: ctvFlag });
    const safeStatus = ['draft', 'pending', 'active', 'paused', 'closed'].includes(status) ? status : 'pending';

    const columns = ['id', 'campaign_code', 'company_id', 'title', 'description', 'job_type', 'province', 'district', 'location', 'salary_text', 'shift_text', 'quantity_needed', 'bounty_amount', 'ctv_reward_amount', 'platform_fee_amount', 'qualification_days', 'status', 'visibility', 'is_public', 'ctv_enabled', 'created_at', 'updated_at'];
    const values = [campaignId, campaignCode, company.id, String(title).trim(), description || '', job_type || '', province || '', district || '', location || '', salary_text || '', shift_text || '', Number(quantity_needed || 1), finalBounty, finalCtvReward, finalPlatformFee, Number(qualification_days || 7), safeStatus, visibility, publicFlag ? 1 : 0, ctvFlag ? 1 : 0, now, now];

    await db.run(`INSERT INTO campaigns (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
    await db.run('UPDATE companies SET used_job_posts_count = COALESCE(used_job_posts_count, 0) + 1 WHERE id = ?', [company.id]);
    await db.run(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details) VALUES (?, 'campaign', ?, 'created', 'company', ?, ?)`, [generateCode('AUD'), campaignId, company.id, JSON.stringify({ title, bounty_amount, visibility, status: safeStatus })]);

    await db.close();
    db = null;
    return res.status(201).json({ success: true, data: { id: campaignId, campaign_code: campaignCode, title, status: safeStatus } });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Create campaign failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin/ctv/:id/:action', async (req, res) => {
  let db;
  try {
    const action = normalizeAdminAction(req.params.action);
    if (!action) return res.status(400).json({ success: false, error: 'INVALID_ACTION' });
    db = await openDb();
    const result = await updateAccountStatus({ db, table: 'ctv_accounts', entityType: 'ctv_accounts', id: req.params.id, action, adminId: req.body?.admin_id, reason: req.body?.reason || req.body?.rejection_reason || req.body?.note });
    await db.close();
    db = null;
    res.json({ success: true, message: 'CTV account updated', data: result });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    res.status(error?.statusCode || 500).json({ success: false, error: error.message });
  }
});

router.post('/admin/company/:id/:action', async (req, res) => {
  let db;
  try {
    const action = normalizeAdminAction(req.params.action);
    if (!action) return res.status(400).json({ success: false, error: 'INVALID_ACTION' });
    db = await openDb();
    const result = await updateAccountStatus({ db, table: 'companies', entityType: 'companies', id: req.params.id, action, adminId: req.body?.admin_id, reason: req.body?.reason || req.body?.rejection_reason || req.body?.note });
    await db.close();
    db = null;
    res.json({ success: true, message: 'Company account updated', data: result });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    res.status(error?.statusCode || 500).json({ success: false, error: error.message });
  }
});

router.put('/admin/company/:id', async (req, res) => {
  let db;
  try {
    db = await openDb();
    const { id } = req.params;
    const { name, phone, email, tax_code, address, province, district, status, trust_level, deposit_status, lead_trial_limit, require_deposit_after_leads, is_featured, plan_code, free_job_posts_limit, weekly_push_limit, used_job_posts_count, used_push_count, admin_id } = req.body;
    await db.run(`
      UPDATE companies SET
        name = COALESCE(?, name), phone = COALESCE(?, phone), email = COALESCE(?, email), tax_code = COALESCE(?, tax_code), address = COALESCE(?, address), province = COALESCE(?, province), district = COALESCE(?, district), status = COALESCE(?, status), trust_level = COALESCE(?, trust_level), deposit_status = COALESCE(?, deposit_status), lead_trial_limit = COALESCE(?, lead_trial_limit), require_deposit_after_leads = COALESCE(?, require_deposit_after_leads), is_featured = COALESCE(?, is_featured), plan_code = COALESCE(?, plan_code), free_job_posts_limit = COALESCE(?, free_job_posts_limit), weekly_push_limit = COALESCE(?, weekly_push_limit), used_job_posts_count = COALESCE(?, used_job_posts_count), used_push_count = COALESCE(?, used_push_count), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, phone, email, tax_code, address, province, district, status, trust_level, deposit_status, lead_trial_limit, require_deposit_after_leads, is_featured, plan_code, free_job_posts_limit, weekly_push_limit, used_job_posts_count, used_push_count, id]);
    await db.run(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details) VALUES (?, 'companies', ?, 'update_admin', 'admin', ?, ?)`, [generateCode('AUD'), id, admin_id || 'admin', JSON.stringify(req.body)]);
    await db.close();
    db = null;
    res.json({ success: true, message: 'Company updated by admin' });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin/company/:id/wallet/deposit', async (req, res) => {
  let db;
  try {
    db = await openDb();
    const { id } = req.params;
    const { amount, transaction_reference, note, admin_id } = req.body;
    if (!amount || amount <= 0) {
      await db.close();
      db = null;
      return res.status(400).json({ success: false, error: 'INVALID_AMOUNT' });
    }
    await db.run('BEGIN TRANSACTION');
    const company = await db.get('SELECT wallet_balance FROM companies WHERE id = ?', [id]);
    if (!company) {
      await db.run('ROLLBACK');
      await db.close();
      db = null;
      return res.status(404).json({ success: false, error: 'COMPANY_NOT_FOUND' });
    }
    const newBalance = Number(company.wallet_balance || 0) + Number(amount);
    await db.run('UPDATE companies SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newBalance, id]);
    const transId = generateCode('WAL');
    await db.run(`INSERT INTO wallet_transactions (id, company_id, transaction_type, amount, balance_after, reference_id, description) VALUES (?, ?, 'deposit', ?, ?, ?, ?)`, [transId, id, Number(amount), newBalance, transaction_reference, note || 'Admin deposit']);
    await db.run(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details) VALUES (?, 'companies', ?, 'wallet_deposit', 'admin', ?, ?)`, [generateCode('AUD'), id, admin_id || 'admin', JSON.stringify({ amount, transaction_reference })]);
    await db.run('COMMIT');
    await db.close();
    db = null;
    res.json({ success: true, message: 'Deposit successful', data: { new_balance: newBalance } });
  } catch (error) {
    try { await db?.run?.('ROLLBACK'); } catch {}
    try { await db?.close?.(); } catch {}
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/admin/company/:id/wallet/adjust', async (req, res) => {
  let db;
  try {
    db = await openDb();
    const { id } = req.params;
    const { amount, note, admin_id } = req.body;
    if (amount === undefined || isNaN(Number(amount))) {
      await db.close();
      db = null;
      return res.status(400).json({ success: false, error: 'INVALID_AMOUNT' });
    }
    await db.run('BEGIN TRANSACTION');
    const company = await db.get('SELECT wallet_balance FROM companies WHERE id = ?', [id]);
    if (!company) {
      await db.run('ROLLBACK');
      await db.close();
      db = null;
      return res.status(404).json({ success: false, error: 'COMPANY_NOT_FOUND' });
    }
    const signedAmount = Number(amount);
    const newBalance = Number(company.wallet_balance || 0) + signedAmount;
    if (newBalance < 0) {
      await db.run('ROLLBACK');
      await db.close();
      db = null;
      return res.status(400).json({ success: false, error: 'INSUFFICIENT_BALANCE' });
    }
    await db.run('UPDATE companies SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newBalance, id]);
    const transId = generateCode('WAL');
    const transactionType = signedAmount >= 0 ? 'deposit' : 'withdrawal';
    await db.run(`INSERT INTO wallet_transactions (id, company_id, transaction_type, amount, balance_after, reference_id, description) VALUES (?, ?, ?, ?, ?, NULL, ?)`, [transId, id, transactionType, signedAmount, newBalance, note || 'Admin adjustment']);
    await db.run(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details) VALUES (?, 'companies', ?, 'wallet_adjust', 'admin', ?, ?)`, [generateCode('AUD'), id, admin_id || 'admin', JSON.stringify({ amount, note })]);
    await db.run('COMMIT');
    await db.close();
    db = null;
    res.json({ success: true, message: 'Balance adjusted', data: { new_balance: newBalance } });
  } catch (error) {
    try { await db?.run?.('ROLLBACK'); } catch {}
    try { await db?.close?.(); } catch {}
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
