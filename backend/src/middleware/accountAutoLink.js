import { openDb } from '../database.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function claimMissingClerkLink(db, table, clerkUserId, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const linked = await db.get(`SELECT id FROM ${table} WHERE clerk_user_id = ? LIMIT 1`, [clerkUserId]);
  if (linked) return linked;

  const claimable = await db.get(
    `SELECT id FROM ${table}
     WHERE LOWER(TRIM(email)) = ?
       AND (clerk_user_id IS NULL OR TRIM(clerk_user_id) = '')
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalizedEmail]
  );

  if (!claimable) return null;

  await db.run(
    `UPDATE ${table}
     SET clerk_user_id = ?, updated_at = datetime('now')
     WHERE id = ? AND (clerk_user_id IS NULL OR TRIM(clerk_user_id) = '')`,
    [clerkUserId, claimable.id]
  );

  return claimable;
}

export async function accountAutoLink(req, res, next) {
  const clerkUserId = req.user?.clerkUserId;
  const email = normalizeEmail(req.user?.email);

  if (!clerkUserId || !email) return next();

  let db;
  try {
    db = await openDb();
    await claimMissingClerkLink(db, 'ctv_accounts', clerkUserId, email);
    await claimMissingClerkLink(db, 'companies', clerkUserId, email);
  } catch (error) {
    console.error('Account auto-link by email failed:', error);
  } finally {
    try { await db?.close?.(); } catch {}
  }

  return next();
}
