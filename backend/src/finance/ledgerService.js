import { openDb } from '../database.js';
import { initFinanceSchema } from './schema.js';

function toPositiveInt(value, fieldName = 'amount') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    const err = new Error(`${fieldName} must be a positive integer`);
    err.statusCode = 400;
    throw err;
  }
  return n;
}

function normalizeType(type) {
  const value = String(type || '').trim().toLowerCase();
  if (!['credit', 'debit'].includes(value)) {
    const err = new Error('type must be credit or debit');
    err.statusCode = 400;
    throw err;
  }
  return value;
}

function normalizeStatus(status = 'pending') {
  const value = String(status || 'pending').trim().toLowerCase();
  if (!['pending', 'confirmed', 'cancelled', 'failed', 'rejected'].includes(value)) {
    const err = new Error('invalid transaction status');
    err.statusCode = 400;
    throw err;
  }
  return value;
}

function stringifyMeta(meta) {
  if (meta === undefined || meta === null) return null;
  if (typeof meta === 'string') return meta;
  return JSON.stringify(meta);
}

function parseMeta(row) {
  if (!row) return row;
  if (!row.meta) return row;
  try {
    return { ...row, meta: JSON.parse(row.meta) };
  } catch {
    return row;
  }
}

async function withFinanceDb(fn) {
  const db = await openDb();
  try {
    await initFinanceSchema(db);
    return await fn(db);
  } finally {
    await db.close();
  }
}

export async function ensureWallet(db, userId) {
  const safeUserId = String(userId || '').trim();
  if (!safeUserId) {
    const err = new Error('userId is required');
    err.statusCode = 400;
    throw err;
  }

  await db.run(`
    INSERT OR IGNORE INTO users_wallet (user_id, available_balance, pending_balance)
    VALUES (?, 0, 0)
  `, safeUserId);

  return db.get('SELECT * FROM users_wallet WHERE user_id = ?', safeUserId);
}

export async function syncWalletBalance(db, userId) {
  await ensureWallet(db, userId);

  const confirmedCredit = await db.get(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM financial_transactions
    WHERE user_id = ? AND type = 'credit' AND status = 'confirmed'
  `, userId);

  const confirmedDebit = await db.get(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM financial_transactions
    WHERE user_id = ? AND type = 'debit' AND status = 'confirmed'
  `, userId);

  const pendingCredit = await db.get(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM financial_transactions
    WHERE user_id = ? AND type = 'credit' AND status = 'pending'
  `, userId);

  const pendingDebit = await db.get(`
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM financial_transactions
    WHERE user_id = ? AND type = 'debit' AND status = 'pending'
  `, userId);

  const availableBalance = Number(confirmedCredit.total || 0) - Number(confirmedDebit.total || 0);
  const pendingBalance = Number(pendingCredit.total || 0) - Number(pendingDebit.total || 0);

  await db.run(`
    UPDATE users_wallet
    SET available_balance = ?, pending_balance = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `, [availableBalance, pendingBalance, userId]);

  return db.get('SELECT * FROM users_wallet WHERE user_id = ?', userId);
}

export async function getWalletBalance(userId) {
  return withFinanceDb(async (db) => syncWalletBalance(db, String(userId || '').trim()));
}

export async function getTransactionById(id) {
  return withFinanceDb(async (db) => {
    const row = await db.get('SELECT * FROM financial_transactions WHERE id = ?', id);
    return parseMeta(row);
  });
}

export async function findTransactionBySource(sourceType, sourceId) {
  return withFinanceDb(async (db) => {
    const row = await db.get(`
      SELECT * FROM financial_transactions
      WHERE source_type = ? AND source_id = ?
      LIMIT 1
    `, [sourceType, sourceId]);
    return parseMeta(row);
  });
}

export async function listTransactions(userId, { limit = 50, offset = 0 } = {}) {
  return withFinanceDb(async (db) => {
    await ensureWallet(db, userId);
    const rows = await db.all(`
      SELECT * FROM financial_transactions
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `, [userId, Math.min(Number(limit) || 50, 200), Math.max(Number(offset) || 0, 0)]);
    return rows.map(parseMeta);
  });
}

export async function createTransaction(input) {
  const userId = String(input?.userId || input?.user_id || '').trim();
  const type = normalizeType(input?.type);
  const amount = toPositiveInt(input?.amount);
  const status = normalizeStatus(input?.status || 'pending');
  const sourceType = input?.sourceType || input?.source_type || null;
  const sourceId = input?.sourceId || input?.source_id || null;
  const meta = stringifyMeta(input?.meta);

  return withFinanceDb(async (db) => {
    await db.run('BEGIN IMMEDIATE TRANSACTION');
    try {
      await ensureWallet(db, userId);

      if (sourceType && sourceId) {
        const existing = await db.get(`
          SELECT * FROM financial_transactions
          WHERE source_type = ? AND source_id = ?
          LIMIT 1
        `, [sourceType, sourceId]);
        if (existing) {
          await db.run('COMMIT');
          return parseMeta(existing);
        }
      }

      const result = await db.run(`
        INSERT INTO financial_transactions
          (user_id, type, amount, status, source_type, source_id, meta, confirmed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'confirmed' THEN CURRENT_TIMESTAMP ELSE NULL END)
      `, [userId, type, amount, status, sourceType, sourceId, meta, status]);

      await syncWalletBalance(db, userId);
      await db.run('COMMIT');

      const row = await db.get('SELECT * FROM financial_transactions WHERE id = ?', result.lastID);
      return parseMeta(row);
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  });
}

export async function confirmTransaction(id) {
  return withFinanceDb(async (db) => {
    await db.run('BEGIN IMMEDIATE TRANSACTION');
    try {
      const tx = await db.get('SELECT * FROM financial_transactions WHERE id = ?', id);
      if (!tx) {
        await db.run('ROLLBACK');
        return null;
      }
      if (tx.status !== 'confirmed') {
        await db.run(`
          UPDATE financial_transactions
          SET status = 'confirmed', confirmed_at = COALESCE(confirmed_at, CURRENT_TIMESTAMP)
          WHERE id = ?
        `, id);
      }
      await syncWalletBalance(db, tx.user_id);
      await db.run('COMMIT');
      const row = await db.get('SELECT * FROM financial_transactions WHERE id = ?', id);
      return parseMeta(row);
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  });
}

export async function cancelTransaction(id) {
  return withFinanceDb(async (db) => {
    await db.run('BEGIN IMMEDIATE TRANSACTION');
    try {
      const tx = await db.get('SELECT * FROM financial_transactions WHERE id = ?', id);
      if (!tx) {
        await db.run('ROLLBACK');
        return null;
      }
      if (tx.status === 'confirmed') {
        const err = new Error('confirmed transaction cannot be cancelled');
        err.statusCode = 409;
        throw err;
      }
      await db.run(`
        UPDATE financial_transactions
        SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, id);
      await syncWalletBalance(db, tx.user_id);
      await db.run('COMMIT');
      const row = await db.get('SELECT * FROM financial_transactions WHERE id = ?', id);
      return parseMeta(row);
    } catch (error) {
      await db.run('ROLLBACK');
      throw error;
    }
  });
}

export async function initializeFinance() {
  return withFinanceDb(async (db) => {
    const tables = await db.all(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name IN (
        'users_wallet', 'financial_transactions', 'finance_packages', 'job_orders',
        'ctv_referrals', 'ctv_commissions', 'withdrawal_requests', 'finance_alerts'
      )
      ORDER BY name
    `);
    return { ok: true, tables: tables.map(row => row.name) };
  });
}
