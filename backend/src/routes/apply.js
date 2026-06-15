import { Router } from 'express';
import { z } from 'zod';
import { saveApplication, updateTelegramStatus, openDb } from '../database.js';
import { sendApplicationToTelegram } from '../telegram.js';
import { sendNotification } from '../utils/notification.js';

const router = Router();

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

async function notifyAdminNewLead({ leadId, leadCode, campaign, application, candidate, data, normalizedPhone }) {
  try {
    const companyName = campaign?.company_name || campaign?.companyName || data.companyCode;
    const jobTitle = data.jobTitle || campaign?.title || 'Tin ứng tuyển mới';

    await sendNotification({
      role: 'admin',
      title: 'Lead mới từ website',
      message: `${data.fullName} (${data.phone}) vừa đăng ký ${jobTitle}`,
      url: '/admin/console?tab=Lead',
      data: {
        event: 'lead_created',
        lead_id: leadId,
        lead_code: leadCode,
        application_id: application.id,
        candidate_id: candidate?.id || null,
        candidate_name: data.fullName,
        candidate_phone: data.phone,
        normalized_phone: normalizedPhone,
        province: data.province,
        district: data.district,
        campaign_id: campaign?.id || null,
        campaign_title: jobTitle,
        company_code: data.companyCode,
        company_name: companyName,
        source: 'public_apply_form',
      },
    });
  } catch (error) {
    console.warn('[Apply] Failed to notify admin about new lead:', error.message);
  }
}

// Validation schema
const applySchema = z.object({
  fullName: z.string().min(2, 'Họ tên ít nhất 2 ký tự').max(100),
  phone: z.string().regex(/^[0-9\-\+\s]{9,15}$/, 'Số điện thoại không hợp lệ'),
  province: z.string().min(2, 'Tỉnh/Thành phố không được để trống').max(100),
  district: z.string().min(2, 'Quận/Huyện không được để trống').max(100),
  note: z.string().max(500).optional(),
  jobId: z.string().optional(),
  jobSlug: z.string().optional(),
  jobTitle: z.string().optional(),
  companyCode: z.string().min(1, 'Thiếu mã công ty'),
  targetCode: z.string().min(1, 'Thiếu mã mục tiêu')
});

// POST /api/apply
router.post('/', async (req, res) => {
  try {
    // Validate input
    const validation = applySchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: validation.error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    
    const data = validation.data;
    data.area = `${data.district}, ${data.province}`;
    
    // Save to database
    const application = await saveApplication(data);
    
    // Bridge to lead_submissions for admin queue
    try {
      const db = await openDb();
      const normalizedPhone = normalizePhone(data.phone);
      
      // CHECK PHONE_LOCKS: Prevent duplicate leads for same phone + campaign
      const existingLock = await db.get(`
        SELECT pl.*, ls.status, ls.lead_code
        FROM phone_locks pl
        JOIN lead_submissions ls ON pl.lead_id = ls.id
        WHERE pl.normalized_phone = ?
        AND datetime(ls.submitted_at) > datetime('now', '-30 days')
        ORDER BY datetime(ls.submitted_at) DESC
        LIMIT 1
      `, normalizedPhone);

      if (existingLock) {
        await db.close();
        return res.status(409).json({
          success: false,
          error: 'DUPLICATE_PHONE',
          message: 'Số điện thoại này đã được sử dụng trong 30 ngày qua',
          existing_lead_code: existingLock.lead_code,
          hint: 'Mỗi số điện thoại chỉ được nộp đơn 1 lần trong 30 ngày'
        });
      }

      // Get or create candidate
      let candidate = await db.get('SELECT * FROM candidates WHERE normalized_phone = ?', normalizedPhone);
      if (!candidate) {
        const candidateId = 'cand-' + Date.now();
        await db.run(`
          INSERT INTO candidates (
            id, name, phone, normalized_phone, province, district, note, consent_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'granted')
        `, [candidateId, data.fullName, data.phone, normalizedPhone, data.province, data.district, data.note || null]);
        candidate = { id: candidateId };
      }

      // Get or create public_apply campaign for this company
      let campaign = await db.get(`
        SELECT c.*, comp.name AS company_name, comp.company_code
        FROM campaigns c
        JOIN companies comp ON c.company_id = comp.id
        WHERE c.company_id = (SELECT id FROM companies WHERE company_code = ?)
        AND c.visibility = 'public_candidate'
        LIMIT 1
      `, data.companyCode);
      
      if (!campaign) {
        const company = await db.get('SELECT * FROM companies WHERE company_code = ?', data.companyCode);
        if (company) {
          const campaignId = 'CAM-public-' + Date.now();
          const now = new Date().toISOString();
          await db.run(`
            INSERT INTO campaigns (
              id, campaign_code, company_id, title, visibility, bounty_amount, 
              ctv_reward_amount, platform_fee_amount, status, created_at, updated_at
            ) VALUES (?, ?, ?, 'Public Web Applications', 'public_candidate', 0, 0, 0, 'active', ?, ?)
          `, [campaignId, generateCode('CMP'), company.id, now, now]);
          campaign = {
            id: campaignId,
            title: 'Public Web Applications',
            company_id: company.id,
            company_name: company.name,
            company_code: company.company_code,
          };
        }
      }
      
      // Create lead_submissions record for admin queue
      if (campaign) {
        const leadId = 'lead-' + Date.now();
        const leadCode = generateCode('LED');
        const now = new Date().toISOString();
        
        await db.run(`
          INSERT INTO lead_submissions (
            id, lead_code, campaign_id, candidate_id,
            source_type, owner_type, assignment_method,
            status, submitted_at, source_metadata, is_anonymous
          ) VALUES (?, ?, ?, ?, 'organic_web', 'admin_pool', 'public_apply', 'submitted', ?, ?, 1)
        `, [
          leadId, 
          leadCode, 
          campaign.id, 
          candidate.id,
          now,
          JSON.stringify({ application_id: application.id, source: 'web_public_apply' })
        ]);
        
        // Create status history
        await db.run(`
          INSERT INTO lead_status_history (id, lead_id, from_status, to_status, reason, created_at)
          VALUES (?, ?, 'new', 'submitted', 'Submitted via public form', ?)
        `, [generateCode('HST'), leadId, now]);

        // Create phone lock to prevent duplicates
        await db.run(`
          INSERT INTO phone_locks (id, normalized_phone, campaign_id, lead_id, expires_at)
          VALUES (?, ?, ?, ?, datetime('now', '+30 days'))
        `, [generateCode('LCK'), normalizedPhone, campaign.id, leadId]);

        // AUDIT LOG: Record lead submission
        await db.run(`
          INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_role, actor_id, details)
          VALUES (?, 'lead', ?, 'submitted', 'candidate', ?, ?)
        `, [
          generateCode('AUD'),
          leadId,
          candidate.id,
          JSON.stringify({
            campaign_id: campaign.id,
            company_code: data.companyCode,
            phone: normalizedPhone,
            source: 'public_apply_form',
            owner_type: 'admin_pool',
            application_id: application.id
          })
        ]);

        await notifyAdminNewLead({ leadId, leadCode, campaign, application, candidate, data, normalizedPhone });
      }

      await db.close();
    } catch (error) {
      console.error('Warning: Failed to bridge to lead_submissions:', error.message);
      // Don't fail the response if bridge fails
    }
    
    // Send to Telegram
    const telegramResult = await sendApplicationToTelegram(application);
    
    // Determine telegram status
    const telegramSent = telegramResult.sent === true;
    const telegramSkipped = telegramResult.skipped === true;
    const telegramError = telegramSkipped 
      ? 'TELEGRAM_NOT_CONFIGURED' 
      : (telegramResult.error || null);
    
    // Update Telegram status in DB
    await updateTelegramStatus(
      application.id,
      telegramSent,
      telegramError
    );
    
    // Build response
    const response = {
      success: true,
      message: 'Đã ghi nhận thông tin. Bộ phận tuyển dụng sẽ liên hệ sớm.',
      data: {
        applicationId: application.id,
        telegramSent: telegramSent,
        telegramChannel: telegramResult.channel || null
      }
    };
    
    // Add warning if Telegram not configured
    if (telegramSkipped) {
      response.telegramWarning = 'Telegram chưa được cấu hình';
    }
    
    res.status(201).json(response);
    
  } catch (error) {
    console.error('Apply API error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống, vui lòng thử lại sau'
    });
  }
});

// GET /api/apply/stats (for dashboard)
router.get('/stats', async (req, res) => {
  try {
    const { getApplicationStats } = await import('../database.js');
    const stats = await getApplicationStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Stats API error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống'
    });
  }
});

export default router;