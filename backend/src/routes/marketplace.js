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

function normalizeBoolean(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function isAllowedCompanyStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  return value === 'active' || value === 'approved';
}

function pickCampaignVisibility({ isPublic, ctvEnabled }) {
  if (isPublic) return 'public_candidate';
  if (ctvEnabled) return 'ctv_private';
  return 'draft';
}

async function ensureCampaignPublicColumns(db) {
  const tableInfo = await db.all(`PRAGMA table_info(campaigns)`);
  const existing = new Set(tableInfo.map((column) => String(column.name || '').trim()));
  if (!existing.has('promoted_until')) await db.exec(`ALTER TABLE campaigns ADD COLUMN promoted_until TEXT`);
  if (!existing.has('is_public')) await db.exec(`ALTER TABLE campaigns ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1`);
}

async function getOwnedCompany(db, req) {
  const company = await db.get('SELECT * FROM companies WHERE clerk_user_id = ?', [req.user.clerkUserId]);
  if (!company) {
    const error = new Error('Company account is not registered.');
    error.statusCode = 403;
    error.code = 'COMPANY_NOT_REGISTERED';
    throw error;
  }
  if (!isAllowedCompanyStatus(company.status)) {
    const error = new Error('Company account is not approved yet.');
    error.statusCode = 403;
    error.code = 'COMPANY_NOT_APPROVED';
    throw error;
  }
  return company;
}

async function getOwnedCampaign(db, req, campaignId) {
  const company = await getOwnedCompany(db, req);
  const campaign = await db.get('SELECT * FROM campaigns WHERE id = ? AND company_id = ?', [campaignId, company.id]);
  if (!campaign) {
    const error = new Error('Campaign not found');
    error.statusCode = 404;
    error.code = 'CAMPAIGN_NOT_FOUND';
    throw error;
  }
  return { company, campaign };
}

function buildCampaignPayload(body = {}, companyId, fallback = {}) {
  const title = String(body.title ?? fallback.title ?? '').trim();
  if (!title) {
    const error = new Error('Thiếu tiêu đề chiến dịch.');
    error.statusCode = 400;
    error.code = 'MISSING_TITLE';
    throw error;
  }

  const bounty = Number(body.bounty_amount ?? fallback.bounty_amount ?? 0);
  const ctvReward = Number(body.ctv_reward_amount ?? fallback.ctv_reward_amount ?? Math.floor(bounty * 0.8));
  const platformFee = Math.max(0, bounty - ctvReward);
  const isPublic = normalizeBoolean(body.is_public ?? fallback.is_public ?? true);
  const ctvEnabled = normalizeBoolean(body.ctv_enabled ?? fallback.ctv_enabled ?? true);

  if (ctvEnabled && bounty <= 0 && !body.ctv_reward_amount && !fallback.ctv_reward_amount) {
    const error = new Error('Campaign with CTV enabled requires bounty or ctv_reward_amount');
    error.statusCode = 400;
    error.code = 'MISSING_BOUNTY';
    throw error;
  }

  const safeStatus = ['draft', 'pending', 'active', 'paused', 'closed'].includes(body.status) ? body.status : (fallback.status || 'pending');
  const province = body.province ?? fallback.province ?? '';
  const district = body.district ?? fallback.district ?? '';

  return {
    company_id: companyId,
    title,
    description: body.description ?? fallback.description ?? '',
    job_type: body.job_type ?? fallback.job_type ?? '',
    province,
    district,
    location: body.location ?? fallback.location ?? [district, province].filter(Boolean).join(', '),
    salary_text: body.salary_text ?? fallback.salary_text ?? '',
    shift_text: body.shift_text ?? fallback.shift_text ?? '',
    quantity_needed: Number(body.quantity_needed ?? fallback.quantity_needed ?? 1),
    bounty_amount: bounty,
    ctv_reward_amount: ctvReward,
    platform_fee_amount: platformFee,
    qualification_days: Number(body.qualification_days ?? fallback.qualification_days ?? 7),
    status: safeStatus,
    visibility: pickCampaignVisibility({ isPublic, ctvEnabled }),
    is_public: isPublic ? 1 : 0,
    ctv_enabled: ctvEnabled ? 1 : 0,
  };
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
    SET status = ?, rejection_reason = ?, updated_at = datetime('now') ${nowStatusFields}
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
    const company = await getOwnedCompany(db, req);
    if (company.plan_code === 'free' && Number(company.used_job_posts_count || 0) >= Number(company.free_job_posts_limit || 0)) {
      return res.status(403).json({ success: false, error: 'QUOTA_EXCEEDED', message: 'Công ty đã dùng hết số tin đăng miễn phí.' });
    }

    const data = buildCampaignPayload(req.body, company.id);
    const campaignId = `CP${Date.now()}`;
    const campaignCode = generateCode('CMP');
    const now = new Date().toISOString();
    await db.run(`
      INSERT INTO campaigns (
        id, campaign_code, company_id, title, description, job_type, province, district, location,
        salary_text, shift_text, quantity_needed, bounty_amount, ctv_reward_amount, platform_fee_amount,
        qualification_days, status, visibility, is_public, ctv_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      campaignId, campaignCode, data.company_id, data.title, data.description, data.job_type, data.province,
      data.district, data.location, data.salary_text, data.shift_text, data.quantity_needed, data.bounty_amount,
      data.ctv_reward_amount, data.platform_fee_amount, data.qualification_days, data.status, data.visibility,
      data.is_public, data.ctv_enabled, now, now,
    ]);
    await db.run('UPDATE companies SET used_job_posts_count = COALESCE(used_job_posts_count, 0) + 1 WHERE id = ?', [company.id]);
    await db.run(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details) VALUES (?, 'campaign', ?, 'created', 'company', ?, ?)`, [generateCode('AUD'), campaignId, company.id, JSON.stringify({ title: data.title, bounty_amount: data.bounty_amount, visibility: data.visibility, status: data.status })]);
    await db.close();
    db = null;
    res.status(201).json({ success: true, data: { id: campaignId, campaign_code: campaignCode, title: data.title, status: data.status } });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Create campaign failed:', error);
    res.status(error?.statusCode || 500).json({ success: false, error: error.code || error.message, message: error.message });
  }
});

router.put('/company/campaigns/:id', userAuth, async (req, res) => {
  let db;
  try {
    db = await openDb();
    const { company, campaign } = await getOwnedCampaign(db, req, req.params.id);
    const data = buildCampaignPayload(req.body, company.id, campaign);
    await db.run(`
      UPDATE campaigns
      SET title = ?, description = ?, job_type = ?, province = ?, district = ?, location = ?,
          salary_text = ?, shift_text = ?, quantity_needed = ?, bounty_amount = ?, ctv_reward_amount = ?,
          platform_fee_amount = ?, qualification_days = ?, status = ?, visibility = ?, is_public = ?,
          ctv_enabled = ?, updated_at = datetime('now')
      WHERE id = ? AND company_id = ?
    `, [
      data.title, data.description, data.job_type, data.province, data.district, data.location,
      data.salary_text, data.shift_text, data.quantity_needed, data.bounty_amount, data.ctv_reward_amount,
      data.platform_fee_amount, data.qualification_days, data.status, data.visibility, data.is_public,
      data.ctv_enabled, req.params.id, company.id,
    ]);
    await db.run(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details) VALUES (?, 'campaign', ?, 'updated', 'company', ?, ?)`, [generateCode('AUD'), req.params.id, company.id, JSON.stringify({ title: data.title, status: data.status })]);
    const updated = await db.get('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    await db.close();
    db = null;
    res.json({ success: true, data: updated });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Update campaign failed:', error);
    res.status(error?.statusCode || 500).json({ success: false, error: error.code || error.message, message: error.message });
  }
});

router.delete('/company/campaigns/:id', userAuth, async (req, res) => {
  let db;
  try {
    db = await openDb();
    const { company } = await getOwnedCampaign(db, req, req.params.id);
    const leadCount = await db.get('SELECT COUNT(*) AS count FROM lead_submissions WHERE campaign_id = ?', [req.params.id]);
    if (Number(leadCount?.count || 0) > 0) {
      return res.status(409).json({ success: false, error: 'CAMPAIGN_HAS_LEADS', message: 'Chiến dịch đã có lead, không thể xóa. Hãy tạm dừng hoặc đóng chiến dịch.' });
    }
    await db.run('DELETE FROM campaigns WHERE id = ? AND company_id = ?', [req.params.id, company.id]);
    await db.run(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details) VALUES (?, 'campaign', ?, 'deleted', 'company', ?, ?)`, [generateCode('AUD'), req.params.id, company.id, JSON.stringify({})]);
    await db.close();
    db = null;
    res.json({ success: true, deletedCount: 1 });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Delete campaign failed:', error);
    res.status(error?.statusCode || 500).json({ success: false, error: error.code || error.message, message: error.message });
  }
});

router.post('/company/campaigns/:id/push', userAuth, async (req, res) => {
  let db;
  try {
    db = await openDb();
    const { company } = await getOwnedCampaign(db, req, req.params.id);
    const used = Number(company.used_push_count || 0);
    const limit = Number(company.weekly_push_limit || 0);
    if (limit > 0 && used >= limit) {
      return res.status(403).json({ success: false, error: 'PUSH_QUOTA_EXCEEDED', message: 'Công ty đã dùng hết lượt đẩy tin trong tuần.' });
    }
    const promotedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await db.run('UPDATE campaigns SET promoted_until = ?, updated_at = datetime(\'now\') WHERE id = ? AND company_id = ?', [promotedUntil, req.params.id, company.id]);
    await db.run('UPDATE companies SET used_push_count = COALESCE(used_push_count, 0) + 1 WHERE id = ?', [company.id]);
    await db.run(`INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details) VALUES (?, 'campaign', ?, 'pushed', 'company', ?, ?)`, [generateCode('AUD'), req.params.id, company.id, JSON.stringify({ promoted_until: promotedUntil })]);
    await db.close();
    db = null;
    res.json({ success: true, data: { promoted_until: promotedUntil } });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Push campaign failed:', error);
    res.status(error?.statusCode || 500).json({ success: false, error: error.code || error.message, message: error.message });
  }
});

router.post('/company/leads/:id/claim', userAuth, async (req, res) => {
  let db;
  try {
    db = await openDb();
    const company = await getOwnedCompany(db, req);
    const lead = await db.get(`
      SELECT l.*, c.company_id, c.bounty_amount
      FROM lead_submissions l
      JOIN campaigns c ON c.id = l.campaign_id
      WHERE l.id = ? OR l.lead_code = ?
      LIMIT 1
    `, [req.params.id, req.params.id]);
    if (!lead) return res.status(404).json({ success: false, error: 'LEAD_NOT_FOUND', message: 'Không tìm thấy lead.' });
    if (lead.company_id !== company.id) return res.status(403).json({ success: false, error: 'LEAD_FORBIDDEN', message: 'Lead không thuộc công ty này.' });
    if (lead.claimed_by_company_id && lead.claimed_by_company_id !== company.id) return res.status(409).json({ success: false, error: 'LEAD_ALREADY_CLAIMED', message: 'Lead đã được nhận bởi công ty khác.' });

    const bounty = Number(lead.bounty_amount || 0);
    const balance = Number(company.wallet_balance || 0);
    const creditLimit = Number(company.credit_limit || 0);
    if (!lead.claimed_by_company_id && balance + creditLimit < bounty) {
      return res.status(402).json({ success: false, error: 'INSUFFICIENT_BALANCE', message: 'Số dư ví không đủ để nhận lead.' });
    }

    if (!lead.claimed_by_company_id) {
      const newBalance = balance - bounty;
      await db.run('UPDATE companies SET wallet_balance = ?, updated_at = datetime(\'now\') WHERE id = ?', [newBalance, company.id]);
      await db.run('UPDATE lead_submissions SET status = ?, is_anonymous = 0, claimed_by_company_id = ?, claimed_at = datetime(\'now\') WHERE id = ?', ['claimed', company.id, lead.id]);
      await db.run(`INSERT INTO wallet_transactions (id, company_id, transaction_type, amount, balance_after, reference_id, description) VALUES (?, ?, 'lead_claim', ?, ?, ?, ?)`, [generateCode('WAL'), company.id, -bounty, newBalance, lead.id, 'Company claimed lead']);
    }

    await db.close();
    db = null;
    res.json({ success: true, data: { bounty_paid: lead.claimed_by_company_id ? 0 : bounty } });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Claim lead failed:', error);
    res.status(error?.statusCode || 500).json({ success: false, error: error.code || error.message, message: error.message });
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
