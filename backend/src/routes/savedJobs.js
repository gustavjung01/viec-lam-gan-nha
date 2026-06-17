import express from 'express';
import { userAuth } from '../middleware/userAuth.js';
import { openDb } from '../database.js';

const router = express.Router();

function generateId() {
  return `sav-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function normalizeJobKey(value) {
  return String(value || '').trim();
}

function savedJobPayload(row) {
  if (!row) return null;
  return {
    id: row.id,
    jobId: row.job_id,
    jobSlug: row.job_slug,
    jobTitle: row.job_title,
    companyCode: row.company_code,
    province: row.province,
    district: row.district,
    salaryText: row.salary_text,
    savedAt: row.created_at,
  };
}

async function ensureSavedJobsTable(db) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS saved_jobs (
      id TEXT PRIMARY KEY,
      clerk_user_id TEXT NOT NULL,
      job_id TEXT,
      job_slug TEXT,
      job_title TEXT,
      company_code TEXT,
      province TEXT,
      district TEXT,
      salary_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(clerk_user_id, job_id)
    )
  `);
  await db.run('CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_created ON saved_jobs(clerk_user_id, created_at)');
  await db.run('CREATE INDEX IF NOT EXISTS idx_saved_jobs_user_slug ON saved_jobs(clerk_user_id, job_slug)');
}

router.use(userAuth);

router.get('/saved-jobs', async (req, res) => {
  let db;
  try {
    db = await openDb();
    await ensureSavedJobsTable(db);
    const rows = await db.all(`
      SELECT *
      FROM saved_jobs
      WHERE clerk_user_id = ?
      ORDER BY datetime(created_at) DESC, id DESC
    `, [req.user.clerkUserId]);
    await db.close();
    db = null;
    res.json({ success: true, data: rows.map(savedJobPayload) });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('List saved jobs failed:', error);
    res.json({ success: true, data: [], warning: 'SAVED_JOBS_UNAVAILABLE' });
  }
});

router.get('/saved-jobs/:jobKey', async (req, res) => {
  let db;
  try {
    const jobKey = normalizeJobKey(req.params.jobKey);
    if (!jobKey) return res.status(400).json({ success: false, error: 'MISSING_JOB_ID' });
    db = await openDb();
    await ensureSavedJobsTable(db);
    const row = await db.get(`
      SELECT *
      FROM saved_jobs
      WHERE clerk_user_id = ? AND (job_id = ? OR job_slug = ?)
      LIMIT 1
    `, [req.user.clerkUserId, jobKey, jobKey]);
    await db.close();
    db = null;
    res.json({ success: true, data: savedJobPayload(row), saved: Boolean(row) });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Get saved job failed:', error);
    res.json({ success: true, data: null, saved: false, warning: 'SAVED_JOB_STATUS_UNAVAILABLE' });
  }
});

router.post('/saved-jobs', async (req, res) => {
  let db;
  try {
    const jobId = normalizeJobKey(req.body?.jobId || req.body?.id || req.body?.job_id || req.body?.slug || req.body?.jobSlug);
    const jobSlug = normalizeJobKey(req.body?.jobSlug || req.body?.job_slug || req.body?.slug || jobId);
    if (!jobId && !jobSlug) return res.status(400).json({ success: false, error: 'MISSING_JOB_ID' });

    db = await openDb();
    await ensureSavedJobsTable(db);

    const existing = await db.get(`
      SELECT *
      FROM saved_jobs
      WHERE clerk_user_id = ? AND (job_id = ? OR job_slug = ?)
      LIMIT 1
    `, [req.user.clerkUserId, jobId || jobSlug, jobSlug || jobId]);

    if (existing) {
      await db.run(`
        UPDATE saved_jobs
        SET job_title = COALESCE(?, job_title),
            company_code = COALESCE(?, company_code),
            province = COALESCE(?, province),
            district = COALESCE(?, district),
            salary_text = COALESCE(?, salary_text),
            updated_at = datetime('now')
        WHERE id = ?
      `, [
        req.body?.jobTitle || req.body?.title || null,
        req.body?.companyCode || req.body?.company_code || null,
        req.body?.province || null,
        req.body?.district || null,
        req.body?.salaryText || req.body?.salary || null,
        existing.id,
      ]);
      const updated = await db.get('SELECT * FROM saved_jobs WHERE id = ?', [existing.id]);
      await db.close();
      db = null;
      return res.json({ success: true, data: savedJobPayload(updated), saved: true, alreadySaved: true });
    }

    const id = generateId();
    await db.run(`
      INSERT INTO saved_jobs (
        id, clerk_user_id, job_id, job_slug, job_title, company_code, province, district, salary_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      req.user.clerkUserId,
      jobId || jobSlug,
      jobSlug || jobId,
      req.body?.jobTitle || req.body?.title || null,
      req.body?.companyCode || req.body?.company_code || null,
      req.body?.province || null,
      req.body?.district || null,
      req.body?.salaryText || req.body?.salary || null,
    ]);

    const row = await db.get('SELECT * FROM saved_jobs WHERE id = ?', [id]);
    await db.close();
    db = null;
    res.status(201).json({ success: true, data: savedJobPayload(row), saved: true, alreadySaved: false });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Save job failed:', error);
    res.status(500).json({ success: false, error: error.message || 'SAVE_JOB_FAILED' });
  }
});

async function removeSavedJob(req, res) {
  let db;
  try {
    const jobKey = normalizeJobKey(req.params.jobKey || req.body?.jobId || req.body?.jobSlug || req.body?.id);
    if (!jobKey) return res.status(400).json({ success: false, error: 'MISSING_JOB_ID' });
    db = await openDb();
    await ensureSavedJobsTable(db);
    const result = await db.run(`
      DELETE FROM saved_jobs
      WHERE clerk_user_id = ? AND (job_id = ? OR job_slug = ?)
    `, [req.user.clerkUserId, jobKey, jobKey]);
    await db.close();
    db = null;
    res.json({ success: true, saved: false, deletedCount: Number(result?.changes || 0) });
  } catch (error) {
    try { await db?.close?.(); } catch {}
    console.error('Remove saved job failed:', error);
    res.status(500).json({ success: false, error: error.message || 'REMOVE_SAVED_JOB_FAILED' });
  }
}

router.post('/saved-jobs/:jobKey/remove', removeSavedJob);
router.delete('/saved-jobs/:jobKey', removeSavedJob);

export default router;
