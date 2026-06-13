import { Router } from 'express';
import { z } from 'zod';
import { saveApplication, updateTelegramStatus } from '../database.js';
import { sendApplicationToTelegram } from '../telegram.js';

const router = Router();

// Validation schema
const applySchema = z.object({
  fullName: z.string().min(2, 'Họ tên ít nhất 2 ký tự').max(100),
  phone: z.string().regex(/^[0-9\-\+\s]{9,15}$/, 'Số điện thoại không hợp lệ'),
  area: z.string().min(2, 'Khu vực không được để trống').max(100),
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
    
    // Save to database
    const application = await saveApplication(data);
    
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
