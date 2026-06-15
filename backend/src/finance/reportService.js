import crypto from 'crypto';
import { openDb } from '../database.js';
import { initFinanceSchema } from './schema.js';

async function withFinanceDb(fn) {
  const db = await openDb();
  try {
    await initFinanceSchema(db);
    return await fn(db);
  } finally {
    await db.close();
  }
}

async function getNumber(db, sql, params = []) {
  const row = await db.get(sql, params);
  return Number(row?.total || row?.count || 0);
}

export async function getAdminFinanceOverview() {
  return withFinanceDb(async (db) => {
    const totalRevenue = await getNumber(db, `SELECT COALESCE(SUM(amount), 0) AS total FROM job_orders WHERE status = 'paid'`);
    const paidJobOrders = await getNumber(db, `SELECT COUNT(*) AS count FROM job_orders WHERE status = 'paid'`);
    const pendingJobOrders = await getNumber(db, `SELECT COUNT(*) AS count FROM job_orders WHERE status = 'pending'`);
    const commissionPending = await getNumber(db, `SELECT COALESCE(SUM(amount), 0) AS total FROM ctv_commissions WHERE status = 'pending'`);
    const commissionApproved = await getNumber(db, `SELECT COALESCE(SUM(amount), 0) AS total FROM ctv_commissions WHERE status IN ('approved', 'paid')`);
    const withdrawalPending = await getNumber(db, `SELECT COALESCE(SUM(amount), 0) AS total FROM withdrawal_requests WHERE status IN ('pending', 'approved', 'processing')`);
    const withdrawalPaid = await getNumber(db, `SELECT COALESCE(SUM(amount), 0) AS total FROM withdrawal_requests WHERE status = 'paid'`);
    const walletAvailable = await getNumber(db, `SELECT COALESCE(SUM(available_balance), 0) AS total FROM users_wallet`);
    const walletPending = await getNumber(db, `SELECT COALESCE(SUM(pending_balance), 0) AS total FROM users_wallet`);
    const openAlerts = await getNumber(db, `SELECT COUNT(*) AS count FROM finance_alerts WHERE status = 'open'`);
    const latestReconciliation = await db.get(`SELECT * FROM reconciliation_runs ORDER BY created_at DESC LIMIT 1`);

    return {
      currency: 'VND',
      revenue: { totalRevenue, paidJobOrders, pendingJobOrders },
      commissions: { pendingAmount: commissionPending, approvedAmount: commissionApproved },
      withdrawals: { pendingAmount: withdrawalPending, paidAmount: withdrawalPaid },
      wallets: { totalAvailable: walletAvailable, totalPending: walletPending },
      alerts: { open: openAlerts },
      reconciliation: latestReconciliation || null,
    };
  });
}

function buildRunCode() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `REC${stamp}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function addReconciliationItem(db, runId, item) {
  await db.run(`
    INSERT INTO reconciliation_items
      (reconciliation_run_id, severity, item_type, entity_type, entity_id, expected_amount, actual_amount, note, payload)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    runId,
    item.severity || 'warning',
    item.itemType,
    item.entityType || null,
    item.entityId || null,
    item.expectedAmount ?? null,
    item.actualAmount ?? null,
    item.note || null,
    item.payload ? JSON.stringify(item.payload) : null,
  ]);
}

export async function runFinanceReconciliation({ periodStart, periodEnd, actorUserId } = {}) {
  return withFinanceDb(async (db) => {
    const now = new Date();
    const end = periodEnd || now.toISOString();
    const start = periodStart || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const runId = crypto.randomUUID();
    const runCode = buildRunCode();

    await db.run(`
      INSERT INTO reconciliation_runs (id, run_code, status, period_start, period_end, started_by)
      VALUES (?, ?, 'running', ?, ?, ?)
    `, [runId, runCode, start, end, actorUserId || null]);

    const items = [];

    const paidOrdersMissingLedger = await db.all(`
      SELECT jo.id, jo.amount, jo.order_code
      FROM job_orders jo
      LEFT JOIN financial_transactions ft
        ON ft.source_type = 'job_order' AND ft.source_id = jo.id AND ft.status = 'confirmed'
      WHERE jo.status = 'paid' AND ft.id IS NULL
    `);
    for (const row of paidOrdersMissingLedger) {
      items.push({
        severity: 'high',
        itemType: 'missing_ledger',
        entityType: 'job_order',
        entityId: row.id,
        expectedAmount: row.amount,
        actualAmount: 0,
        note: `Paid job order ${row.order_code || row.id} has no confirmed ledger transaction.`,
        payload: row,
      });
    }

    const commissionsMissingLedger = await db.all(`
      SELECT id, amount, ctv_id, status
      FROM ctv_commissions
      WHERE status IN ('approved', 'paid') AND ledger_transaction_id IS NULL
    `);
    for (const row of commissionsMissingLedger) {
      items.push({
        severity: 'high',
        itemType: 'missing_ledger',
        entityType: 'ctv_commission',
        entityId: row.id,
        expectedAmount: row.amount,
        actualAmount: 0,
        note: `Commission ${row.id} is ${row.status} but has no ledger transaction.`,
        payload: row,
      });
    }

    const withdrawalsMissingLedger = await db.all(`
      SELECT id, amount, user_id, status
      FROM withdrawal_requests
      WHERE status = 'paid' AND ledger_transaction_id IS NULL
    `);
    for (const row of withdrawalsMissingLedger) {
      items.push({
        severity: 'high',
        itemType: 'missing_ledger',
        entityType: 'withdrawal',
        entityId: row.id,
        expectedAmount: row.amount,
        actualAmount: 0,
        note: `Withdrawal ${row.id} is paid but has no debit ledger transaction.`,
        payload: row,
      });
    }

    const duplicateSources = await db.all(`
      SELECT source_type, source_id, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
      FROM financial_transactions
      WHERE source_type IS NOT NULL AND source_id IS NOT NULL
      GROUP BY source_type, source_id
      HAVING COUNT(*) > 1
    `);
    for (const row of duplicateSources) {
      items.push({
        severity: 'warning',
        itemType: 'duplicate_source',
        entityType: row.source_type,
        entityId: row.source_id,
        actualAmount: row.total,
        note: `Duplicate ledger source detected for ${row.source_type}:${row.source_id}.`,
        payload: row,
      });
    }

    await db.run('BEGIN IMMEDIATE TRANSACTION');
    try {
      for (const item of items) {
        await addReconciliationItem(db, runId, item);
      }

      const totalLedgerCredit = await getNumber(db, `SELECT COALESCE(SUM(amount), 0) AS total FROM financial_transactions WHERE type = 'credit' AND status = 'confirmed'`);
      const totalLedgerDebit = await getNumber(db, `SELECT COALESCE(SUM(amount), 0) AS total FROM financial_transactions WHERE type = 'debit' AND status = 'confirmed'`);
      const totalJobOrderPaid = await getNumber(db, `SELECT COALESCE(SUM(amount), 0) AS total FROM job_orders WHERE status = 'paid'`);
      const totalCommissionApproved = await getNumber(db, `SELECT COALESCE(SUM(amount), 0) AS total FROM ctv_commissions WHERE status IN ('approved', 'paid')`);
      const totalWithdrawalPaid = await getNumber(db, `SELECT COALESCE(SUM(amount), 0) AS total FROM withdrawal_requests WHERE status = 'paid'`);

      await db.run(`
        UPDATE reconciliation_runs
        SET status = 'completed', total_ledger_credit = ?, total_ledger_debit = ?,
            total_job_order_paid = ?, total_commission_approved = ?, total_withdrawal_paid = ?,
            mismatch_count = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [totalLedgerCredit, totalLedgerDebit, totalJobOrderPaid, totalCommissionApproved, totalWithdrawalPaid, items.length, runId]);

      await db.run('COMMIT');
    } catch (error) {
      await db.run('ROLLBACK');
      await db.run(`UPDATE reconciliation_runs SET status = 'failed', failed_at = CURRENT_TIMESTAMP, failure_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [error.message, runId]);
      throw error;
    }

    const run = await db.get('SELECT * FROM reconciliation_runs WHERE id = ?', runId);
    const runItems = await db.all('SELECT * FROM reconciliation_items WHERE reconciliation_run_id = ? ORDER BY id ASC', runId);
    return { run, items: runItems };
  });
}

export async function getLatestReconciliation() {
  return withFinanceDb(async (db) => {
    const run = await db.get('SELECT * FROM reconciliation_runs ORDER BY created_at DESC LIMIT 1');
    if (!run) return null;
    const items = await db.all('SELECT * FROM reconciliation_items WHERE reconciliation_run_id = ? ORDER BY id ASC', run.id);
    return { run, items };
  });
}
