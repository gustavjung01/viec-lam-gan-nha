/**
 * Marketplace API Routes
 * Phase 3-lite: Lead engine API
 */

import express from 'express';
const router = express.Router();
import { openDb } from '../database.js';
import { userAuth } from '../middleware/userAuth.js';
import { sendNotification } from '../utils/notification.js';

// Helper: Normalize phone number
function normalizePhone(phone) {
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('0')) {
    normalized = '84' + normalized.substring(1);
  }
  if (!normalized.startsWith('84')) {
    normalized = '84' + normalized;
  }
  return normalized;
}

// Helper: Generate unique code
function generateCode(prefix) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

// ============== PUBLIC API ==============

// GET /api/jobs - Get public jobs
router.get('/jobs', async (req, res) => {
  try {
    const db = await openDb();
    const jobs = await db.all(`
      SELECT c.id, c.campaign_code, c.title, c.job_type, c.location, c.province, c.district,
             c.salary_text, c.shift_text, c.quantity_needed, c.updated_at,
             comp.name as company_name, comp.company_code,
             CASE WHEN c.promoted_until > datetime('now') THEN 1 ELSE 0 END as is_promoted
      FROM campaigns c
      JOIN companies comp ON c.company_id = comp.id
      WHERE c.status = 'active' AND c.is_public = 1
      ORDER BY is_promoted DESC, c.updated_at DESC
    `);
    await db.close();
    res.json({ success: true, data: jobs });
  } catch (error) {
    console.error('Fetch public jobs failed:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// ============== COMPANY API ==============

// POST /api/company/campaigns - Create new campaign
router.post('/company/campaigns', userAuth, async (req, res) => {
  try {
    const db = await openDb();
    
    const clerkUserId = req.user.clerkUserId;
    const company = await db.get('SELECT * FROM companies WHERE clerk_user_id = ?', clerkUserId);
    
    if (!company) {
      await db.close();
      return res.status(403).json({
        success: false,
        error: 'COMPANY_NOT_REGISTERED',
        message: 'You have not registered a company profile.'
      });
    }

    if (company.status !== 'approved' && company.status !== 'active') {
      await db.close();
      return res.status(403).json({
        success: false,
        error: 'COMPANY_NOT_APPROVED',
        message: 'Your company profile is not approved yet.'
      });
    }

    // Quota check for free plan
    if (company.plan_code === 'free' && company.used_job_posts_count >= company.free_job_posts_limit) {
      await db.close();
      return res.status(403).json({
        success: false,
        error: 'QUOTA_EXCEEDED',
        message: 'Công ty đã dùng hết số tin đăng miễn phí.'
      });
    }

    const {
      title, description, job_type, province, district, location, salary_text, shift_text,
      quantity_needed, bounty_amount, qualification_days, is_public, ctv_enabled, status
    } = req.body;

    const finalBounty = Number(bounty_amount || 0);
    const finalCtvReward = Number(req.body.ctv_reward_amount) || Math.floor(finalBounty * 0.8);
    const finalPlatformFee = finalBounty - finalCtvReward;
    const feePct = finalBounty > 0 ? 20 : 0;

    if (ctv_enabled && finalBounty <= 0 && !req.body.ctv_reward_amount) {
      await db.close();
      return res.status(400).json({
        success: false,
        error: 'MISSING_BOUNTY',
        message: 'Campaign with CTV enabled requires bounty or ctv_reward_amount'
      });
    }

    const campaignId = `CP${Date.now()}`;
    const campaignCode = generateCode('CMP');
    const now = new Date().toISOString();

    const columns = [
      'id', 'campaign_code', 'company_id', 'title', 'description', 'job_type',
      'province', 'district', 'location', 'salary_text', 'shift_text',
      'quantity_needed', 'bounty_amount', 'ctv_reward_amount', 'platform_fee_amount',
      'qualification_days', 'status', 'visibility',
      'is_public', 'ctv_enabled', 'platform_fee_percentage',
      'created_at', 'updated_at'
    ];

    const visibility = is_public ? 'public' : 'ctv_public';
    const values = [
      campaignId, campaignCode, company.id, title, description, job_type,
      province, district, location, salary_text, shift_text,
      Number(quantity_needed || 1), finalBounty, finalCtvReward, finalPlatformFee,
      Number(qualification_days || 7), status || 'pending', visibility,
      is_public ? 1 : 0, ctv_enabled ? 1 : 0, feePct,
      now, now
    ];

    await db.run(`INSERT INTO campaigns (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
    await db.run('UPDATE companies SET used_job_posts_count = used_job_posts_count + 1 WHERE id = ?', company.id);

    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'campaign', ?, 'created', 'company', ?, ?)
    `, [generateCode('AUD'), campaignId, company.id, JSON.stringify({ title, bounty_amount })]);

    await db.close();
    return res.status(201).json({
      success: true,
      data: { id: campaignId, campaign_code: campaignCode, title, status: status || 'pending' }
    });
  } catch (error) {
    console.error('Create campaign failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/admin/company/:id - Admin update company
router.put('/admin/company/:id', async (req, res) => {
  try {
    const db = await openDb();
    const { id } = req.params;
    const {
      name, phone, email, tax_code, address, province, district, status,
      trust_level, deposit_status, lead_trial_limit, require_deposit_after_leads,
      is_featured, plan_code, free_job_posts_limit, weekly_push_limit,
      used_job_posts_count, used_push_count,
      admin_id
    } = req.body;

    await db.run(`
      UPDATE companies SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        tax_code = COALESCE(?, tax_code),
        address = COALESCE(?, address),
        province = COALESCE(?, province),
        district = COALESCE(?, district),
        status = COALESCE(?, status),
        trust_level = COALESCE(?, trust_level),
        deposit_status = COALESCE(?, deposit_status),
        lead_trial_limit = COALESCE(?, lead_trial_limit),
        require_deposit_after_leads = COALESCE(?, require_deposit_after_leads),
        is_featured = COALESCE(?, is_featured),
        plan_code = COALESCE(?, plan_code),
        free_job_posts_limit = COALESCE(?, free_job_posts_limit),
        weekly_push_limit = COALESCE(?, weekly_push_limit),
        used_job_posts_count = COALESCE(?, used_job_posts_count),
        used_push_count = COALESCE(?, used_push_count),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name, phone, email, tax_code, address, province, district, status,
      trust_level, deposit_status, lead_trial_limit, require_deposit_after_leads,
      is_featured, plan_code, free_job_posts_limit, weekly_push_limit,
      used_job_posts_count, used_push_count,
      id
    ]);

    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'companies', ?, 'update_admin', 'admin', ?, ?)
    `, [generateCode('AUD'), id, admin_id || 'admin', JSON.stringify(req.body)]);

    await db.close();
    res.json({ success: true, message: 'Company updated by admin' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/company/:id/wallet/deposit
router.post('/admin/company/:id/wallet/deposit', async (req, res) => {
  try {
    const db = await openDb();
    const { id } = req.params;
    const { amount, transaction_reference, note, admin_id } = req.body;

    if (!amount || amount <= 0) {
      await db.close();
      return res.status(400).json({ success: false, error: 'INVALID_AMOUNT' });
    }

    await db.run('BEGIN TRANSACTION');

    const company = await db.get('SELECT wallet_balance FROM companies WHERE id = ?', id);
    if (!company) {
      await db.run('ROLLBACK');
      await db.close();
      return res.status(404).json({ success: false, error: 'COMPANY_NOT_FOUND' });
    }

    const newBalance = company.wallet_balance + Number(amount);
    
    // 1. Update company balance
    await db.run('UPDATE companies SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newBalance, id]);

    // 2. Insert wallet transaction
    const transId = generateCode('WAL');
    await db.run(`
      INSERT INTO wallet_transactions (id, company_id, transaction_type, amount, balance_after, reference_id, description)
      VALUES (?, ?, 'deposit', ?, ?, ?, ?)
    `, [transId, id, Number(amount), newBalance, transaction_reference, note || 'Admin deposit']);

    // 3. Audit log
    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'companies', ?, 'wallet_deposit', 'admin', ?, ?)
    `, [generateCode('AUD'), id, admin_id || 'admin', JSON.stringify({ amount, transaction_reference })]);

    await db.run('COMMIT');
    await db.close();

    res.json({ success: true, message: 'Deposit successful', data: { new_balance: newBalance } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/company/:id/wallet/adjust
router.post('/admin/company/:id/wallet/adjust', async (req, res) => {
  try {
    const db = await openDb();
    const { id } = req.params;
    const { amount, note, admin_id } = req.body; // amount can be negative

    await db.run('BEGIN TRANSACTION');

    const company = await db.get('SELECT wallet_balance FROM companies WHERE id = ?', id);
    if (!company) {
      await db.run('ROLLBACK');
      await db.close();
      return res.status(404).json({ success: false, error: 'COMPANY_NOT_FOUND' });
    }

    const newBalance = company.wallet_balance + Number(amount);
    
    await db.run('UPDATE companies SET wallet_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newBalance, id]);

    await db.run(`
      INSERT INTO wallet_transactions (id, company_id, transaction_type, amount, balance_after, description)
      VALUES (?, ?, 'refund', ?, ?, ?)
    `, [generateCode('WAL'), id, Number(amount), newBalance, note || 'Admin adjustment']);

    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'companies', ?, 'wallet_adjust', 'admin', ?, ?)
    `, [generateCode('AUD'), id, admin_id || 'admin', JSON.stringify({ amount, note })]);

    await db.run('COMMIT');
    await db.close();

    res.json({ success: true, data: { new_balance: newBalance } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/company/:id/wallet-transactions
router.get('/admin/company/:id/wallet-transactions', async (req, res) => {
  try {
    const db = await openDb();
    const transactions = await db.all(`
      SELECT * FROM wallet_transactions WHERE company_id = ? ORDER BY created_at DESC
    `, req.params.id);
    await db.close();
    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/ctv-payouts
router.get('/admin/ctv-payouts', async (req, res) => {
  try {
    const db = await openDb();
    const payouts = await db.all(`
      SELECT cp.*, ls.lead_code, ca.name as ctv_name, ca.bank_account, ca.bank_name,
             c.title as campaign_title
      FROM ctv_payouts cp
      JOIN lead_submissions ls ON cp.lead_id = ls.id
      JOIN ctv_accounts ca ON cp.ctv_id = ca.id
      JOIN campaigns c ON cp.campaign_id = c.id
      ORDER BY cp.created_at DESC
    `);
    await db.close();
    res.json({ success: true, data: payouts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/ctv-payouts/:id/mark-paid
router.post('/admin/ctv-payouts/:id/mark-paid', async (req, res) => {
  try {
    const db = await openDb();
    const { transaction_reference, paid_at, admin_id } = req.body;

    await db.run(`
      UPDATE ctv_payouts 
      SET status = 'paid', transaction_reference = ?, paid_at = COALESCE(?, datetime('now'))
      WHERE id = ?
    `, [transaction_reference, paid_at, req.params.id]);

    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'ctv_payouts', ?, 'mark_paid', 'admin', ?, ?)
    `, [generateCode('AUD'), req.params.id, admin_id || 'admin', JSON.stringify({ transaction_reference })]);

    await db.close();
    res.json({ success: true, message: 'Payout marked as paid' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/company/campaigns - Get company's campaigns
router.get('/company/campaigns', async (req, res) => {
  try {
    const db = await openDb();
    const { company_id } = req.query;

    const campaigns = await db.all(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM lead_submissions WHERE campaign_id = c.id) as total_leads,
             (SELECT COUNT(*) FROM lead_submissions WHERE campaign_id = c.id AND status = 'qualified') as qualified_leads
      FROM campaigns c
      WHERE c.company_id = ?
      ORDER BY c.created_at DESC
    `, company_id);

    await db.close();
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/company/leads - Get leads for company (with anonymization)
router.get('/company/leads', async (req, res) => {
  try {
    const db = await openDb();
    const { company_id } = req.query;

    // Get leads for company's campaigns
    const leads = await db.all(`
      SELECT 
        ls.id, ls.lead_code, ls.campaign_id, ls.status, ls.is_anonymous,
        ls.claimed_by_company_id, ls.submitted_at, ls.claimed_at,
        c.title as campaign_title, c.bounty_amount,
        ca.name as ctv_name,
        cd.name as candidate_name, cd.phone as candidate_phone,
        cd.province as candidate_province, cd.district as candidate_district,
        cd.desired_job, cd.desired_shift
      FROM lead_submissions ls
      JOIN campaigns c ON ls.campaign_id = c.id
      LEFT JOIN ctv_accounts ca ON ls.ctv_id = ca.id
      JOIN candidates cd ON ls.candidate_id = cd.id
      WHERE c.company_id = ?
        AND (ls.status IN ('approved', 'claimed', 'interviewing', 'hired', 'qualified', 'disputed'))
      ORDER BY ls.submitted_at DESC
    `, company_id);

    // Anonymize data for leads not yet claimed by this company
    const anonymizedLeads = leads.map(lead => {
      const isClaimedByMe = lead.claimed_by_company_id === company_id;
      const shouldAnonymize = !isClaimedByMe && lead.is_anonymous;

      return {
        ...lead,
        candidate_name: shouldAnonymize ? null : lead.candidate_name,
        candidate_phone: shouldAnonymize ? null : lead.candidate_phone,
        desired_job: shouldAnonymize ? null : lead.desired_job,
        desired_shift: shouldAnonymize ? null : lead.desired_shift,
        // Always show location for matching
        candidate_province: lead.candidate_province,
        candidate_district: lead.candidate_district
      };
    });

    await db.close();
    res.json({ success: true, data: anonymizedLeads });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/company/leads/:leadId/claim - Claim a lead
router.post('/company/leads/:leadId/claim', async (req, res) => {
  try {
    const db = await openDb();
    const { leadId } = req.params;
    const { company_id } = req.body;

    // Get lead and campaign info
    const lead = await db.get(`
      SELECT ls.*, c.bounty_amount, c.company_id as campaign_owner_id
      FROM lead_submissions ls
      JOIN campaigns c ON ls.campaign_id = c.id
      WHERE ls.id = ?
    `, leadId);

    if (!lead) {
      await db.close();
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    // Check if already claimed
    if (lead.claimed_by_company_id) {
      await db.close();
      return res.status(400).json({ success: false, error: 'Lead already claimed' });
    }

    // Check company owns this campaign
    if (lead.campaign_owner_id !== company_id) {
      await db.close();
      return res.status(403).json({ success: false, error: 'Not authorized to claim this lead' });
    }

        // Get company trust info
    const company = await db.get(`
      SELECT wallet_balance, credit_limit, trust_level, deposit_status, 
             lead_trial_limit, require_deposit_after_leads,
             (SELECT COUNT(*) FROM lead_submissions WHERE claimed_by_company_id = ? AND status IN ('claimed', 'interviewing', 'hired', 'qualified')) as claimed_lead_count
      FROM companies WHERE id = ?
    `, [company_id, company_id]);

    if (!company) {
      await db.close();
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    // Check if company needs deposit
    // Rule: Claimed leads >= limit AND (deposit status is not confirmed/waived/partial/confirmed)
    const claimedLimit = company.require_deposit_after_leads || 2;
    const isSpecialStatus = ['waived', 'partial', 'confirmed'].includes(company.deposit_status) || company.trust_level === 'vip';
    
    const needsDeposit = (company.claimed_lead_count || 0) >= claimedLimit && !isSpecialStatus;

    if (needsDeposit && company.deposit_status === 'none') {
      await db.close();
      return res.status(400).json({ 
        success: false, 
        error: 'DEPOSIT_REQUIRED',
        message: 'Công ty cần đặt cọc để tiếp tục nhận lead. Vui lòng liên hệ admin.' 
      });
    }

    if (needsDeposit && company.deposit_status === 'pending') {
      await db.close();
      return res.status(400).json({ 
        success: false, 
        error: 'DEPOSIT_PENDING',
        message: 'Khoản cọc đang chờ admin xác nhận.' 
      });
    }

    const totalCredit = company.wallet_balance + company.credit_limit;

    if (totalCredit < lead.bounty_amount) {
      await db.close();
      return res.status(400).json({ 
        success: false, 
        error: 'Insufficient balance',
        required: lead.bounty_amount,
        available: company.wallet_balance
      });
    }

    // Update lead
    await db.run(`
      UPDATE lead_submissions 
      SET status = 'claimed', claimed_by_company_id = ?, claimed_at = datetime('now'), is_anonymous = 0
      WHERE id = ?
    `, [company_id, leadId]);

    // Deduct from wallet (or create negative balance using credit)
    const newBalance = company.wallet_balance - lead.bounty_amount;
    await db.run(`
      UPDATE companies SET wallet_balance = ? WHERE id = ?
    `, [newBalance, company_id]);

    // Create wallet transaction
    await db.run(`
      INSERT INTO wallet_transactions (id, company_id, transaction_type, amount, balance_after, reference_id, description)
      VALUES (?, ?, 'lead_claim', ?, ?, ?, ?)
    `, [generateCode('WAL'), company_id, -lead.bounty_amount, newBalance, leadId, `Claim lead ${lead.lead_code}`]);

    // Create lead claim record
    await db.run(`
      INSERT INTO lead_claims (id, lead_id, campaign_id, company_id, claimed_by_role, claimed_by_id, bounty_paid)
      VALUES (?, ?, ?, ?, 'company', ?, ?)
    `, [generateCode('CLM'), leadId, lead.campaign_id, company_id, company_id, lead.bounty_amount]);

    // Update lead status history
    await db.run(`
      INSERT INTO lead_status_history (id, lead_id, from_status, to_status, changed_by_role, changed_by_id, reason)
      VALUES (?, ?, 'approved', 'claimed', 'company', ?, 'Company claimed lead')
    `, [generateCode('HST'), leadId, company_id]);

    // Audit log
    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'lead', ?, 'claimed', 'company', ?, ?)
    `, [generateCode('AUD'), leadId, company_id, JSON.stringify({ bounty_paid: lead.bounty_amount })]);

    await db.close();

    res.json({ 
      success: true, 
      message: 'Lead claimed successfully',
      data: {
        lead_id: leadId,
        bounty_paid: lead.bounty_amount,
        new_balance: newBalance
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/company/leads/:leadId/status - Update lead status
router.post('/company/leads/:leadId/status', async (req, res) => {
  try {
    const db = await openDb();
    const { leadId } = req.params;
    const { company_id, status, reason } = req.body;

    // Verify company owns this lead
    const lead = await db.get(`
      SELECT ls.*, c.company_id as campaign_owner_id
      FROM lead_submissions ls
      JOIN campaigns c ON ls.campaign_id = c.id
      WHERE ls.id = ? AND ls.claimed_by_company_id = ?
    `, [leadId, company_id]);

    if (!lead) {
      await db.close();
      return res.status(403).json({ success: false, error: 'Lead not found or not claimed by you' });
    }

    const oldStatus = lead.status;

    // Update lead status
    await db.run(`
      UPDATE lead_submissions SET status = ?, qualified_at = CASE WHEN ? = 'qualified' THEN datetime('now') ELSE qualified_at END
      WHERE id = ?
    `, [status, status, leadId]);

        // If qualified, create platform fee and CTV payout
    if (status === 'qualified' && oldStatus !== 'qualified') {
      const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', lead.campaign_id);
      
      const feePct = campaign.platform_fee_percentage ?? 20;
      const platformFee = Math.floor((campaign.bounty_amount * feePct) / 100);
      const ctvReward = campaign.bounty_amount - platformFee;

      // Platform fee
      await db.run(`
        INSERT INTO platform_fees (id, lead_id, campaign_id, company_id, fee_amount, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `, [generateCode('FEE'), leadId, lead.campaign_id, company_id, platformFee]);

      const shouldCreateCtvPayout = Boolean(lead.ctv_id) && lead.source_type === 'ctv' && lead.owner_type === 'ctv';

      if (shouldCreateCtvPayout) {
        await db.run(`
          INSERT INTO ctv_payouts (id, lead_id, ctv_id, campaign_id, payout_amount, status)
          VALUES (?, ?, ?, ?, ?, 'pending')
        `, [generateCode('PAY'), leadId, lead.ctv_id, lead.campaign_id, ctvReward]);

        // Update CTV total earned
        await db.run(`
          UPDATE ctv_accounts SET total_earned = total_earned + ? WHERE id = ?
        `, [ctvReward, lead.ctv_id]);
      }
    }

    // Status history
    await db.run(`
      INSERT INTO lead_status_history (id, lead_id, from_status, to_status, changed_by_role, changed_by_id, reason)
      VALUES (?, ?, ?, ?, 'company', ?, ?)
    `, [generateCode('HST'), leadId, oldStatus, status, company_id, reason || 'Status updated']);

        // Audit log
    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'lead', ?, 'status_changed', 'company', ?, ?)
    `, [generateCode('AUD'), leadId, company_id, JSON.stringify({ from: oldStatus, to: status })]);

    // Phase 5: Notification to CTV if qualified
    if (status === 'qualified') {
      try {
        const leadInfo = await db.get('SELECT ls.ctv_id, c.title, ca.clerk_user_id FROM lead_submissions ls JOIN campaigns c ON ls.campaign_id = c.id LEFT JOIN ctv_accounts ca ON ls.ctv_id = ca.id WHERE ls.id = ?', leadId);
        if (leadInfo && leadInfo.clerk_user_id) {
          await sendNotification({
            clerkUserId: leadInfo.clerk_user_id,
            title: 'Lead thành công! 💰',
            message: `Ứng viên của bạn trong chiến dịch "${leadInfo.title}" đã đạt Qualified. Hoa hồng đã được ghi nhận.`,
            url: '/ctv/commissions'
          });
        }
      } catch (err) {
        console.warn('Qualified notification failed:', err.message);
      }
    }

    await db.close();

    res.json({ success: true, message: 'Status updated', data: { new_status: status } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== CTV API ==============

// GET /api/ctv/campaigns - Get active campaigns
router.get('/ctv/campaigns', async (req, res) => {
  try {
    const db = await openDb();

    const campaigns = await db.all(`
      SELECT c.id, c.campaign_code, c.title, c.job_type, c.location, 
             c.province, c.district, c.salary_text, c.shift_text,
             c.ctv_reward_amount, c.quantity_needed, c.requirements,
             c.start_date, c.end_date, c.created_at,
             co.name as company_name, co.company_code,
             (SELECT COUNT(*) FROM lead_submissions WHERE campaign_id = c.id AND ctv_id = ?) as my_leads
      FROM campaigns c
      JOIN companies co ON c.company_id = co.id
      WHERE c.status = 'active'
        AND c.ctv_enabled = 1
        AND c.ctv_reward_amount > 0
        AND (c.start_date IS NULL OR c.start_date <= date('now'))
        AND (c.end_date IS NULL OR c.end_date >= date('now'))
      ORDER BY c.created_at DESC
    `, req.query.ctv_id || '');

    await db.close();
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ctv/payouts - Get CTV payout history
router.get('/ctv/payouts', async (req, res) => {
  try {
    const db = await openDb();
    const { ctv_id } = req.query;

    if (!ctv_id) {
      await db.close();
      return res.status(400).json({ success: false, error: 'ctv_id is required' });
    }

    const payouts = await db.all(`
      SELECT cp.*, c.title as campaign_title, co.name as company_name
      FROM ctv_payouts cp
      LEFT JOIN campaigns c ON cp.campaign_id = c.id
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE cp.ctv_id = ?
      ORDER BY cp.created_at DESC
    `, [ctv_id]);

    await db.close();
    res.json({ success: true, data: payouts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/ctv/leads - Submit new lead
router.post('/ctv/leads', async (req, res) => {
  try {
    const db = await openDb();
        const {
      ctv_id,
      campaign_id,
      candidate_name,
      candidate_phone,
      zalo_phone,
      birth_year,
      province,
      district,
      desired_job,
      desired_shift,
      available_date,
      note,
      has_id_card,
      has_curriculum_vitae,
      source_type = 'ctv',
      owner_type = 'ctv',
      assignment_method
    } = req.body;

    if (source_type === 'ctv' && !ctv_id) {
      await db.close();
      return res.status(400).json({
        success: false,
        error: 'MISSING_CTV_ID',
        message: 'CTV lead requires ctv_id when source_type is ctv'
      });
    }

    if (source_type !== 'ctv' && ctv_id) {
      await db.close();
      return res.status(400).json({
        success: false,
        error: 'INVALID_CTV_PAYLOAD',
        message: 'ctv_id must be null when source_type is not ctv'
      });
    }

    const allowedAssignmentMethods = ['ctv_link', 'manual_ctv'];
    if (source_type === 'ctv' && !allowedAssignmentMethods.includes(assignment_method)) {
      await db.close();
      return res.status(400).json({
        success: false,
        error: 'INVALID_ASSIGNMENT_METHOD',
        message: `assignment_method must be one of ${allowedAssignmentMethods.join(', ')}`
      });
    }

    // Normalize phone
    const normalizedPhone = normalizePhone(candidate_phone);

    // Check for duplicate in same campaign
    const existingLock = await db.get(`
      SELECT pl.*, ls.status, ls.ctv_id, ls.lead_code
      FROM phone_locks pl
      JOIN lead_submissions ls ON pl.lead_id = ls.id
      WHERE pl.normalized_phone = ? AND pl.campaign_id = ?
    `, [normalizedPhone, campaign_id]);

    if (existingLock) {
      await db.close();
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_PHONE',
        message: 'Số điện thoại đã tồn tại trong chiến dịch này',
        existing_lead_code: existingLock.lead_code,
        existing_status: existingLock.status,
        // Don't reveal sensitive data of existing lead
        hint: existingLock.ctv_id === ctv_id ? 'Bạn đã gửi lead này trước đó' : 'Lead đã được gửi bởi CTV khác'
      });
    }

    // Create or get candidate
    let candidate = await db.get('SELECT * FROM candidates WHERE normalized_phone = ?', normalizedPhone);

        if (!candidate) {
      const candidateId = 'cand-' + Date.now();
      await db.run(`
        INSERT INTO candidates (id, name, phone, normalized_phone, zalo_phone, birth_year, province, district, desired_job, desired_shift, note, consent_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'granted')
      `, [candidateId, candidate_name, candidate_phone, normalizedPhone, zalo_phone || null, birth_year || null, province, district, desired_job, desired_shift, note]);
      candidate = { id: candidateId };
    }

    // Create lead submission
    const leadId = 'lead-' + Date.now();
    const leadCode = generateCode('LED');

        await db.run(`
      INSERT INTO lead_submissions 
      (id, lead_code, campaign_id, ctv_id, source_type, owner_type, assignment_method, candidate_id, status, is_anonymous, submitted_at, source_metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', 1, datetime('now'), ?)
    `, [leadId, leadCode, campaign_id, ctv_id, source_type, owner_type, assignment_method, candidate.id, JSON.stringify({ has_id_card, has_curriculum_vitae })]);

    // Create phone lock
    await db.run(`
      INSERT INTO phone_locks (id, normalized_phone, campaign_id, lead_id, expires_at)
      VALUES (?, ?, ?, ?, datetime('now', '+30 days'))
    `, [generateCode('LCK'), normalizedPhone, campaign_id, leadId]);

    // Update campaign lead count
    await db.run(`
      UPDATE campaigns SET current_leads = current_leads + 1 WHERE id = ?
    `, campaign_id);

    // Status history
    await db.run(`
      INSERT INTO lead_status_history (id, lead_id, from_status, to_status, changed_by_role, changed_by_id, reason)
      VALUES (?, ?, 'new', 'submitted', 'ctv', ?, 'CTV submitted lead')
    `, [generateCode('HST'), leadId, ctv_id]);

        // Audit log
    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'lead', ?, 'submitted', 'ctv', ?, ?)
    `, [generateCode('AUD'), leadId, ctv_id, JSON.stringify({ campaign_id, phone: normalizedPhone })]);

    // Phase 5: Notification to Admin and Company
    try {
      // 1. Notify Admin
      await sendNotification({
        role: 'admin',
        title: 'Lead mới!',
        message: `Có ứng viên mới cho chiến dịch "${candidate_name}"`,
        url: '/admin/leads'
      });

      // 2. Notify Company
      const campaignInfo = await db.get('SELECT c.title, co.clerk_user_id FROM campaigns c JOIN companies co ON c.company_id = co.id WHERE c.id = ?', campaign_id);
      if (campaignInfo && campaignInfo.clerk_user_id) {
        await sendNotification({
          clerkUserId: campaignInfo.clerk_user_id,
          title: 'Ứng viên mới',
          message: `Có 1 lead mới vừa được gửi vào chiến dịch "${campaignInfo.title}"`,
          url: '/company/leads'
        });
      }
    } catch (err) {
      console.warn('Lead notification failed:', err.message);
    }

    await db.close();

    res.status(201).json({
      success: true,
      message: 'Lead submitted successfully',
      data: {
        lead_id: leadId,
        lead_code: leadCode,
        status: 'submitted'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ctv/leads - Get CTV's leads
router.get('/ctv/leads', async (req, res) => {
  try {
    const db = await openDb();
    const { ctv_id } = req.query;

    const leads = await db.all(`
      SELECT 
        ls.id, ls.lead_code, ls.campaign_id, ls.status, ls.submitted_at,
        c.title as campaign_title, c.ctv_reward_amount,
        co.name as company_name,
        cd.name as candidate_name, cd.phone as candidate_phone
      FROM lead_submissions ls
      JOIN campaigns c ON ls.campaign_id = c.id
      JOIN companies co ON c.company_id = co.id
      JOIN candidates cd ON ls.candidate_id = cd.id
      WHERE ls.ctv_id = ?
      ORDER BY ls.submitted_at DESC
    `, ctv_id);

    await db.close();
    res.json({ success: true, data: leads });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/ctv/commissions - Get CTV's commissions
router.get('/ctv/commissions', async (req, res) => {
  try {
    const db = await openDb();
    const { ctv_id } = req.query;

    const payouts = await db.all(`
      SELECT 
        cp.id, cp.payout_amount as amount, cp.status, cp.created_at, cp.paid_at,
        ls.lead_code,
        c.title as campaign_title,
        co.name as company_name
      FROM ctv_payouts cp
      JOIN lead_submissions ls ON cp.lead_id = ls.id
      JOIN campaigns c ON cp.campaign_id = c.id
      JOIN companies co ON c.company_id = co.id
      WHERE cp.ctv_id = ?
      ORDER BY cp.created_at DESC
    `, ctv_id);

    // Calculate totals
    const totalPending = payouts
      .filter(p => p.status === 'pending' || p.status === 'approved' || p.status === 'processing')
      .reduce((sum, p) => sum + p.amount, 0);
    const totalPaid = payouts
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);

    await db.close();
    res.json({
      success: true,
      data: payouts,
      summary: {
        held: 0, // TODO: Implement hold logic if needed
        available: totalPaid, 
        pending_payout: totalPending,
        paid: totalPaid,
        total_earned: totalPending + totalPaid
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== ADMIN API ==============

// GET /api/admin/campaigns - Get all campaigns
router.get('/admin/campaigns', async (req, res) => {
  try {
    const db = await openDb();

    const campaigns = await db.all(`
      SELECT c.*, co.name as company_name, co.company_code,
             (SELECT COUNT(*) FROM lead_submissions WHERE campaign_id = c.id) as total_leads
      FROM campaigns c
      JOIN companies co ON c.company_id = co.id
      ORDER BY c.created_at DESC
    `);

    await db.close();
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/campaigns/:id/approve
router.post('/admin/campaigns/:id/approve', async (req, res) => {
  try {
    const db = await openDb();
    const { id } = req.params;
    const { admin_id, reason } = req.body;

    await db.run(`
      UPDATE campaigns SET status = 'active' WHERE id = ?
    `, id);

        // Audit log
    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'campaign', ?, 'approved', 'admin', ?, ?)
    `, [generateCode('AUD'), id, admin_id, JSON.stringify({ reason })]);

    // Phase 5: Notification to Company
    try {
      const company = await db.get('SELECT clerk_user_id, name FROM companies WHERE id = (SELECT company_id FROM campaigns WHERE id = ?)', id);
      if (company && company.clerk_user_id) {
        await sendNotification({
          clerkUserId: company.clerk_user_id,
          title: 'Chiến dịch được duyệt',
          message: `Chiến dịch "${campaign.title}" của bạn đã được duyệt và bắt đầu hoạt động.`,
          url: '/company/campaigns'
        });
      }
    } catch (err) {
      console.warn('Notification failed:', err.message);
    }

    await db.close();
    res.json({ success: true, message: 'Campaign approved' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/lead-queue - Minimal admin queue view
router.get('/admin/lead-queue', async (req, res) => {
  try {
    const db = await openDb();

    const leads = await db.all(`
      SELECT
        ls.id as lead_id,
        ls.lead_code,
        ls.source_type,
        ls.owner_type,
        ls.assigned_admin_id,
        ls.assignment_method,
        ls.status,
        ls.submitted_at as created_at,
        cd.id as candidate_id,
        cd.name as candidate_name,
        cd.phone as candidate_phone,
        c.id as campaign_id,
        c.title as campaign_title,
        co.id as company_id,
        co.name as company_name
      FROM lead_submissions ls
      LEFT JOIN candidates cd ON ls.candidate_id = cd.id
      LEFT JOIN campaigns c ON ls.campaign_id = c.id
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE ls.owner_type IN ('admin_pool', 'admin') OR ls.assigned_admin_id IS NOT NULL
      ORDER BY ls.submitted_at DESC
    `);

    await db.close();
    res.json({ success: true, data: leads });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/leads - Get all leads
router.get('/admin/leads', async (req, res) => {
  try {
    const db = await openDb();

    const leads = await db.all(`
      SELECT 
        ls.*,
        c.title as campaign_title, co.name as company_name,
        ca.name as ctv_name,
        cd.name as candidate_name, cd.phone as candidate_phone, cd.normalized_phone
      FROM lead_submissions ls
      JOIN campaigns c ON ls.campaign_id = c.id
      JOIN companies co ON c.company_id = co.id
      LEFT JOIN ctv_accounts ca ON ls.ctv_id = ca.id
      JOIN candidates cd ON ls.candidate_id = cd.id
      ORDER BY ls.submitted_at DESC
    `);

    await db.close();
    res.json({ success: true, data: leads });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/leads/:id/verify
router.post('/admin/leads/:id/verify', async (req, res) => {
  try {
    const db = await openDb();
    const { id } = req.params;
    const { admin_id, action, reason } = req.body;

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await db.run(`
      UPDATE lead_submissions SET status = ? WHERE id = ?
    `, [newStatus, id]);

    // Status history
    const lead = await db.get('SELECT status FROM lead_submissions WHERE id = ?', id);
    await db.run(`
      INSERT INTO lead_status_history (id, lead_id, from_status, to_status, changed_by_role, changed_by_id, reason)
      VALUES (?, ?, ?, ?, 'admin', ?, ?)
    `, [generateCode('HST'), id, lead.status, newStatus, admin_id, reason]);

    // Audit log
    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'lead', ?, ?, 'admin', ?, ?)
    `, [generateCode('AUD'), id, action, admin_id, JSON.stringify({ reason })]);

    await db.close();
    res.json({ success: true, message: `Lead ${action}d` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/tax-report
router.get('/admin/tax-report', async (req, res) => {
  try {
    const db = await openDb();
    const { period, date_from, date_to, company_id } = req.query;

    let dateFilter = '';
    if (period) {
      dateFilter = `AND strftime('%Y-%m', ls.qualified_at) = '${period}'`;
    } else if (date_from && date_to) {
      dateFilter = `AND ls.qualified_at BETWEEN '${date_from}' AND '${date_to}'`;
    }

    let companyFilter = '';
    if (company_id) {
      companyFilter = `AND c.company_id = '${company_id}'`;
    }

    // Summary stats (Clean Naming)
    const summary = await db.get(`
      SELECT 
        COUNT(*) as total_qualified_leads,
        SUM(c.bounty_amount) as total_company_charged,
        SUM(c.platform_fee_amount) as total_platform_revenue,
        SUM(c.ctv_reward_amount) as total_ctv_payable
      FROM lead_submissions ls
      JOIN campaigns c ON ls.campaign_id = c.id
      WHERE ls.status = 'qualified' ${dateFilter} ${companyFilter}
    `);

    // Pending totals
    const pending = await db.get(`
      SELECT 
        SUM(fee_amount) as total_pending_platform_fees
      FROM platform_fees 
      WHERE status = 'pending'
    `);

    const pendingPayouts = await db.get(`
      SELECT 
        SUM(payout_amount) as total_pending_ctv_payout
      FROM ctv_payouts
      WHERE status IN ('pending', 'approved', 'processing')
    `);

    await db.close();

    res.json({
      success: true,
      period: period || 'all',
      data: {
        total_qualified_leads: summary.total_qualified_leads || 0,
        total_company_charged: summary.total_company_charged || 0,
        total_platform_revenue: summary.total_platform_revenue || 0,
        total_ctv_payable: summary.total_ctv_payable || 0,
        total_pending_platform_fees: pending.total_pending_platform_fees || 0,
        total_pending_ctv_payout: pendingPayouts.total_pending_ctv_payout || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/tax-report/export - Export CSV
router.get('/admin/tax-report/export', async (req, res) => {
  try {
    const db = await openDb();
    const { period } = req.query;

    let dateFilter = '';
    if (period) {
      dateFilter = `AND strftime('%Y-%m', ls.qualified_at) = '${period}'`;
    }

    const data = await db.all(`
      SELECT 
        ls.lead_code, ls.qualified_at,
        co.name as company_name, co.company_code, co.tax_code,
        c.title as campaign_title,
        ca.name as ctv_name, ca.ctv_code,
        c.bounty_amount as charged_amount,
        c.ctv_reward_amount as ctv_commission,
        c.platform_fee_amount as platform_fee
      FROM lead_submissions ls
      JOIN campaigns c ON ls.campaign_id = c.id
      JOIN companies co ON c.company_id = co.id
      LEFT JOIN ctv_accounts ca ON ls.ctv_id = ca.id
      WHERE ls.status = 'qualified' ${dateFilter}
      ORDER BY ls.qualified_at DESC
    `);

    await db.close();

    // Generate CSV (Simple implementation)
    let csv = '\uFEFF'; // BOM for UTF-8
    csv += 'Mã Lead,Ngày Qualified,Công ty,Mã Cty,MST,Chiến dịch,CTV,Mã CTV,Số tiền thu Cty,Hoa hồng CTV,Phí sàn\n';
    
    data.forEach(row => {
      csv += `${row.lead_code},${row.qualified_at},"${row.company_name}",${row.company_code},${row.tax_code},"${row.campaign_title}","${row.ctv_name}",${row.ctv_code},${row.charged_amount},${row.ctv_commission},${row.platform_fee}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=bao-cao-tai-chinh-${period || 'all'}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/audit-logs
router.get('/admin/audit-logs', async (req, res) => {
  try {
    const db = await openDb();
    const { entity_type, entity_id, limit = 100 } = req.query;

    let query = `
      SELECT * FROM audit_logs
      WHERE 1=1
    `;
    const params = [];

    if (entity_type) {
      query += ' AND entity_type = ?';
      params.push(entity_type);
    }
    if (entity_id) {
      query += ' AND entity_id = ?';
      params.push(entity_id);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const logs = await db.all(query, params);

    await db.close();
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== CTV APPROVAL API ==============

// GET /api/admin/pending-ctv - Get pending CTV registrations
router.get('/admin/pending-ctv', async (req, res) => {
  try {
    const db = await openDb();

    const ctvList = await db.all(`
      SELECT
        id, ctv_code, clerk_user_id, name, phone, email, zalo_phone,
        bank_account, bank_name, province, district,
        status, rejection_reason, trust_score, total_earned,
        submitted_at, approved_at, created_at, updated_at
      FROM ctv_accounts
      WHERE status IN ('pending', 'rejected')
      ORDER BY submitted_at DESC
    `);

    await db.close();
    res.json({ success: true, data: ctvList });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/all-ctv - Get all CTV accounts
router.get('/admin/all-ctv', async (req, res) => {
  try {
    const db = await openDb();

    const ctvList = await db.all(`
      SELECT
        id, ctv_code, clerk_user_id, name, phone, email, zalo_phone,
        bank_account, bank_name, province, district,
        status, rejection_reason, trust_score, total_earned,
        submitted_at, approved_at, created_at, updated_at
      FROM ctv_accounts
      ORDER BY created_at DESC
    `);

    await db.close();
    res.json({ success: true, data: ctvList });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/ctv/:id/approve
router.post('/admin/ctv/:id/approve', async (req, res) => {
  try {
    const db = await openDb();
    const { id } = req.params;
    const { admin_id, reason } = req.body;

    const ctv = await db.get('SELECT * FROM ctv_accounts WHERE id = ?', id);
    if (!ctv) {
      await db.close();
      return res.status(404).json({ success: false, error: 'CTV not found' });
    }

    if (ctv.status === 'approved') {
      await db.close();
      return res.json({ success: true, message: 'CTV already approved' });
    }

    const now = new Date().toISOString();

    await db.run(`
      UPDATE ctv_accounts
      SET status = 'active', approved_at = ?, updated_at = ?
      WHERE id = ?
    `, [now, now, id]);

    // Audit log
    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'ctv_accounts', ?, 'approved', 'admin', ?, ?)
    `, [`ctv-audit-${Date.now()}`, id, admin_id || 'admin', JSON.stringify({ reason: reason || null, name: ctv.name, phone: ctv.phone })]);

    await db.close();

    res.json({ success: true, message: 'CTV approved successfully', data: { id, newStatus: 'active' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/ctv/:id/reject
router.post('/admin/ctv/:id/reject', async (req, res) => {
  try {
    const db = await openDb();
    const { id } = req.params;
    const { admin_id, reason } = req.body;

    if (!reason || !reason.trim()) {
      await db.close();
      return res.status(400).json({ success: false, error: 'MISSING_REASON', message: 'Lý do từ chối là bắt buộc.' });
    }

    const ctv = await db.get('SELECT * FROM ctv_accounts WHERE id = ?', id);
    if (!ctv) {
      await db.close();
      return res.status(404).json({ success: false, error: 'CTV not found' });
    }

    const now = new Date().toISOString();

    await db.run(`
      UPDATE ctv_accounts
      SET status = 'rejected', rejection_reason = ?, updated_at = ?
      WHERE id = ?
    `, [reason, now, id]);

    // Audit log
    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'ctv_accounts', ?, 'rejected', 'admin', ?, ?)
    `, [`ctv-audit-${Date.now()}`, id, admin_id || 'admin', JSON.stringify({ reason: reason || null, name: ctv.name, phone: ctv.phone })]);

    await db.close();

    res.json({ success: true, message: 'CTV rejected', data: { id, newStatus: 'rejected', reason } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== COMPANY APPROVAL API ==============

// GET /api/admin/pending-companies - Get pending company registrations
router.get('/admin/pending-companies', async (req, res) => {
  try {
    const db = await openDb();

    const companyList = await db.all(`
      SELECT
        id, company_code, clerk_user_id, name, phone, email, tax_code,
        address, province, district,
        status, rejection_reason, wallet_balance, credit_limit,
        submitted_at, approved_at, created_at, updated_at
      FROM companies
      WHERE status IN ('pending', 'rejected')
      ORDER BY submitted_at DESC
    `);

    await db.close();
    res.json({ success: true, data: companyList });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/admin/all-companies - Get all company accounts
router.get('/admin/all-companies', async (req, res) => {
  try {
    const db = await openDb();

    const companyList = await db.all(`
      SELECT
        id, company_code, clerk_user_id, name, phone, email, tax_code,
        address, province, district,
        status, rejection_reason, wallet_balance, credit_limit,
        trust_level, deposit_status, lead_trial_limit, require_deposit_after_leads,
        is_featured, plan_code, free_job_posts_limit, weekly_push_limit,
        used_job_posts_count, used_push_count,
        submitted_at, approved_at, created_at, updated_at
      FROM companies
      ORDER BY created_at DESC
    `);

    await db.close();
    res.json({ success: true, data: companyList });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/company/:id/approve
router.post('/admin/company/:id/approve', async (req, res) => {
  try {
    const db = await openDb();
    const { id } = req.params;
    const { admin_id, reason } = req.body;

    const company = await db.get('SELECT * FROM companies WHERE id = ?', id);
    if (!company) {
      await db.close();
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    if (company.status === 'approved' || company.status === 'active') {
      await db.close();
      return res.json({ success: true, message: 'Company already approved' });
    }

    const now = new Date().toISOString();

    await db.run(`
      UPDATE companies
      SET status = 'active', approved_at = ?, updated_at = ?
      WHERE id = ?
    `, [now, now, id]);

    // Audit log
    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'companies', ?, 'approved', 'admin', ?, ?)
    `, [`comp-audit-${Date.now()}`, id, admin_id || 'admin', JSON.stringify({ reason: reason || null, name: company.name, phone: company.phone })]);

    await db.close();

    res.json({ success: true, message: 'Company approved successfully', data: { id, newStatus: 'active' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/company/:id/reject
router.post('/admin/company/:id/reject', async (req, res) => {
  try {
    const db = await openDb();
    const { id } = req.params;
    const { admin_id, reason } = req.body;

    if (!reason || !reason.trim()) {
      await db.close();
      return res.status(400).json({ success: false, error: 'MISSING_REASON', message: 'Lý do từ chối là bắt buộc.' });
    }

    const company = await db.get('SELECT * FROM companies WHERE id = ?', id);
    if (!company) {
      await db.close();
      return res.status(404).json({ success: false, error: 'Company not found' });
    }

    const now = new Date().toISOString();

    await db.run(`
      UPDATE companies
      SET status = 'rejected', rejection_reason = ?, updated_at = ?
      WHERE id = ?
    `, [reason, now, id]);

    // Audit log
    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'companies', ?, 'rejected', 'admin', ?, ?)
    `, [`comp-audit-${Date.now()}`, id, admin_id || 'admin', JSON.stringify({ reason: reason || null, name: company.name, phone: company.phone })]);

    await db.close();

    res.json({ success: true, message: 'Company rejected', data: { id, newStatus: 'rejected', reason } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/admin/company/:id - Update company (Admin)
router.put('/admin/company/:id', async (req, res) => {
  try {
    const db = await openDb();
    const { id } = req.params;
    const { 
      name, phone, email, tax_code, address, province, district, status,
      trust_level, deposit_status, lead_trial_limit, require_deposit_after_leads,
      is_featured, plan_code, free_job_posts_limit, weekly_push_limit,
      admin_id
    } = req.body;

    await db.run(`
      UPDATE companies SET 
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        tax_code = COALESCE(?, tax_code),
        address = COALESCE(?, address),
        province = COALESCE(?, province),
        district = COALESCE(?, district),
        status = COALESCE(?, status),
        trust_level = COALESCE(?, trust_level),
        deposit_status = COALESCE(?, deposit_status),
        lead_trial_limit = COALESCE(?, lead_trial_limit),
        require_deposit_after_leads = COALESCE(?, require_deposit_after_leads),
        is_featured = COALESCE(?, is_featured),
        plan_code = COALESCE(?, plan_code),
        free_job_posts_limit = COALESCE(?, free_job_posts_limit),
        weekly_push_limit = COALESCE(?, weekly_push_limit),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name, phone, email, tax_code, address, province, district, status,
      trust_level, deposit_status, lead_trial_limit, require_deposit_after_leads,
      is_featured, plan_code, free_job_posts_limit, weekly_push_limit,
      id
    ]);

    // Audit log
    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'companies', ?, 'update_admin', 'admin', ?, ?)
    `, [generateCode('AUD'), id, admin_id || 'admin', JSON.stringify(req.body)]);

    await db.close();
    res.json({ success: true, message: 'Company updated by admin' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/admin/companies/:id/trust - Set trust level, deposit status (DEPRECATED: Use /admin/company/:id)
router.put('/admin/companies/:id/trust', async (req, res) => {
  try {
    const db = await openDb();
    const { id } = req.params;
    const { trust_level, deposit_status, lead_trial_limit, require_deposit_after_leads, is_featured, admin_id } = req.body;

    await db.run(`
      UPDATE companies SET 
        trust_level = COALESCE(?, trust_level),
        deposit_status = COALESCE(?, deposit_status),
        lead_trial_limit = COALESCE(?, lead_trial_limit),
        require_deposit_after_leads = COALESCE(?, require_deposit_after_leads),
        is_featured = COALESCE(?, is_featured),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [trust_level, deposit_status, lead_trial_limit, require_deposit_after_leads, is_featured, id]);

    // Audit log
    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'companies', ?, 'update_trust', 'admin', ?, ?)
    `, [generateCode('AUD'), id, admin_id || 'admin', JSON.stringify({ trust_level, deposit_status })]);

    await db.close();
    res.json({ success: true, message: 'Trust settings updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/admin/companies/:id/quota - Set plan_code, limits
router.put('/admin/companies/:id/quota', async (req, res) => {
  try {
    const db = await openDb();
    const { id } = req.params;
    const { plan_code, free_job_posts_limit, weekly_push_limit, admin_id } = req.body;

    await db.run(`
      UPDATE companies SET 
        plan_code = COALESCE(?, plan_code),
        free_job_posts_limit = COALESCE(?, free_job_posts_limit),
        weekly_push_limit = COALESCE(?, weekly_push_limit),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [plan_code, free_job_posts_limit, weekly_push_limit, id]);

    // Audit log
    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'companies', ?, 'update_quota', 'admin', ?, ?)
    `, [generateCode('AUD'), id, admin_id || 'admin', JSON.stringify({ plan_code, free_job_posts_limit })]);

    await db.close();
    res.json({ success: true, message: 'Quota settings updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/company/campaigns/:id/push - Push campaign (bump to top)
router.post('/company/campaigns/:id/push', userAuth, async (req, res) => {
  try {
    const db = await openDb();
    const { id } = req.params;
    const clerkUserId = req.user.clerkUserId;

    const company = await db.get('SELECT * FROM companies WHERE clerk_user_id = ?', clerkUserId);
    if (!company) {
      await db.close();
      return res.status(403).json({ success: false, error: 'COMPANY_NOT_FOUND' });
    }

    const campaign = await db.get('SELECT * FROM campaigns WHERE id = ? AND company_id = ?', [id, company.id]);
    if (!campaign) {
      await db.close();
      return res.status(404).json({ success: false, error: 'CAMPAIGN_NOT_FOUND' });
    }

    const pushLimit = company.weekly_push_limit || 5;
    const usedPush = company.used_push_count || 0;

    if (pushLimit > 0 && usedPush >= pushLimit) {
      await db.close();
      return res.status(400).json({
        success: false,
        error: 'PUSH_QUOTA_EXCEEDED',
        message: `Bạn đã dùng hết ${pushLimit} lượt push tuần này.`
      });
    }

    const now = new Date();
    const promotedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await db.run(`
      UPDATE campaigns SET
        promoted_until = ?,
        visibility = 'promoted',
        is_public = 1,
        ctv_enabled = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [promotedUntil.toISOString(), id]);

    await db.run(`UPDATE companies SET used_push_count = used_push_count + 1 WHERE id = ?`, company.id);

    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'campaign', ?, 'pushed', 'company', ?, ?)
    `, [generateCode('AUD'), id, company.id, JSON.stringify({ promoted_until: promotedUntil.toISOString() })]);

    await db.close();
    res.json({
      success: true,
      message: 'Đã đẩy tin lên đầu trang trong 24h',
      data: { promoted_until: promotedUntil.toISOString(), remaining_pushes: pushLimit - usedPush - 1 }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/company/campaigns/:id - Update campaign
router.put('/company/campaigns/:id', userAuth, async (req, res) => {
  try {
    const db = await openDb();
    const { id } = req.params;
        const { 
      title, description, job_type, province, district, location, salary_text, shift_text, 
      quantity_needed, bounty_amount, qualification_days, 
      is_public, ctv_enabled, status 
    } = req.body;

    const finalBounty = Number(bounty_amount || 0);
    const finalCtvReward = Math.floor(finalBounty * 0.8);
    const finalPlatformFee = finalBounty - finalCtvReward;

    await db.run(`
      UPDATE campaigns SET 
        title = ?, description = ?, job_type = ?, province = ?, district = ?, location = ?, salary_text = ?, shift_text = ?, 
        quantity_needed = ?, bounty_amount = ?, ctv_reward_amount = ?, 
        platform_fee_amount = ?, qualification_days = ?, is_public = ?, 
        ctv_enabled = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title, description, job_type, province, district, location, salary_text, shift_text, 
      Number(quantity_needed || 1), finalBounty, finalCtvReward, 
      finalPlatformFee, Number(qualification_days || 7), 
      is_public ? 1 : 0, ctv_enabled ? 1 : 0, status || 'pending', id
    ]);

    await db.close();
    res.json({ success: true, message: 'Campaign updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/company/campaigns/:id - Delete campaign (only if no leads yet)
router.delete('/company/campaigns/:id', userAuth, async (req, res) => {
  try {
    const db = await openDb();
    const { id } = req.params;

    // Check if campaign has leads
    const leads = await db.get('SELECT COUNT(*) as count FROM lead_submissions WHERE campaign_id = ?', id);
    if (leads && leads.count > 0) {
      await db.close();
      return res.status(400).json({ success: false, error: 'HAS_LEADS', message: 'Không thể xóa chiến dịch đã có ứng viên/lead.' });
    }

    await db.run('DELETE FROM campaigns WHERE id = ?', id);
    await db.close();
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
