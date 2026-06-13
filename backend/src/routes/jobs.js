/**
 * Job Detail API Route
 * GET /api/jobs/:id - Lấy chi tiết job theo ID hoặc campaign_code
 */

import { Router } from 'express';
import { openDb } from '../database.js';

const router = Router();

// GET /api/jobs/:id - Get job detail by ID or campaign_code
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await openDb();
    
        const job = await db.get(`
      SELECT 
        c.id, c.campaign_code, c.title, c.job_type, c.location, c.province, c.district,
        c.salary_text, c.shift_text, c.quantity_needed, c.updated_at,
        c.description, c.requirements, c.benefits,
        comp.name as company_name, comp.company_code
      FROM campaigns c
      JOIN companies comp ON c.company_id = comp.id
      WHERE (LOWER(c.id) = LOWER(?) OR LOWER(c.campaign_code) = LOWER(?))
        AND c.status = 'active' 
        AND c.is_public = 1
    `, [id, id]);
    
    await db.close();
    
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    
    res.json({ success: true, data: job });
  } catch (error) {
    console.error('Fetch job detail failed:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
