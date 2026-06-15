import { Router } from 'express';
import { openDb } from '../database.js';

const router = Router();

function sendError(res, error) {
  const status = error?.statusCode || 500;
  res.status(status).json({
    success: false,
    message: error?.message || 'Internal Server Error',
  });
}

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCompanyStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'suspended') return 'blocked';
  return value || 'pending';
}

function normalizeCtvStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'suspended' || value === 'banned') return 'blocked';
  return value || 'pending';
}

function normalizeCampaignVisibility(value) {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'public' || status === 'public_candidate') return 'public_candidate';
  if (status === 'ctv_public' || status === 'ctv_private') return 'ctv_private';
  return status || 'ctv_private';
}

function buildLikeClauses(columns, search) {
  const term = String(search || '').trim();
  if (!term) return { clause: '', params: [] };

  const pattern = `%${term.toLowerCase()}%`;
  const clause = `(${columns.map((column) => `LOWER(COALESCE(${column}, '')) LIKE ?`).join(' OR ')})`;
  return { clause, params: columns.map(() => pattern) };
}

async function withDb(fn) {
  const db = await openDb();
  try {
    return await fn(db);
  } finally {
    await db.close();
  }
}

router.get('/campaigns', async (req, res) => {
  try {
    const data = await withDb(async (db) => {
      const rows = await db.all(`
        SELECT
          c.id,
          c.campaign_code,
          c.company_id,
          c.title,
          c.status,
          COALESCE(c.visibility, 'ctv_private') AS visibility,
          COALESCE(c.bounty_amount, 0) AS bounty_amount,
          COALESCE(c.ctv_reward_amount, 0) AS ctv_reward_amount,
          COALESCE(c.platform_fee_amount, 0) AS platform_fee_amount,
          COALESCE(c.current_leads, 0) AS current_leads,
          COALESCE(comp.name, '') AS company_name,
          COALESCE(comp.company_code, '') AS company_code,
          COUNT(ls.id) AS total_leads
        FROM campaigns c
        LEFT JOIN companies comp ON comp.id = c.company_id
        LEFT JOIN lead_submissions ls ON ls.campaign_id = c.id
        GROUP BY c.id
        ORDER BY datetime(COALESCE(c.created_at, CURRENT_TIMESTAMP)) DESC, c.title ASC
      `);

      return rows.map((row) => ({
        id: row.id,
        campaign_code: row.campaign_code,
        company_id: row.company_id,
        title: row.title,
        company_name: row.company_name,
        company_code: row.company_code,
        status: String(row.status || 'draft').trim().toLowerCase(),
        visibility: normalizeCampaignVisibility(row.visibility),
        bounty_amount: Number(row.bounty_amount || 0),
        platform_fee_amount: Number(row.platform_fee_amount || 0),
        ctv_reward_amount: Number(row.ctv_reward_amount || 0),
        total_leads: Number(row.total_leads || 0),
      }));
    });

    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/leads', async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 10)));
    const offset = (page - 1) * limit;
    const filters = [];
    const params = [];

    const { clause: searchClause, params: searchParams } = buildLikeClauses([
      'ls.lead_code',
      'cand.name',
      'cand.phone',
      'cand.zalo_phone',
      'c.title',
      'comp.name',
      'ctv.name',
    ], req.query.search);
    if (searchClause) {
      filters.push(searchClause);
      params.push(...searchParams);
    }

    if (req.query.status && req.query.status !== 'all') {
      filters.push('LOWER(COALESCE(ls.status, \'\')) = ?');
      params.push(String(req.query.status).trim().toLowerCase());
    }

    if (req.query.campaign_id && req.query.campaign_id !== 'all') {
      filters.push('ls.campaign_id = ?');
      params.push(String(req.query.campaign_id).trim());
    }

    if (req.query.company_id && req.query.company_id !== 'all') {
      filters.push('c.company_id = ?');
      params.push(String(req.query.company_id).trim());
    }

    if (req.query.ctv_id && req.query.ctv_id !== 'all') {
      if (String(req.query.ctv_id).trim() === 'direct') {
        filters.push('(ls.ctv_id IS NULL OR TRIM(ls.ctv_id) = \'\')');
      } else {
        filters.push('ls.ctv_id = ?');
        params.push(String(req.query.ctv_id).trim());
      }
    }

    if (req.query.province) {
      filters.push('LOWER(COALESCE(cand.province, \'\')) LIKE ?');
      params.push(`%${String(req.query.province).trim().toLowerCase()}%`);
    }

    if (req.query.district) {
      filters.push('LOWER(COALESCE(cand.district, \'\')) LIKE ?');
      params.push(`%${String(req.query.district).trim().toLowerCase()}%`);
    }

    if (req.query.date_from) {
      filters.push('datetime(COALESCE(ls.submitted_at, ls.qualified_at)) >= datetime(?)');
      params.push(String(req.query.date_from).trim());
    }

    if (req.query.date_to) {
      filters.push('datetime(COALESCE(ls.submitted_at, ls.qualified_at)) <= datetime(?)');
      params.push(String(req.query.date_to).trim());
    }

    const whereSql = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const data = await withDb(async (db) => {
      const totalRow = await db.get(`
        SELECT COUNT(*) AS total
        FROM lead_submissions ls
        LEFT JOIN campaigns c ON c.id = ls.campaign_id
        LEFT JOIN companies comp ON comp.id = c.company_id
        LEFT JOIN ctv_accounts ctv ON ctv.id = ls.ctv_id
        LEFT JOIN candidates cand ON cand.id = ls.candidate_id
        ${whereSql}
      `, params);

      const rows = await db.all(`
        SELECT
          ls.id,
          ls.lead_code,
          ls.campaign_id,
          ls.ctv_id,
          c.title AS campaign_title,
          c.company_id,
          comp.name AS company_name,
          COALESCE(ctv.name, 'Direct') AS ctv_name,
          cand.name AS candidate_name,
          cand.phone AS candidate_phone,
          cand.phone AS normalized_phone,
          cand.zalo_phone AS zalo_phone,
          cand.province AS province,
          cand.district AS district,
          ls.status,
          ls.submitted_at,
          ls.claimed_at,
          ls.qualified_at,
          ls.processed_by,
          ls.notes,
          ls.source_type,
          ls.owner_type,
          ls.assigned_admin_id,
          ls.assignment_method,
          ls.source_metadata,
          ls.claimed_by_company_id,
          ls.rejected_reason
        FROM lead_submissions ls
        LEFT JOIN campaigns c ON c.id = ls.campaign_id
        LEFT JOIN companies comp ON comp.id = c.company_id
        LEFT JOIN ctv_accounts ctv ON ctv.id = ls.ctv_id
        LEFT JOIN candidates cand ON cand.id = ls.candidate_id
        ${whereSql}
        ORDER BY datetime(COALESCE(ls.submitted_at, ls.qualified_at, CURRENT_TIMESTAMP)) DESC, ls.id DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]);

      const dataRows = rows.map((row) => ({
        id: row.id,
        lead_code: row.lead_code,
        campaign_id: row.campaign_id,
        ctv_id: row.ctv_id || null,
        campaign_title: row.campaign_title || '',
        company_id: row.company_id || null,
        company_name: row.company_name || null,
        ctv_name: row.ctv_name || null,
        candidate_name: row.candidate_name || '',
        candidate_phone: row.candidate_phone || '',
        normalized_phone: row.normalized_phone || '',
        zalo_phone: row.zalo_phone || '',
        province: row.province || '',
        district: row.district || '',
        status: String(row.status || 'submitted').trim().toLowerCase(),
        submitted_at: row.submitted_at || null,
        processed_by: row.processed_by || null,
        notes: row.notes || null,
        claimed_at: row.claimed_at || null,
        qualified_at: row.qualified_at || null,
        source_type: row.source_type || null,
        owner_type: row.owner_type || null,
        assigned_admin_id: row.assigned_admin_id || null,
        assignment_method: row.assignment_method || null,
        source_metadata: row.source_metadata || null,
        claimed_by_company_id: row.claimed_by_company_id || null,
        rejected_reason: row.rejected_reason || null,
      }));

      return {
        data: dataRows,
        pagination: {
          page,
          limit,
          total: Number(totalRow?.total || 0),
          totalPages: Math.max(1, Math.ceil(Number(totalRow?.total || 0) / limit)),
          hasMore: page * limit < Number(totalRow?.total || 0),
        },
      };
    });

    res.json({ success: true, data: data.data, pagination: data.pagination });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/all-ctv', async (req, res) => {
  try {
    const data = await withDb(async (db) => {
      const rows = await db.all(`
        SELECT
          id,
          ctv_code,
          name,
          phone,
          email,
          zalo_phone,
          bank_account,
          bank_name,
          province,
          district,
          CASE
            WHEN LOWER(COALESCE(status, '')) IN ('suspended', 'banned') THEN 'blocked'
            ELSE LOWER(COALESCE(status, 'pending'))
          END AS status,
          COALESCE(rejection_reason, '') AS rejection_reason,
          submitted_at,
          created_at,
          COALESCE(trust_score, 100) AS trust_score,
          COALESCE(total_earned, 0) AS total_earned
        FROM ctv_accounts
        ORDER BY datetime(COALESCE(created_at, CURRENT_TIMESTAMP)) DESC, name ASC
      `);

      return rows.map((row) => ({
        id: row.id,
        ctv_code: row.ctv_code,
        name: row.name,
        phone: row.phone || '',
        email: row.email || '',
        zalo_phone: row.zalo_phone || '',
        bank_account: row.bank_account || '',
        bank_name: row.bank_name || '',
        province: row.province || '',
        district: row.district || '',
        status: row.status || 'pending',
        rejection_reason: row.rejection_reason || '',
        submitted_at: row.submitted_at || null,
        created_at: row.created_at || null,
        trust_score: Number(row.trust_score || 0),
        total_earned: Number(row.total_earned || 0),
      }));
    });

    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/all-companies', async (req, res) => {
  try {
    const data = await withDb(async (db) => {
      const rows = await db.all(`
        SELECT
          id,
          company_code,
          clerk_user_id,
          name,
          phone,
          email,
          tax_code,
          address,
          province,
          district,
          CASE
            WHEN LOWER(COALESCE(status, '')) = 'suspended' THEN 'blocked'
            ELSE LOWER(COALESCE(status, 'pending'))
          END AS status,
          COALESCE(rejection_reason, '') AS rejection_reason,
          submitted_at,
          created_at,
          COALESCE(trust_level, 'normal') AS trust_level,
          COALESCE(deposit_status, 'none') AS deposit_status,
          COALESCE(lead_trial_limit, 2) AS lead_trial_limit,
          COALESCE(require_deposit_after_leads, 2) AS require_deposit_after_leads,
          COALESCE(is_featured, 0) AS is_featured,
          COALESCE(plan_code, 'free') AS plan_code,
          COALESCE(free_job_posts_limit, 5) AS free_job_posts_limit,
          COALESCE(weekly_push_limit, 5) AS weekly_push_limit,
          COALESCE(wallet_balance, 0) AS wallet_balance
        FROM companies
        ORDER BY datetime(COALESCE(created_at, CURRENT_TIMESTAMP)) DESC, name ASC
      `);

      return rows.map((row) => ({
        id: row.id,
        company_code: row.company_code,
        clerk_user_id: row.clerk_user_id || null,
        name: row.name,
        phone: row.phone || '',
        email: row.email || '',
        tax_code: row.tax_code || '',
        address: row.address || '',
        province: row.province || '',
        district: row.district || '',
        status: row.status || 'pending',
        rejection_reason: row.rejection_reason || '',
        submitted_at: row.submitted_at || null,
        created_at: row.created_at || null,
        trust_level: row.trust_level || 'normal',
        deposit_status: row.deposit_status || 'none',
        lead_trial_limit: Number(row.lead_trial_limit || 0),
        require_deposit_after_leads: Number(row.require_deposit_after_leads || 0),
        is_featured: Number(row.is_featured || 0),
        plan_code: row.plan_code || 'free',
        free_job_posts_limit: Number(row.free_job_posts_limit || 0),
        weekly_push_limit: Number(row.weekly_push_limit || 0),
        wallet_balance: Number(row.wallet_balance || 0),
      }));
    });

    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, toInt(req.query.limit, 10)));
    const offset = Math.max(0, toInt(req.query.offset, 0));

    const data = await withDb(async (db) => {
      const rows = await db.all(`
        SELECT
          id,
          entity_type,
          entity_id,
          action,
          actor_role,
          actor_id,
          details,
          created_at
        FROM audit_logs
        ORDER BY datetime(COALESCE(created_at, CURRENT_TIMESTAMP)) DESC, id DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]);

      return rows.map((row) => ({
        id: row.id,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        action: row.action,
        actor_role: row.actor_role || '',
        actor_id: row.actor_id || '',
        details: row.details || '',
        created_at: row.created_at || null,
      }));
    });

    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/tax-report', async (req, res) => {
  try {
    const data = await withDb(async (db) => {
      const qualifiedRows = await db.all(`
        SELECT
          ls.id,
          ls.lead_code,
          COALESCE(ls.qualified_at, ls.submitted_at) AS qualified_at,
          c.title AS campaign_title,
          comp.name AS company_name,
          COALESCE(ctv.name, 'Direct') AS ctv_name,
          COALESCE(c.bounty_amount, COALESCE(c.platform_fee_amount, 0) + COALESCE(c.ctv_reward_amount, 0), 0) AS bounty_amount,
          COALESCE(c.platform_fee_amount, CAST(ROUND(COALESCE(c.bounty_amount, 0) * 0.2) AS INTEGER), 0) AS platform_fee_amount,
          COALESCE(c.ctv_reward_amount, CAST(ROUND(COALESCE(c.bounty_amount, 0) * 0.8) AS INTEGER), 0) AS ctv_reward_amount
        FROM lead_submissions ls
        INNER JOIN campaigns c ON c.id = ls.campaign_id
        LEFT JOIN companies comp ON comp.id = c.company_id
        LEFT JOIN ctv_accounts ctv ON ctv.id = ls.ctv_id
        WHERE ls.status IN ('qualified', 'paid') OR ls.qualified_at IS NOT NULL
        ORDER BY datetime(COALESCE(ls.qualified_at, ls.submitted_at, CURRENT_TIMESTAMP)) DESC, ls.id DESC
      `);

      const platformFeeRows = await db.all(`
        SELECT
          pf.id,
          pf.lead_id,
          ls.lead_code,
          c.title AS campaign_title,
          comp.name AS company_name,
          COALESCE(pf.fee_amount, 0) AS fee_amount,
          COALESCE(pf.status, 'pending') AS status,
          pf.created_at,
          pf.invoiced_at,
          pf.paid_at,
          pf.transaction_reference
        FROM platform_fees pf
        INNER JOIN lead_submissions ls ON ls.id = pf.lead_id
        INNER JOIN campaigns c ON c.id = pf.campaign_id
        INNER JOIN companies comp ON comp.id = pf.company_id
        ORDER BY datetime(COALESCE(pf.created_at, CURRENT_TIMESTAMP)) DESC, pf.id DESC
      `);

      const ctvPayoutRows = await db.all(`
        SELECT
          cp.id,
          cp.lead_id,
          ls.lead_code,
          c.title AS campaign_title,
          COALESCE(ctv.name, 'Direct') AS ctv_name,
          COALESCE(cp.payout_amount, 0) AS payout_amount,
          COALESCE(cp.status, 'pending') AS status,
          cp.created_at,
          cp.approved_at,
          cp.paid_at,
          cp.transaction_reference
        FROM ctv_payouts cp
        INNER JOIN lead_submissions ls ON ls.id = cp.lead_id
        INNER JOIN campaigns c ON c.id = cp.campaign_id
        LEFT JOIN ctv_accounts ctv ON ctv.id = cp.ctv_id
        ORDER BY datetime(COALESCE(cp.created_at, CURRENT_TIMESTAMP)) DESC, cp.id DESC
      `);

      const pendingDebtRows = await db.all(`
        SELECT
          c.company_id,
          comp.name AS company_name,
          comp.company_code,
          COUNT(*) AS pending_count,
          COALESCE(SUM(COALESCE(pf.fee_amount, COALESCE(c.platform_fee_amount, CAST(ROUND(COALESCE(c.bounty_amount, 0) * 0.2) AS INTEGER), 0))), 0) AS total_pending_fees
        FROM lead_submissions ls
        INNER JOIN campaigns c ON c.id = ls.campaign_id
        INNER JOIN companies comp ON comp.id = c.company_id
        LEFT JOIN platform_fees pf ON pf.lead_id = ls.id
        WHERE (ls.status IN ('qualified', 'paid') OR ls.qualified_at IS NOT NULL)
          AND COALESCE(pf.status, 'pending') IN ('pending', 'invoiced')
        GROUP BY c.company_id
        ORDER BY total_pending_fees DESC, comp.name ASC
      `);

      const qualifiedLeads = qualifiedRows.map((row) => ({
        id: row.id,
        lead_code: row.lead_code,
        qualified_at: row.qualified_at || null,
        campaign_title: row.campaign_title || '',
        company_name: row.company_name || '',
        ctv_name: row.ctv_name || 'Direct',
        bounty_amount: Number(row.bounty_amount || 0),
        platform_fee_amount: Number(row.platform_fee_amount || 0),
        ctv_reward_amount: Number(row.ctv_reward_amount || 0),
      }));

      const totalCompanyBounty = qualifiedLeads.reduce((sum, item) => sum + Number(item.bounty_amount || 0), 0);
      const totalPlatformRevenue = qualifiedLeads.reduce((sum, item) => sum + Number(item.platform_fee_amount || 0), 0);
      const totalCtvPayable = qualifiedLeads.reduce((sum, item) => sum + Number(item.ctv_reward_amount || 0), 0);
      const totalQualifiedLeads = qualifiedLeads.length;

      const summary = {
        total_qualified_leads: totalQualifiedLeads,
        total_company_bounty: totalCompanyBounty,
        total_platform_fees_20_percent: totalPlatformRevenue,
        total_ctv_payouts_80_percent: totalCtvPayable,
      };

      return {
        period: null,
        summary,
        total_qualified_leads: summary.total_qualified_leads,
        total_company_charged: summary.total_company_bounty,
        total_platform_revenue: summary.total_platform_fees_20_percent,
        total_ctv_payable: summary.total_ctv_payouts_80_percent,
        qualified_leads: qualifiedLeads,
        platform_fees: platformFeeRows.map((row) => ({
          id: row.id,
          lead_id: row.lead_id,
          lead_code: row.lead_code,
          campaign_title: row.campaign_title || '',
          company_name: row.company_name || '',
          fee_amount: Number(row.fee_amount || 0),
          status: row.status || 'pending',
          created_at: row.created_at || null,
          invoiced_at: row.invoiced_at || null,
          paid_at: row.paid_at || null,
          transaction_reference: row.transaction_reference || null,
        })),
        ctv_payouts: ctvPayoutRows.map((row) => ({
          id: row.id,
          lead_id: row.lead_id,
          lead_code: row.lead_code,
          campaign_title: row.campaign_title || '',
          ctv_name: row.ctv_name || 'Direct',
          payout_amount: Number(row.payout_amount || 0),
          status: row.status || 'pending',
          created_at: row.created_at || null,
          approved_at: row.approved_at || null,
          paid_at: row.paid_at || null,
          transaction_reference: row.transaction_reference || null,
        })),
        pending_company_debt: pendingDebtRows.map((row) => ({
          company_id: row.company_id,
          company_name: row.company_name || '',
          company_code: row.company_code || '',
          total_pending_fees: Number(row.total_pending_fees || 0),
          pending_count: Number(row.pending_count || 0),
        })),
        split_verification: {
          math_check: totalCompanyBounty === (totalPlatformRevenue + totalCtvPayable),
          company_pays: totalCompanyBounty,
          'ctv_receives_80%': totalCtvPayable,
          'platform_keeps_20%': totalPlatformRevenue,
        },
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
