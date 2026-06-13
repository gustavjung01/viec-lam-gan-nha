import { openDb } from '../database.js';

const DEFAULT_SLA = {
  approvedResponseHours: 6,
  claimedInterviewHours: 24,
  interviewingResultHours: 72,
  reminderBeforeMinutes: 60,
};

const ENGINE_INTERVAL_MS = Number(process.env.LEAD_SLA_ENGINE_INTERVAL_MS || 60_000);
const ENGINE_ENABLED = String(process.env.LEAD_SLA_ENGINE_ENABLED || 'true').toLowerCase() !== 'false';
const AUTO_RECLAIM_ENABLED = String(process.env.LEAD_SLA_AUTO_RECLAIM_ENABLED || 'false').toLowerCase() === 'true';
const ENGINE_STARTED_AT_SQL = new Date().toISOString().slice(0, 19).replace('T', ' ');

let started = false;
let running = false;

function generateCode(prefix) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

function toDate(value) {
  if (!value) return null;
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T') + 'Z';
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

function toSqlDate(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function statusLabel(status) {
  return {
    approved: 'đã duyệt, chờ công ty xác nhận',
    claimed: 'đã nhận, chờ cập nhật phỏng vấn',
    interviewing: 'đang phỏng vấn, chờ kết quả',
    hired: 'đã đi làm, chờ đủ điều kiện',
    disputed: 'công ty báo nghỉ / không đạt, chờ admin xử lý',
    qualified: 'đủ điều kiện',
  }[status] || status;
}

function getBaseTime(lead) {
  return toDate(lead.status_changed_at) || toDate(lead.claimed_at) || toDate(lead.submitted_at) || new Date();
}

function getDueDate(lead) {
  const base = getBaseTime(lead);
  if (lead.status === 'approved') {
    return addMinutes(base, Number(lead.sla_approved_response_hours || DEFAULT_SLA.approvedResponseHours) * 60);
  }
  if (lead.status === 'claimed') {
    return addMinutes(base, Number(lead.sla_claimed_interview_hours || DEFAULT_SLA.claimedInterviewHours) * 60);
  }
  if (lead.status === 'interviewing') {
    return addMinutes(base, Number(lead.sla_interviewing_result_hours || DEFAULT_SLA.interviewingResultHours) * 60);
  }
  if (lead.status === 'hired') {
    return addMinutes(base, Number(lead.qualification_days || 7) * 24 * 60);
  }
  return null;
}

function getReminderDate(lead, dueAt) {
  const minutes = Number(lead.sla_reminder_before_minutes || DEFAULT_SLA.reminderBeforeMinutes);
  return addMinutes(dueAt, -minutes);
}

async function tableExists(db, table) {
  const row = await db.get(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`, table);
  return Boolean(row);
}

async function hasColumn(db, table, column) {
  const rows = await db.all(`PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
}

async function ensureColumn(db, table, column, definition) {
  if (!(await tableExists(db, table))) return;
  if (!(await hasColumn(db, table, column))) {
    await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function ensureLeadSlaSchema() {
  const db = await openDb();
  try {
    await ensureColumn(db, 'campaigns', 'sla_enabled', 'INTEGER DEFAULT 1');
    await ensureColumn(db, 'campaigns', 'sla_approved_response_hours', `INTEGER DEFAULT ${DEFAULT_SLA.approvedResponseHours}`);
    await ensureColumn(db, 'campaigns', 'sla_claimed_interview_hours', `INTEGER DEFAULT ${DEFAULT_SLA.claimedInterviewHours}`);
    await ensureColumn(db, 'campaigns', 'sla_interviewing_result_hours', `INTEGER DEFAULT ${DEFAULT_SLA.interviewingResultHours}`);
    await ensureColumn(db, 'campaigns', 'sla_reminder_before_minutes', `INTEGER DEFAULT ${DEFAULT_SLA.reminderBeforeMinutes}`);
    await ensureColumn(db, 'campaigns', 'sla_auto_reclaim_enabled', 'INTEGER DEFAULT 0');
    await ensureColumn(db, 'campaigns', 'sla_auto_transfer_enabled', 'INTEGER DEFAULT 0');

    await db.run(`
      CREATE TABLE IF NOT EXISTS lead_sla_events (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL,
        campaign_id TEXT,
        event_key TEXT UNIQUE NOT NULL,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL,
        due_at DATETIME,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`CREATE INDEX IF NOT EXISTS idx_lead_sla_events_lead ON lead_sla_events(lead_id)`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_lead_sla_events_key ON lead_sla_events(event_key)`);
  } finally {
    await db.close();
  }
}

async function recordSlaEvent(db, lead, eventType, dueAt, details = {}) {
  const base = String(details.event_base || lead.status_changed_at || lead.claimed_at || lead.submitted_at || '').replace(/[^0-9A-Za-z]/g, '');
  const eventKey = `${lead.id}:${lead.status}:${eventType}:${base || 'na'}`;
  const result = await db.run(`
    INSERT OR IGNORE INTO lead_sla_events (id, lead_id, campaign_id, event_key, event_type, status, due_at, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    generateCode('SLA'),
    lead.id,
    lead.campaign_id,
    eventKey,
    eventType,
    lead.status,
    dueAt ? toSqlDate(dueAt) : null,
    JSON.stringify(details),
  ]);

  return Number(result?.changes || 0) > 0;
}

async function getActiveSlaLeads(db) {
  return db.all(`
    SELECT
      ls.id,
      ls.lead_code,
      ls.status,
      ls.campaign_id,
      ls.ctv_id,
      ls.source_type,
      ls.owner_type,
      ls.submitted_at,
      ls.claimed_at,
      ls.claimed_by_company_id,
      h.created_at as status_changed_at,
      c.title as campaign_title,
      c.qualification_days,
      COALESCE(c.sla_enabled, 1) as sla_enabled,
      COALESCE(c.sla_approved_response_hours, ?) as sla_approved_response_hours,
      COALESCE(c.sla_claimed_interview_hours, ?) as sla_claimed_interview_hours,
      COALESCE(c.sla_interviewing_result_hours, ?) as sla_interviewing_result_hours,
      COALESCE(c.sla_reminder_before_minutes, ?) as sla_reminder_before_minutes,
      COALESCE(c.sla_auto_reclaim_enabled, 0) as sla_auto_reclaim_enabled,
      COALESCE(c.sla_auto_transfer_enabled, 0) as sla_auto_transfer_enabled,
      co.id as company_id,
      co.name as company_name,
      co.clerk_user_id as company_clerk_user_id,
      ca.clerk_user_id as ctv_clerk_user_id,
      cd.name as candidate_name,
      cd.phone as candidate_phone
    FROM lead_submissions ls
    JOIN campaigns c ON ls.campaign_id = c.id
    JOIN companies co ON c.company_id = co.id
    JOIN candidates cd ON ls.candidate_id = cd.id
    LEFT JOIN ctv_accounts ca ON ls.ctv_id = ca.id
    LEFT JOIN lead_status_history h ON h.id = (
      SELECT h2.id
      FROM lead_status_history h2
      WHERE h2.lead_id = ls.id AND h2.to_status = ls.status
      ORDER BY h2.created_at DESC
      LIMIT 1
    )
    WHERE ls.status IN ('approved', 'claimed', 'interviewing', 'hired')
      AND COALESCE(c.sla_enabled, 1) = 1
    ORDER BY ls.submitted_at ASC
    LIMIT 200
  `, [
    DEFAULT_SLA.approvedResponseHours,
    DEFAULT_SLA.claimedInterviewHours,
    DEFAULT_SLA.interviewingResultHours,
    DEFAULT_SLA.reminderBeforeMinutes,
  ]);
}

async function getRecentMilestones(db) {
  return db.all(`
    SELECT
      ls.id,
      ls.lead_code,
      ls.status,
      ls.campaign_id,
      ls.ctv_id,
      ls.source_type,
      ls.owner_type,
      ls.claimed_by_company_id,
      h.id as history_id,
      h.from_status,
      h.to_status,
      h.changed_by_role,
      h.changed_by_id,
      h.reason,
      h.created_at as status_changed_at,
      c.title as campaign_title,
      c.qualification_days,
      co.name as company_name,
      co.clerk_user_id as company_clerk_user_id,
      ca.clerk_user_id as ctv_clerk_user_id,
      cd.name as candidate_name
    FROM lead_status_history h
    JOIN lead_submissions ls ON h.lead_id = ls.id
    JOIN campaigns c ON ls.campaign_id = c.id
    JOIN companies co ON c.company_id = co.id
    JOIN candidates cd ON ls.candidate_id = cd.id
    LEFT JOIN ctv_accounts ca ON ls.ctv_id = ca.id
    WHERE h.created_at >= ?
      AND h.to_status IN ('approved', 'claimed', 'interviewing', 'hired', 'disputed', 'qualified')
    ORDER BY h.created_at ASC
    LIMIT 100
  `, [ENGINE_STARTED_AT_SQL]);
}

async function notifySlaReminder(sendNotification, lead, dueAt) {
  if (!lead.company_clerk_user_id) return;
  await sendNotification({
    clerkUserId: lead.company_clerk_user_id,
    title: 'Lead sắp quá hạn cập nhật',
    message: `Lead ${lead.lead_code} đang ${statusLabel(lead.status)}. Vui lòng cập nhật trước ${toSqlDate(dueAt)}.`,
    url: '/company/leads',
    data: {
      event: 'lead_sla_reminder',
      lead_id: lead.id,
      lead_code: lead.lead_code,
      status: lead.status,
      due_at: toSqlDate(dueAt),
    },
  });
}

async function notifySlaOverdue(sendNotification, lead, dueAt) {
  const message = `Lead ${lead.lead_code} đã quá hạn ở trạng thái ${statusLabel(lead.status)}.`;

  await sendNotification({
    role: 'admin',
    title: 'Lead quá hạn SLA',
    message,
    url: '/admin/console',
    data: {
      event: 'lead_sla_overdue',
      lead_id: lead.id,
      lead_code: lead.lead_code,
      status: lead.status,
      due_at: toSqlDate(dueAt),
    },
  });

  if (lead.company_clerk_user_id) {
    await sendNotification({
      clerkUserId: lead.company_clerk_user_id,
      title: 'Lead đã quá hạn cập nhật',
      message: `${message} Admin có thể thu hồi hoặc xử lý lại lead này.`,
      url: '/company/leads',
      data: { event: 'lead_sla_overdue_company', lead_id: lead.id, lead_code: lead.lead_code, status: lead.status },
    });
  }

  if (lead.ctv_clerk_user_id) {
    await sendNotification({
      clerkUserId: lead.ctv_clerk_user_id,
      title: 'Lead đang chờ công ty quá hạn',
      message: `Lead ${lead.lead_code} của bạn đang chờ công ty cập nhật quá hạn. Admin sẽ kiểm tra.`,
      url: '/ctv/leads',
      data: { event: 'lead_sla_overdue_ctv', lead_id: lead.id, lead_code: lead.lead_code, status: lead.status },
    });
  }
}

async function notifyMilestone(sendNotification, lead) {
  const toStatus = lead.to_status;
  const code = lead.lead_code;
  const campaign = lead.campaign_title;
  const baseData = {
    event: `lead_milestone_${toStatus}`,
    lead_id: lead.id,
    lead_code: code,
    status: toStatus,
    history_id: lead.history_id,
  };

  if (toStatus === 'approved') {
    if (lead.company_clerk_user_id) {
      await sendNotification({
        clerkUserId: lead.company_clerk_user_id,
        title: 'Lead mới đã được duyệt',
        message: `Lead ${code} đã được admin duyệt cho chiến dịch "${campaign}". Vui lòng xác nhận nhận lead đúng hạn.`,
        url: '/company/leads',
        data: baseData,
      });
    }
    if (lead.ctv_clerk_user_id) {
      await sendNotification({
        clerkUserId: lead.ctv_clerk_user_id,
        title: 'Lead đã được duyệt',
        message: `Lead ${code} của bạn đã được admin duyệt và gửi sang công ty.`,
        url: '/ctv/leads',
        data: baseData,
      });
    }
    return;
  }

  if (toStatus === 'claimed') {
    await sendNotification({ role: 'admin', title: 'Công ty đã nhận lead', message: `Công ty đã nhận lead ${code}.`, url: '/admin/console', data: baseData });
    if (lead.ctv_clerk_user_id) {
      await sendNotification({ clerkUserId: lead.ctv_clerk_user_id, title: 'Công ty đã nhận lead', message: `Lead ${code} của bạn đã được công ty nhận xử lý.`, url: '/ctv/leads', data: baseData });
    }
    return;
  }

  if (toStatus === 'interviewing') {
    await sendNotification({ role: 'admin', title: 'Lead chuyển sang phỏng vấn', message: `Lead ${code} đang được công ty phỏng vấn.`, url: '/admin/console', data: baseData });
    if (lead.ctv_clerk_user_id) {
      await sendNotification({ clerkUserId: lead.ctv_clerk_user_id, title: 'Lead đang phỏng vấn', message: `Lead ${code} của bạn đã vào vòng phỏng vấn.`, url: '/ctv/leads', data: baseData });
    }
    return;
  }

  if (toStatus === 'hired') {
    await sendNotification({ role: 'admin', title: 'Ứng viên đã đi làm', message: `Lead ${code} đã được công ty xác nhận đi làm. Hệ thống bắt đầu đếm đủ điều kiện.`, url: '/admin/console', data: baseData });
    if (lead.company_clerk_user_id) {
      await sendNotification({ clerkUserId: lead.company_clerk_user_id, title: 'Đã bắt đầu tính ngày đủ điều kiện', message: `Lead ${code} sẽ tự đủ điều kiện sau ${lead.qualification_days || 7} ngày nếu không có báo nghỉ / không đạt.`, url: '/company/leads', data: baseData });
    }
    if (lead.ctv_clerk_user_id) {
      await sendNotification({ clerkUserId: lead.ctv_clerk_user_id, title: 'Ứng viên đã đi làm', message: `Lead ${code} đã đi làm. Hệ thống đang đếm ngày đủ điều kiện.`, url: '/ctv/leads', data: baseData });
    }
    return;
  }

  if (toStatus === 'disputed') {
    const reasonText = lead.reason ? ` Lý do: ${lead.reason}` : '';
    await sendNotification({ role: 'admin', title: 'Công ty báo lead không đạt', message: `Lead ${code} cần admin xử lý.${reasonText}`, url: '/admin/console', data: baseData });
    if (lead.ctv_clerk_user_id) {
      await sendNotification({ clerkUserId: lead.ctv_clerk_user_id, title: 'Lead cần kiểm tra', message: `Công ty báo lead ${code} có vấn đề. Admin sẽ kiểm tra.${reasonText}`, url: '/ctv/leads', data: baseData });
    }
    return;
  }

  if (toStatus === 'qualified' && lead.changed_by_role !== 'system') {
    await sendNotification({ role: 'admin', title: 'Lead đủ điều kiện', message: `Lead ${code} đã đủ điều kiện.`, url: '/admin/console', data: baseData });
    if (lead.company_clerk_user_id) {
      await sendNotification({ clerkUserId: lead.company_clerk_user_id, title: 'Lead đã đủ điều kiện', message: `Lead ${code} đã đủ điều kiện theo chiến dịch.`, url: '/company/leads', data: baseData });
    }
    if (lead.ctv_clerk_user_id) {
      await sendNotification({ clerkUserId: lead.ctv_clerk_user_id, title: 'Lead thành công! 💰', message: `Lead ${code} đã đủ điều kiện. Hoa hồng sẽ được đối soát.`, url: '/ctv/commissions', data: baseData });
    }
  }
}

async function processMilestoneNotifications(sendNotification) {
  const db = await openDb();
  let milestones = [];
  try {
    milestones = await getRecentMilestones(db);
    for (const milestone of milestones) {
      const shouldNotify = await recordSlaEvent(db, { ...milestone, status: milestone.to_status }, `milestone_${milestone.to_status}`, null, {
        event_base: milestone.history_id,
        from_status: milestone.from_status,
        changed_by_role: milestone.changed_by_role,
      });
      if (shouldNotify) await notifyMilestone(sendNotification, milestone);
    }
  } finally {
    await db.close();
  }
}

async function createFinancialRecordsForQualifiedLead(db, lead) {
  const campaign = await db.get('SELECT * FROM campaigns WHERE id = ?', lead.campaign_id);
  if (!campaign) return;

  const existingFee = await db.get('SELECT id FROM platform_fees WHERE lead_id = ?', lead.id);
  const feePct = campaign.platform_fee_percentage ?? 20;
  const platformFee = campaign.platform_fee_amount ?? Math.floor((campaign.bounty_amount * feePct) / 100);
  const ctvReward = campaign.ctv_reward_amount ?? (campaign.bounty_amount - platformFee);

  if (!existingFee) {
    await db.run(`
      INSERT INTO platform_fees (id, lead_id, campaign_id, company_id, fee_amount, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `, [generateCode('FEE'), lead.id, lead.campaign_id, campaign.company_id, platformFee]);
  }

  const shouldCreateCtvPayout = Boolean(lead.ctv_id) && lead.source_type === 'ctv' && lead.owner_type === 'ctv';
  if (shouldCreateCtvPayout) {
    const existingPayout = await db.get('SELECT id FROM ctv_payouts WHERE lead_id = ?', lead.id);
    if (!existingPayout) {
      await db.run(`
        INSERT INTO ctv_payouts (id, lead_id, ctv_id, campaign_id, payout_amount, status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `, [generateCode('PAY'), lead.id, lead.ctv_id, lead.campaign_id, ctvReward]);

      await db.run(`UPDATE ctv_accounts SET total_earned = total_earned + ? WHERE id = ?`, [ctvReward, lead.ctv_id]);
    }
  }
}

async function autoQualifyLead(sendNotification, lead, dueAt) {
  const db = await openDb();
  try {
    await db.run('BEGIN TRANSACTION');

    const result = await db.run(`
      UPDATE lead_submissions
      SET status = 'qualified', qualified_at = datetime('now')
      WHERE id = ? AND status = 'hired'
    `, [lead.id]);

    if (Number(result?.changes || 0) === 0) {
      await db.run('ROLLBACK');
      return false;
    }

    await createFinancialRecordsForQualifiedLead(db, lead);

    await db.run(`
      INSERT INTO lead_status_history (id, lead_id, from_status, to_status, changed_by_role, changed_by_id, reason)
      VALUES (?, ?, 'hired', 'qualified', 'system', 'lead_sla_engine', ?)
    `, [generateCode('HST'), lead.id, `Auto qualified after ${lead.qualification_days || 7} days without company dispute`]);

    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'lead', ?, 'auto_qualified_sla', 'system', 'lead_sla_engine', ?)
    `, [generateCode('AUD'), lead.id, JSON.stringify({ due_at: toSqlDate(dueAt), campaign_id: lead.campaign_id })]);

    await recordSlaEvent(db, lead, 'auto_qualified', dueAt, { qualification_days: lead.qualification_days || 7 });

    await db.run('COMMIT');
  } catch (error) {
    try {
      await db.run('ROLLBACK');
    } catch {
      // Ignore rollback errors.
    }
    throw error;
  } finally {
    await db.close();
  }

  await sendNotification({
    role: 'admin',
    title: 'Lead tự động đủ điều kiện',
    message: `Lead ${lead.lead_code} đã tự động chuyển đủ điều kiện sau ${lead.qualification_days || 7} ngày.`,
    url: '/admin/console',
    data: { event: 'lead_auto_qualified', lead_id: lead.id, lead_code: lead.lead_code },
  });

  if (lead.company_clerk_user_id) {
    await sendNotification({
      clerkUserId: lead.company_clerk_user_id,
      title: 'Lead đã đủ điều kiện',
      message: `Lead ${lead.lead_code} đã đủ điều kiện theo số ngày của chiến dịch.`,
      url: '/company/leads',
      data: { event: 'lead_auto_qualified_company', lead_id: lead.id, lead_code: lead.lead_code },
    });
  }

  if (lead.ctv_clerk_user_id) {
    await sendNotification({
      clerkUserId: lead.ctv_clerk_user_id,
      title: 'Lead thành công! 💰',
      message: `Ứng viên của bạn trong chiến dịch "${lead.campaign_title}" đã đủ điều kiện. Hoa hồng đã được ghi nhận.`,
      url: '/ctv/commissions',
      data: { event: 'lead_auto_qualified_ctv', lead_id: lead.id, lead_code: lead.lead_code },
    });
  }

  return true;
}

async function autoReclaimOverdueLead(sendNotification, lead, dueAt) {
  if (!AUTO_RECLAIM_ENABLED || !Number(lead.sla_auto_reclaim_enabled || 0)) return false;
  if (!['approved', 'claimed', 'interviewing'].includes(lead.status)) return false;

  const db = await openDb();
  try {
    await db.run('BEGIN TRANSACTION');
    const result = await db.run(`
      UPDATE lead_submissions
      SET status = 'disputed', rejected_reason = COALESCE(rejected_reason, ?)
      WHERE id = ? AND status = ?
    `, ['SLA overdue: auto reclaim disabled lead requires admin review', lead.id, lead.status]);

    if (Number(result?.changes || 0) === 0) {
      await db.run('ROLLBACK');
      return false;
    }

    await db.run(`
      INSERT INTO lead_status_history (id, lead_id, from_status, to_status, changed_by_role, changed_by_id, reason)
      VALUES (?, ?, ?, 'disputed', 'system', 'lead_sla_engine', ?)
    `, [generateCode('HST'), lead.id, lead.status, `Auto reclaim after SLA overdue at ${toSqlDate(dueAt)}`]);

    await db.run(`
      INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
      VALUES (?, 'lead', ?, 'auto_reclaim_sla', 'system', 'lead_sla_engine', ?)
    `, [generateCode('AUD'), lead.id, JSON.stringify({ from: lead.status, due_at: toSqlDate(dueAt), campaign_id: lead.campaign_id })]);

    await recordSlaEvent(db, lead, 'auto_reclaimed', dueAt, { previous_status: lead.status });
    await db.run('COMMIT');
  } catch (error) {
    try { await db.run('ROLLBACK'); } catch {}
    throw error;
  } finally {
    await db.close();
  }

  await sendNotification({
    role: 'admin',
    title: 'Lead đã tự thu hồi chờ xử lý',
    message: `Lead ${lead.lead_code} quá hạn SLA và đã chuyển sang chờ admin xử lý.`,
    url: '/admin/console',
    data: { event: 'lead_auto_reclaimed', lead_id: lead.id, lead_code: lead.lead_code, status: lead.status },
  });
  return true;
}

async function runLeadSlaEngineOnce(sendNotification) {
  await ensureLeadSlaSchema();
  await processMilestoneNotifications(sendNotification);

  const db = await openDb();
  let leads = [];
  try {
    leads = await getActiveSlaLeads(db);
  } finally {
    await db.close();
  }

  const now = new Date();

  for (const lead of leads) {
    const dueAt = getDueDate(lead);
    if (!dueAt) continue;

    const reminderAt = getReminderDate(lead, dueAt);

    if (lead.status === 'hired' && now >= dueAt) {
      try {
        await autoQualifyLead(sendNotification, lead, dueAt);
      } catch (error) {
        console.warn('[LeadSLA] Auto qualify failed:', lead.lead_code, error.message);
      }
      continue;
    }

    const eventDb = await openDb();
    try {
      if (now >= reminderAt && now < dueAt) {
        const shouldNotify = await recordSlaEvent(eventDb, lead, 'reminder', dueAt, { reminder_at: toSqlDate(reminderAt) });
        if (shouldNotify) await notifySlaReminder(sendNotification, lead, dueAt);
      }

      if (lead.status !== 'hired' && now >= dueAt) {
        const shouldNotify = await recordSlaEvent(eventDb, lead, 'overdue', dueAt, {});
        if (shouldNotify) await notifySlaOverdue(sendNotification, lead, dueAt);
        if (shouldNotify) {
          try {
            await autoReclaimOverdueLead(sendNotification, lead, dueAt);
          } catch (error) {
            console.warn('[LeadSLA] Auto reclaim failed:', lead.lead_code, error.message);
          }
        }
      }
    } catch (error) {
      console.warn('[LeadSLA] Notification pass failed:', lead.lead_code, error.message);
    } finally {
      await eventDb.close();
    }
  }
}

export function startLeadSlaEngine({ sendNotification }) {
  if (started) return;
  started = true;

  if (!ENGINE_ENABLED) {
    console.log('[LeadSLA] Engine disabled by LEAD_SLA_ENGINE_ENABLED=false');
    return;
  }

  const run = async () => {
    if (running) return;
    running = true;
    try {
      await runLeadSlaEngineOnce(sendNotification);
    } catch (error) {
      console.warn('[LeadSLA] Engine run failed:', error.message);
    } finally {
      running = false;
    }
  };

  setTimeout(run, 15_000);
  setInterval(run, Math.max(15_000, ENGINE_INTERVAL_MS));
  console.log(`[LeadSLA] Engine scheduled every ${Math.max(15_000, ENGINE_INTERVAL_MS)}ms`);
  if (AUTO_RECLAIM_ENABLED) {
    console.log('[LeadSLA] Auto reclaim switch is ON. Campaign-level sla_auto_reclaim_enabled must also be 1.');
  }
}
