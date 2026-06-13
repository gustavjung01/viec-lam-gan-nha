/**
 * Marketplace API Routes
 * Phase 3-lite: Lead engine API
 */

import express from 'express';
const router = express.Router();
import { openDb } from '../database.js';

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

// ============== COMPANY API ==============

// POST /api/company/campaigns - Create new campaign
router.post('/company/campaigns', async (req, res) => {
  try {
    const db = await openDb();
    const {
      company_id,
      title,
      description,
      job_type,
      location,
      province,
      district,
      salary_text,
      shift_text,
      quantity_needed,
      requirements,
      bounty_amount,
      qualification_days,
      max_leads
    } = req.body;

    // Calculate amounts
    const ctv_reward_amount = Math.floor(bounty_amount * 0.8);
    const platform_fee_amount = Math.floor(bounty_amount * 0.2);

    const campaignId = 'camp-' + Date.now();
    const campaignCode = generateCode('CMP');

    await db.run(`
      INSERT INTO campaigns 
      (id, campaign_code, company_id, title, description, job_type, location, province, district,
       salary_text, shift_text, quantity_needed, requirements, bounty_amount, ctv_reward_amount,
       platform_fee_amount, qualification_days, max_leads, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [
      campaignId, campaignCode, company_id, title, description, job_type, location,
      province, district, salary_text, shift_text, quantity_needed,
      JSON.stringify(requirements || []), bounty_amount, ctv_reward_amount,
      platform_fee_amount, qualification_days || 7, max_leads || 50
    ]);

    // Audit log
    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'campaign', ?, 'created', 'company', ?, ?)
    `, [generateCode('AUD'), campaignId, company_id, JSON.stringify({ title, bounty_amount })]);

    const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', campaignId);
    await db.close();

    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    console.error('Create campaign error:', error);
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
      JOIN ctv_accounts ca ON ls.ctv_id = ca.id
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

    // Check company wallet balance
    const company = await db.get('SELECT wallet_balance, credit_limit FROM companies WHERE id = ?', company_id);
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

      // Platform fee (20%)
      await db.run(`
        INSERT INTO platform_fees (id, lead_id, campaign_id, company_id, fee_amount, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `, [generateCode('FEE'), leadId, lead.campaign_id, company_id, campaign.platform_fee_amount]);

      // CTV payout (80%)
      await db.run(`
        INSERT INTO ctv_payouts (id, lead_id, ctv_id, campaign_id, payout_amount, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `, [generateCode('PAY'), leadId, lead.ctv_id, lead.campaign_id, campaign.ctv_reward_amount]);

      // Update CTV total earned
      await db.run(`
        UPDATE ctv_accounts SET total_earned = total_earned + ? WHERE id = ?
      `, [campaign.ctv_reward_amount, lead.ctv_id]);
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
      SELECT c.*, co.name as company_name, co.company_code,
             (SELECT COUNT(*) FROM lead_submissions WHERE campaign_id = c.id AND ctv_id = ?) as my_leads
      FROM campaigns c
      JOIN companies co ON c.company_id = co.id
      WHERE c.status = 'active'
        AND c.start_date <= date('now')
        AND (c.end_date IS NULL OR c.end_date >= date('now'))
      ORDER BY c.created_at DESC
    `, req.query.ctv_id || '');

    await db.close();
    res.json({ success: true, data: campaigns });
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
      note
    } = req.body;

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
        INSERT INTO candidates (id, name, phone, normalized_phone, zalo_phone, birth_year, province, district, desired_job, desired_shift, consent_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'granted')
      `, [candidateId, candidate_name, candidate_phone, normalizedPhone, zalo_phone || null, birth_year || null, province, district, desired_job, desired_shift]);
      candidate = { id: candidateId };
    }

    // Create lead submission
    const leadId = 'lead-' + Date.now();
    const leadCode = generateCode('LED');

    await db.run(`
      INSERT INTO lead_submissions 
      (id, lead_code, campaign_id, ctv_id, candidate_id, status, is_anonymous, submitted_at)
      VALUES (?, ?, ?, ?, ?, 'submitted', 1, datetime('now'))
    `, [leadId, leadCode, campaign_id, ctv_id, candidate.id]);

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
        c.title as campaign_title, c.bounty_amount, c.ctv_reward_amount,
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

// GET /api/ctv/payouts - Get CTV's payouts
router.get('/ctv/payouts', async (req, res) => {
  try {
    const db = await openDb();
    const { ctv_id } = req.query;

    const payouts = await db.all(`
      SELECT 
        cp.*,
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
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.payout_amount, 0);
    const totalPaid = payouts
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.payout_amount, 0);

    await db.close();
    res.json({
      success: true,
      data: payouts,
      summary: {
        total_pending: totalPending,
        total_paid: totalPaid,
        count: payouts.length
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

    await db.close();
    res.json({ success: true, message: 'Campaign approved' });
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
      JOIN ctv_accounts ca ON ls.ctv_id = ca.id
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
    const { period } = req.query; // Format: YYYY-MM

    let dateFilter = '';
    if (period) {
      dateFilter = `AND strftime('%Y-%m', ls.qualified_at) = '${period}'`;
    }

    // Summary stats
    const summary = await db.get(`
      SELECT 
        COUNT(*) as total_qualified_leads,
        SUM(c.bounty_amount) as total_company_bounty,
        SUM(c.platform_fee_amount) as total_platform_fees,
        SUM(c.ctv_reward_amount) as total_ctv_payouts
      FROM lead_submissions ls
      JOIN campaigns c ON ls.campaign_id = c.id
      WHERE ls.status = 'qualified' ${dateFilter}
    `);

    // Platform fees detail
    const platformFees = await db.all(`
      SELECT 
        pf.*,
        ls.lead_code, c.title as campaign_title, co.name as company_name
      FROM platform_fees pf
      JOIN lead_submissions ls ON pf.lead_id = ls.id
      JOIN campaigns c ON pf.campaign_id = c.id
      JOIN companies co ON pf.company_id = co.id
      WHERE 1=1 ${dateFilter.replace('ls.qualified_at', 'pf.created_at')}
      ORDER BY pf.created_at DESC
    `);

    // CTV payouts detail
    const ctvPayouts = await db.all(`
      SELECT 
        cp.*,
        ls.lead_code, c.title as campaign_title, ca.name as ctv_name
      FROM ctv_payouts cp
      JOIN lead_submissions ls ON cp.lead_id = ls.id
      JOIN campaigns c ON cp.campaign_id = c.id
      JOIN ctv_accounts ca ON cp.ctv_id = ca.id
      WHERE 1=1 ${dateFilter.replace('ls.qualified_at', 'cp.created_at')}
      ORDER BY cp.created_at DESC
    `);

    // Pending payments (company debt)
    const pendingPayments = await db.all(`
      SELECT 
        pf.company_id, co.name as company_name, co.company_code,
        SUM(pf.fee_amount) as total_pending_fees,
        COUNT(*) as pending_count
      FROM platform_fees pf
      JOIN companies co ON pf.company_id = co.id
      WHERE pf.status = 'pending'
      GROUP BY pf.company_id
    `);

    await db.close();

    res.json({
      success: true,
      period: period || 'all',
      summary: {
        total_qualified_leads: summary.total_qualified_leads || 0,
        total_company_bounty: summary.total_company_bounty || 0,
        total_platform_fees_20_percent: summary.total_platform_fees || 0,
        total_ctv_payouts_80_percent: summary.total_ctv_payouts || 0
      },
      platform_fees: platformFees,
      ctv_payouts: ctvPayouts,
      pending_company_debt: pendingPayments,
      split_verification: {
        'company_pays': summary.total_company_bounty || 0,
        'ctv_receives_80%': summary.total_ctv_payouts || 0,
        'platform_keeps_20%': summary.total_platform_fees || 0,
        'math_check': (summary.total_ctv_payouts || 0) + (summary.total_platform_fees || 0) === (summary.total_company_bounty || 0)
      }
    });
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

export default router;
