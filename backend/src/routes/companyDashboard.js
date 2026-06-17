import express from 'express';
import { openDb } from '../database.js';
import { userAuth } from '../middleware/userAuth.js';

const router = express.Router();

function normalizeAccountStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function isAllowedCompanyStatus(status) {
  const value = normalizeAccountStatus(status);
  return value === 'active' || value === 'approved';
}

async function getOwnedCompany(db, req, requestedCompanyId = '') {
  const company = await db.get('SELECT * FROM companies WHERE clerk_user_id = ?', [req.user.clerkUserId]);
  if (!company) {
    return { error: { status: 403, code: 'COMPANY_NOT_REGISTERED', message: 'Company account is not registered.' } };
  }

  if (!isAllowedCompanyStatus(company.status)) {
    return { error: { status: 403, code: 'COMPANY_NOT_APPROVED', message: 'Company account is not approved yet.' } };
  }

  const normalizedRequestedId = String(requestedCompanyId || '').trim();
  if (normalizedRequestedId && normalizedRequestedId !== company.id) {
    return { error: { status: 403, code: 'COMPANY_FORBIDDEN', message: 'Company account does not match current user.' } };
  }

  return { company };
}

router.get('/company/campaigns', userAuth, async (req, res) => {
  let db;
  try {
    db = await openDb();
    const { company, error } = await getOwnedCompany(db, req, req.query.company_id);
    if (error) {
      await db.close();
      db = null;
      return res.status(error.status).json({ success: false, error: error.code, message: error.message });
    }

    const campaigns = await db.all(`
      SELECT id, campaign_code, title, description, job_type, location, province, district,
             salary_text, shift_text, quantity_needed, bounty_amount, ctv_reward_amount,
             platform_fee_amount, qualification_days, max_leads, current_leads, status,
             visibility, is_public, ctv_enabled, NULL AS promoted_until, created_at, updated_at
      FROM campaigns
      WHERE company_id = ?
      ORDER BY updated_at DESC, created_at DESC
    `, [company.id]);

    await db.close();
    db = null;
    return res.json({ success: true, data: campaigns });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Fetch company campaigns failed:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
});

router.get('/company/leads', userAuth, async (req, res) => {
  let db;
  try {
    db = await openDb();
    const { company, error } = await getOwnedCompany(db, req, req.query.company_id);
    if (error) {
      await db.close();
      db = null;
      return res.status(error.status).json({ success: false, error: error.code, message: error.message });
    }

    const leads = await db.all(`
      SELECT l.id, l.lead_code, l.campaign_id, c.title AS campaign_title,
             l.status, l.is_anonymous, l.claimed_by_company_id, l.submitted_at, l.claimed_at,
             c.bounty_amount,
             CASE WHEN COALESCE(l.is_anonymous, 1) = 0 OR l.claimed_by_company_id = ? THEN cand.name ELSE NULL END AS candidate_name,
             CASE WHEN COALESCE(l.is_anonymous, 1) = 0 OR l.claimed_by_company_id = ? THEN cand.phone ELSE NULL END AS candidate_phone,
             cand.province AS candidate_province,
             cand.district AS candidate_district,
             COALESCE(ctv.name, '') AS ctv_name
      FROM lead_submissions l
      JOIN campaigns c ON c.id = l.campaign_id
      LEFT JOIN candidates cand ON cand.id = l.candidate_id
      LEFT JOIN ctv_accounts ctv ON ctv.id = l.ctv_id
      WHERE c.company_id = ?
        AND (
          l.status IN ('approved', 'claimed', 'interviewing', 'hired', 'qualified', 'paid')
          OR l.claimed_by_company_id = ?
        )
      ORDER BY l.submitted_at DESC
    `, [company.id, company.id, company.id, company.id]);

    await db.close();
    db = null;
    return res.json({ success: true, data: leads });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Fetch company leads failed:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
});

export default router;
