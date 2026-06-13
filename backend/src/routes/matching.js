// Matching API - Chatbot Phase 2
// Job matching endpoints for chatbot integration

import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { findMatchingJobs, quickMatch, calculateMatchScore } from '../utils/jobMatcher.js';
import { openDb } from '../database.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { getAiConfigsByType } from '../aiConfigs.js';

const router = Router();
let googleTokenCache = { fingerprint: null, accessToken: null, expiresAtMs: 0 };

function normalizeGeminiModel(model) {
  return String(model || '')
    .trim()
    .replace(/^models\//i, '')
    .replace(/^google\//i, '')
    .replace(/^publishers\/google\/models\//i, '')
    .replace(/^.*\/models\//i, '')
    .trim();
}

function extractGeminiText(data) {
  const candidates = data?.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];
    const text = parts.map((part) => part?.text || '').filter(Boolean).join('\n').trim();
    if (text) return text;
  }
  return '';
}

function safeJsonParse(value, fallback = {}) {
  try {
    return typeof value === 'string' ? JSON.parse(value || '{}') : (value || fallback);
  } catch {
    return fallback;
  }
}

function base64UrlEncodeJson(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function getAccessTokenFromServiceAccountJson(credentialsJson) {
  let credentials;
  try {
    credentials = typeof credentialsJson === 'string' ? JSON.parse(credentialsJson) : credentialsJson;
  } catch {
    throw new Error('Credentials JSON không hợp lệ.');
  }

  if (!credentials?.client_email || !credentials?.private_key) {
    throw new Error('Credentials JSON thiếu client_email hoặc private_key.');
  }

  const fingerprint = crypto
    .createHash('sha256')
    .update(`${credentials.client_email}::${credentials.private_key}::${credentials.token_uri || ''}`)
    .digest('hex');

  if (googleTokenCache.fingerprint === fingerprint && googleTokenCache.accessToken && Date.now() < googleTokenCache.expiresAtMs) {
    return googleTokenCache.accessToken;
  }

  const tokenUri = String(credentials.token_uri || 'https://oauth2.googleapis.com/token').trim();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: tokenUri,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };

  const unsignedJwt = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer
    .sign(credentials.private_key, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsignedJwt}.${signature}`,
    }).toString(),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Không lấy được Google access token (${response.status}): ${responseText.slice(0, 160)}`);
  }

  const data = safeJsonParse(responseText, {});
  if (!data?.access_token) throw new Error('Google token response thiếu access_token.');

  const expiresInMs = Math.max(60, Number(data.expires_in || 3600) - 60) * 1000;
  googleTokenCache = {
    fingerprint,
    accessToken: data.access_token,
    expiresAtMs: Date.now() + expiresInMs,
  };

  return data.access_token;
}

function extractProjectIdFromCredentialsJson(credentialsJson) {
  try {
    const parsed = typeof credentialsJson === 'string' ? JSON.parse(credentialsJson) : credentialsJson;
    return String(parsed?.project_id || '').trim();
  } catch {
    return '';
  }
}

function normalizeResourceId(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const parts = text.split('/').filter(Boolean);
  return (parts[parts.length - 1] || text).trim();
}

function getGoogleApiHost(service, location) {
  const loc = String(location || 'global').trim().toLowerCase() || 'global';
  return loc === 'global' ? `${service}.googleapis.com` : `${loc}-${service}.googleapis.com`;
}

function extractDialogflowReplyText(data) {
  const responseMessages = data?.queryResult?.responseMessages || data?.query_result?.responseMessages || [];
  const parts = [];

  for (const message of responseMessages) {
    const outputAudioText = message?.outputAudioText;
    const textFromOutputAudio = typeof outputAudioText?.text === 'string' ? outputAudioText.text.trim() : '';
    const ssmlFromOutputAudio = typeof outputAudioText?.ssml === 'string' ? outputAudioText.ssml.trim() : '';
    if (textFromOutputAudio || ssmlFromOutputAudio) {
      parts.push(textFromOutputAudio || ssmlFromOutputAudio);
      continue;
    }

    const textParts = message?.text?.text;
    if (Array.isArray(textParts)) {
      for (const part of textParts) {
        if (typeof part === 'string' && part.trim()) parts.push(part.trim());
      }
    }
  }

  return parts.join('\n').trim();
}

function buildLeadAnalysisPrompt(lead) {
  return `Bạn là trợ lý tuyển dụng nội bộ của VIECLAMGANNHA.ME.
Nhiệm vụ: phân tích nhanh lead/ứng viên dựa trên dữ liệu đang có để admin gọi điện sàng lọc.

Nguyên tắc bắt buộc:
- Không yêu cầu CCCD, OTP, mật khẩu, tài khoản ngân hàng.
- Không nhắc bounty, hoa hồng, platform fee, tỉ lệ 80/20.
- Không kết luận chắc chắn về pháp lý/hồ sơ khi dữ liệu chưa đủ.
- Trả lời ngắn, rõ, dùng tiếng Việt.

Dữ liệu lead:
- Mã lead: ${lead.lead_code || 'Không có'}
- Trạng thái hiện tại: ${lead.status || 'Không có'}
- Ứng viên: ${lead.candidate_name || 'Chưa có tên'}
- SĐT: ${lead.candidate_phone || 'Chưa có'}
- Zalo: ${lead.zalo_phone || 'Chưa có'}
- Năm sinh: ${lead.birth_year || 'Chưa có'}
- Khu vực ứng viên: ${[lead.candidate_district, lead.candidate_province].filter(Boolean).join(', ') || 'Chưa có'}
- Việc mong muốn: ${lead.desired_job || 'Chưa có'}
- Ca mong muốn: ${lead.desired_shift || 'Chưa có'}
- Ngày có thể đi làm: ${lead.available_date || 'Chưa có'}
- Ghi chú ứng viên: ${lead.candidate_note || lead.lead_note || 'Không có'}

Tin/campaign ứng tuyển:
- Tên việc: ${lead.campaign_title || 'Chưa có'}
- Loại việc: ${lead.job_type || 'Chưa có'}
- Công ty: ${lead.company_name || 'Chưa có'}
- Khu vực việc: ${[lead.campaign_district, lead.campaign_province].filter(Boolean).join(', ') || lead.location || 'Chưa có'}
- Lương: ${lead.salary_text || 'Chưa có'}
- Ca làm: ${lead.shift_text || 'Chưa có'}
- Mô tả: ${lead.description || 'Chưa có'}
- Yêu cầu: ${lead.requirements || 'Chưa có'}

Hãy trả lời đúng cấu trúc:
1) Mức phù hợp: Cao / Trung bình / Thấp
2) Lý do phù hợp:
- ...
3) Rủi ro hoặc thông tin còn thiếu:
- ...
4) Câu hỏi nên hỏi khi gọi ứng viên:
- ...
5) Gợi ý xử lý tiếp theo:
- ...`;
}

async function callConversationAgent(settings, prompt) {
  let accessToken = settings.authToken;
  const projectId = settings.projectId || extractProjectIdFromCredentialsJson(settings.credentialsJson);
  const loc = String(settings.location || 'global').trim().toLowerCase() || 'global';
  const agentId = normalizeResourceId(settings.agentId || settings.model || settings.engineId);
  const languageCode = String(settings.languageCode || 'vi').trim() || 'vi';

  if (settings.credentialsJson && String(settings.credentialsJson).trim().startsWith('{')) {
    accessToken = await getAccessTokenFromServiceAccountJson(settings.credentialsJson);
  }

  if (!accessToken) throw new Error('AI CV thiếu Credentials JSON hoặc Auth Token.');
  if (!projectId) throw new Error('AI CV thiếu Project ID.');
  if (!loc) throw new Error('AI CV thiếu Location.');
  if (!agentId) throw new Error('AI CV thiếu Agent ID.');

  const sessionId = crypto.randomUUID();
  const sessionPath = `projects/${projectId}/locations/${loc}/agents/${agentId}/sessions/${sessionId}`;
  const url = `https://${getGoogleApiHost('dialogflow', loc)}/v3/${sessionPath}:detectIntent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      queryInput: {
        text: { text: prompt },
        languageCode,
      },
    }),
  });

  const text = await response.text();
  const data = safeJsonParse(text, {});
  if (!response.ok) throw new Error(data?.error?.message || `Dialogflow CX Error (${response.status})`);

  const reply = extractDialogflowReplyText(data);
  return reply || 'Conversation Agent đã phản hồi nhưng chưa có text. Kiểm tra lại playbook/response trong agent.';
}

async function callCvAnalyzer(config, prompt) {
  const settings = safeJsonParse(config.config_json, {});
  const providerType = config.provider_type;
  const systemPrompt = settings.systemPrompt || 'Bạn là trợ lý tuyển dụng nội bộ, trả lời ngắn gọn và có cấu trúc.';

  if (providerType === 'gemini_api') {
    const model = normalizeGeminiModel(settings.model || 'gemini-2.0-flash');
    if (!settings.apiKey) throw new Error('AI CV chưa có apiKey');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${settings.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })
    });
    const text = await response.text();
    const data = safeJsonParse(text, {});
    if (!response.ok) throw new Error(data?.error?.message || 'Gemini API Error');
    return extractGeminiText(data) || 'AI không trả về nội dung phân tích.';
  }

  if (providerType === 'claude_api') {
    if (!settings.apiKey) throw new Error('AI CV chưa có apiKey');
    if (!settings.model) throw new Error('AI CV chưa có model');
    const baseUrl = String(settings.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      })
    });
    const text = await response.text();
    const data = safeJsonParse(text, {});
    if (!response.ok) throw new Error(data?.error?.message || 'OpenAI-compatible API Error');
    return data?.choices?.[0]?.message?.content || 'AI không trả về nội dung phân tích.';
  }

  if (providerType === 'dialogflow' || providerType === 'agent_builder' || settings.runtime === 'dialogflow_cx') {
    return await callConversationAgent(settings, prompt);
  }

  throw new Error(`Provider AI CV chưa hỗ trợ trong endpoint này: ${providerType || 'none'}`);
}

// Validation schema for match request
const matchRequestSchema = z.object({
  // Option 1: Candidate ID (if already registered)
  candidate_id: z.string().optional(),
  
  // Option 2: Full candidate data (for quick matching without registration)
  candidate_data: z.object({
    name: z.string().min(2),
    phone: z.string(),
    province: z.string().optional(),
    district: z.string().optional(),
    desired_job: z.string().optional(),
    desired_shift: z.string().optional(),
    experience_years: z.number().int().min(0).optional(),
    education_level: z.string().optional(),
    preferred_shift: z.enum(['morning', 'afternoon', 'night', 'flexible', 'full_day']).optional(),
    is_stay_in_possible: z.boolean().optional(),
    has_transport: z.boolean().optional(),
    available_date: z.string().optional()
  }).optional(),
  
  // Filters
  filters: z.object({
    province: z.string().optional(),
    jobType: z.string().optional(),
    minScore: z.number().int().min(0).max(100).optional()
  }).optional(),
  
  // Options
  limit: z.number().int().min(1).max(20).default(5),
  include_details: z.boolean().default(true)
}).refine(data => data.candidate_id || data.candidate_data, {
  message: 'Must provide either candidate_id or candidate_data'
});

/**
 * POST /api/admin/leads/:leadId/ai-analyze
 * Admin-only CV/lead analysis using the active cv_analyzer AI config.
 */
router.post('/admin/leads/:leadId/ai-analyze', adminAuth, async (req, res) => {
  let db;
  try {
    const { leadId } = req.params;
    db = await openDb();

    const lead = await db.get(`
      SELECT
        ls.id,
        ls.lead_code,
        ls.status,
        ls.submitted_at,
        ls.notes as lead_note,
        cd.name as candidate_name,
        cd.phone as candidate_phone,
        cd.zalo_phone,
        cd.birth_year,
        cd.province as candidate_province,
        cd.district as candidate_district,
        cd.desired_job,
        cd.desired_shift,
        cd.available_date,
        cd.note as candidate_note,
        c.title as campaign_title,
        c.job_type,
        c.location,
        c.province as campaign_province,
        c.district as campaign_district,
        c.salary_text,
        c.shift_text,
        c.description,
        c.requirements,
        co.name as company_name
      FROM lead_submissions ls
      LEFT JOIN candidates cd ON ls.candidate_id = cd.id
      LEFT JOIN campaigns c ON ls.campaign_id = c.id
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE ls.id = ? OR ls.lead_code = ?
    `, [leadId, leadId]);

    if (!lead) {
      await db.close();
      return res.status(404).json({ success: false, message: 'Không tìm thấy lead' });
    }

    const configs = await getAiConfigsByType('cv_analyzer');
    const activeConfig = configs.find((cfg) => cfg.status === 'active') || configs[0];

    if (!activeConfig || activeConfig.provider_type === 'none') {
      await db.close();
      return res.status(503).json({
        success: false,
        message: 'Chưa cấu hình AI phân tích CV/lead trong Admin AI Config.'
      });
    }

    const prompt = buildLeadAnalysisPrompt(lead);
    const analysis = await callCvAnalyzer(activeConfig, prompt);

    await db.close();
    return res.json({
      success: true,
      data: {
        lead_id: lead.id,
        lead_code: lead.lead_code,
        provider_type: activeConfig.provider_type,
        analysis
      }
    });
  } catch (error) {
    if (db) {
      try { await db.close(); } catch {}
    }
    const safeMessage = String(error.message || 'Không thể phân tích lead').replace(/[A-Za-z0-9_\-]{20,}/g, '[REDACTED]');
    console.error('Admin lead AI analysis error:', safeMessage);
    return res.status(500).json({ success: false, message: safeMessage });
  }
});

/**
 * POST /api/match-jobs
 * Main matching endpoint for chatbot
 * Returns ranked list of matching jobs with scores
 */
router.post('/match-jobs', async (req, res) => {
  try {
    const validation = matchRequestSchema.safeParse(req.body);
    
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

    const { candidate_id, candidate_data, filters, limit, include_details } = validation.data;

    // Determine candidate input
    let candidateInput;
    if (candidate_id) {
      // Verify candidate exists
      const db = await openDb();
      const candidate = await db.get('SELECT * FROM candidates WHERE id = ?', candidate_id);
      await db.close();
      
      if (!candidate) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy ứng viên'
        });
      }
      candidateInput = candidate_id;
    } else {
      candidateInput = candidate_data;
    }

    // Find matches
    const options = {
      ...filters,
      limit
    };

    const matches = await findMatchingJobs(candidateInput, options);

    // Format response
    const response = {
      success: true,
      data: {
        total_matches: matches.length,
        candidate_summary: {
          name: candidate_data?.name || (typeof candidateInput === 'object' ? candidateInput.name : undefined),
          province: candidate_data?.province || (typeof candidateInput === 'object' ? candidateInput.province : undefined),
          desired_job: candidate_data?.desired_job || (typeof candidateInput === 'object' ? candidateInput.desired_job : undefined)
        },
        matches: matches.slice(0, limit).map(match => ({
          job_id: match.job.id,
          campaign_code: match.job.campaign_code,
          title: match.job.title,
          job_type: match.job.job_type,
          location: {
            province: match.job.province,
            district: match.job.district,
            full: match.job.location
          },
          salary: match.job.salary_text,
          shift: match.job.shift_text,
          company: match.job.company,
          match_score: match.match.score,
          match_level: match.match.matchLevel,
          is_recommended: match.match.isRecommended,
          match_reasons: match.match.matchReasons,
          mismatch_reasons: match.match.mismatchReasons,
          ...(include_details && {
            match_breakdown: match.match.breakdown,
            description: match.job.description?.substring(0, 200),
            requirements: match.job.requirements
          })
        })),
        summary: {
          excellent: matches.filter(m => m.match.matchLevel === 'excellent').length,
          good: matches.filter(m => m.match.matchLevel === 'good').length,
          fair: matches.filter(m => m.match.matchLevel === 'fair').length,
          poor: matches.filter(m => m.match.matchLevel === 'poor').length
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Match jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi tìm kiếm việc làm'
    });
  }
});

/**
 * POST /api/match-jobs/quick
 * Quick matching without requiring full registration
 * Used for chatbot initial recommendations
 */
router.post('/match-jobs/quick', async (req, res) => {
  try {
    const schema = z.object({
      province: z.string().optional(),
      district: z.string().optional(),
      desired_job: z.string().optional(),
      preferred_shift: z.enum(['morning', 'afternoon', 'night', 'flexible', 'full_day']).optional(),
      experience_years: z.number().int().min(0).optional(),
      is_stay_in_possible: z.boolean().optional(),
      has_transport: z.boolean().optional()
    });

    const validation = schema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors: validation.error.errors
      });
    }

    const candidateData = {
      name: 'Anonymous',
      phone: '0000000000',
      ...validation.data
    };

    const matches = await quickMatch(candidateData);

    res.json({
      success: true,
      data: {
        matches: matches.map(match => ({
          job_id: match.job.id,
          title: match.job.title,
          company: match.job.company.name,
          location: `${match.job.district || ''}, ${match.job.province || ''}`.replace(/^, /, ''),
          salary: match.job.salary_text,
          match_score: match.match.score,
          match_reasons: match.match.matchReasons.slice(0, 2)
        }))
      }
    });

  } catch (error) {
    console.error('Quick match error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống'
    });
  }
});

/**
 * GET /api/match-jobs/:jobId/score
 * Calculate match score between a candidate and specific job
 * Query params: candidate_id OR phone
 */
router.get('/match-jobs/:jobId/score', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { candidate_id, phone } = req.query;

    if (!candidate_id && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin ứng viên (candidate_id hoặc phone)'
      });
    }

    const db = await openDb();

    // Get candidate
    let candidate;
    if (candidate_id) {
      candidate = await db.get('SELECT * FROM candidates WHERE id = ?', candidate_id);
    } else {
      const normalizedPhone = normalizePhone(phone);
      candidate = await db.get('SELECT * FROM candidates WHERE normalized_phone = ?', normalizedPhone);
    }

    // Get job
    const job = await db.get(`
      SELECT c.*, co.name as company_name, co.company_code
      FROM campaigns c
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE c.id = ? AND c.status = 'active'
    `, jobId);

    await db.close();

    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ứng viên'
      });
    }

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy công việc hoặc công việc không còn tuyển'
      });
    }

    const matchResult = calculateMatchScore(candidate, job);

    res.json({
      success: true,
      data: {
        candidate: {
          id: candidate.id,
          name: candidate.name,
          province: candidate.province,
          desired_job: candidate.desired_job
        },
        job: {
          id: job.id,
          title: job.title,
          company: job.company_name,
          province: job.province,
          district: job.district
        },
        match: matchResult
      }
    });

  } catch (error) {
    console.error('Score calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống'
    });
  }
});

/**
 * GET /api/match-jobs/by-candidate/:candidateId
 * Get all matches for a specific candidate
 */
router.get('/match-jobs/by-candidate/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { minScore = 0, limit = 10 } = req.query;

    const matches = await findMatchingJobs(candidateId, {
      minScore: parseInt(minScore),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: {
        candidate_id: candidateId,
        total: matches.length,
        matches: matches.map(m => ({
          job_id: m.job.id,
          title: m.job.title,
          company: m.job.company,
          match_score: m.match.score,
          match_level: m.match.matchLevel,
          reasons: m.match.matchReasons
        }))
      }
    });

  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống'
    });
  }
});

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

export default router;
