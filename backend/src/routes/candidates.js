// Candidates API - Chatbot Phase 1
// CRUD operations for candidate profiles with extended fields

import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { openDb } from '../database.js';
import { getAiConfigsByType } from '../aiConfigs.js';

const router = Router();
let googleTokenCache = { fingerprint: null, accessToken: null, expiresAtMs: 0 };

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

function limitText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function yesNo(value) {
  return value ? 'Có' : 'Chưa/Không';
}

function hasUsefulProfileData(profile) {
  return Object.values(profile || {}).some(value => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'boolean') return value === true;
    return String(value || '').trim().length > 0;
  });
}

function buildCandidateProfileSuggestionPrompt(profile) {
  const p = profile || {};
  const skills = Array.isArray(p.skills) ? p.skills.join(', ') : '';

  return `Bạn là trợ lý hướng nghiệp của VIECLAMGANNHA.ME cho người lao động phổ thông.
Nhiệm vụ: gợi ý giúp ứng viên hoàn thiện hồ sơ tìm việc. Đây là nội dung hiển thị trực tiếp cho ứng viên.

Nguyên tắc bắt buộc:
- Trả lời bằng tiếng Việt, dễ hiểu, thân thiện, không phán xét.
- Chỉ góp ý để ứng viên tự hoàn thiện hồ sơ, không đánh giá nội bộ kiểu loại/giữ/gọi lại.
- Không nhắc rủi ro nội bộ, bounty, hoa hồng, platform fee, tỉ lệ 80/20, CTV.
- Không yêu cầu gửi số CCCD, ảnh giấy tờ, OTP, mật khẩu, tài khoản ngân hàng.
- Không kết luận pháp lý/sức khỏe chắc chắn khi dữ liệu chưa đủ.
- Nếu hồ sơ còn ít dữ liệu, hãy nhắc người dùng bổ sung các mục cần thiết.

Hồ sơ hiện tại:
- Họ tên: ${limitText(p.fullName) || 'Chưa có'}
- SĐT: ${limitText(p.phone) ? 'Đã có' : 'Chưa có'}
- Zalo: ${limitText(p.zalo) ? 'Đã có' : 'Chưa có'}
- Năm sinh: ${limitText(p.birthYear) || 'Chưa có'}
- Giới tính: ${limitText(p.gender) || 'Chưa có'}
- Khu vực đang ở: ${limitText(p.area) || 'Chưa có'}
- Chiều cao/cân nặng: ${limitText(p.height) || '?'}cm / ${limitText(p.weight) || '?'}kg
- Sức khỏe tự khai: ${limitText(p.health) || 'Chưa có'}
- Đứng lâu: ${limitText(p.canStandLong) || 'Chưa có'}
- Đi ca đêm: ${limitText(p.canNightShift) || 'Chưa có'}
- Trực 12 tiếng: ${limitText(p.can12hShift) || 'Chưa có'}
- Việc muốn làm: ${limitText(p.desiredJob) || 'Chưa có'}
- Khu vực muốn làm: ${limitText(p.desiredArea) || 'Chưa có'}
- Ca mong muốn: ${limitText(p.desiredShift) || 'Chưa có'}
- Lương mong muốn: ${limitText(p.desiredSalary) || 'Chưa có'}
- Có thể đi làm từ: ${limitText(p.availableDate) || 'Chưa có'}
- Từng làm bảo vệ: ${limitText(p.hasGuardExperience) || 'Chưa có'}
- Số năm kinh nghiệm: ${limitText(p.yearsExperience) || 'Chưa có'}
- Nơi từng làm/mục tiêu: ${limitText(p.lastJob) || 'Chưa có'}
- Kỹ năng: ${limitText(skills) || 'Chưa có'}
- Có hồ sơ xin việc: ${yesNo(p.hasResume)}
- Có xe máy: ${yesNo(p.hasMotorbike)}
- Có thể ở lại chỗ làm: ${yesNo(p.canStayAtWork)}
- Có chứng chỉ bảo vệ: ${yesNo(p.hasGuardCertificate)}

Hãy trả lời đúng cấu trúc ngắn gọn:
1) Hồ sơ hiện đã ổn ở điểm nào:
- ...
2) Nên bổ sung gì để dễ được gọi hơn:
- ...
3) Việc/ca/khu vực nên ưu tiên:
- ...
4) Câu giới thiệu ngắn có thể dùng khi ứng tuyển:
"..."
5) Câu nên chuẩn bị khi nhà tuyển dụng gọi:
- ...`;
}

function buildCandidateJobFitPrompt(profile, job) {
  const p = profile || {};
  const j = job || {};
  const skills = Array.isArray(p.skills) ? p.skills.join(', ') : '';

  return `Bạn là trợ lý tìm việc của VIECLAMGANNHA.ME, trả lời trực tiếp cho ứng viên.
Nhiệm vụ: xem việc đang mở có phù hợp với hồ sơ ứng viên không, và gợi ý cách hỏi thêm trước khi ứng tuyển.

Nguyên tắc bắt buộc:
- Trả lời tiếng Việt, dễ hiểu, không phán xét.
- Không dùng giọng nội bộ tuyển dụng. Không nói loại/duyệt/giữ lead.
- Không nhắc bounty, hoa hồng, CTV, platform fee, 80/20.
- Không yêu cầu CCCD, OTP, mật khẩu, tài khoản ngân hàng hoặc ảnh giấy tờ.
- Nếu thiếu dữ liệu, nói rõ cần hỏi thêm chứ không kết luận chắc chắn.
- Đây chỉ là gợi ý tham khảo để ứng viên tự quyết định.

Hồ sơ ứng viên:
- Khu vực đang ở: ${limitText(p.area) || 'Chưa có'}
- Việc muốn làm: ${limitText(p.desiredJob) || 'Chưa có'}
- Khu vực muốn làm: ${limitText(p.desiredArea) || 'Chưa có'}
- Ca mong muốn: ${limitText(p.desiredShift) || 'Chưa có'}
- Lương mong muốn: ${limitText(p.desiredSalary) || 'Chưa có'}
- Có thể đi làm từ: ${limitText(p.availableDate) || 'Chưa có'}
- Năm sinh: ${limitText(p.birthYear) || 'Chưa có'}
- Giới tính: ${limitText(p.gender) || 'Chưa có'}
- Chiều cao/cân nặng: ${limitText(p.height) || '?'}cm / ${limitText(p.weight) || '?'}kg
- Sức khỏe tự khai: ${limitText(p.health) || 'Chưa có'}
- Đứng lâu: ${limitText(p.canStandLong) || 'Chưa có'}
- Đi ca đêm: ${limitText(p.canNightShift) || 'Chưa có'}
- Trực 12 tiếng: ${limitText(p.can12hShift) || 'Chưa có'}
- Từng làm bảo vệ: ${limitText(p.hasGuardExperience) || 'Chưa có'}
- Số năm kinh nghiệm: ${limitText(p.yearsExperience) || 'Chưa có'}
- Kỹ năng: ${limitText(skills) || 'Chưa có'}
- Có xe máy: ${yesNo(p.hasMotorbike)}
- Có thể ở lại chỗ làm: ${yesNo(p.canStayAtWork)}

Tin việc đang xem:
- Mã tin: ${limitText(j.id) || 'Chưa có'}
- Tiêu đề: ${limitText(j.title) || 'Chưa có'}
- Ngành/loại việc: ${limitText(j.categoryLabel || j.category) || 'Chưa có'}
- Khu vực: ${[j.district, j.province].filter(Boolean).map(v => limitText(v)).join(', ') || 'Chưa có'}
- Lương: ${limitText(j.salary) || 'Chưa có'}

Hãy trả lời đúng cấu trúc ngắn gọn:
1) Kết luận nhanh:
- Nên ứng tuyển / Có thể ứng tuyển, cần hỏi thêm / Chưa phù hợp lắm
2) Điểm phù hợp:
- ...
3) Điểm cần hỏi thêm trước khi nhận việc:
- ...
4) Câu hỏi nên hỏi nhà tuyển dụng:
- ...
5) Gợi ý hành động:
- ...`;
}

function buildCandidateApplicationNotePrompt(profile, job, form) {
  const p = profile || {};
  const j = job || {};
  const f = form || {};
  const skills = Array.isArray(p.skills) ? p.skills.join(', ') : '';

  return `Bạn là trợ lý viết ghi chú ứng tuyển cho người lao động phổ thông trên VIECLAMGANNHA.ME.
Nhiệm vụ: viết một đoạn ghi chú ứng tuyển ngắn để ứng viên dán vào form. Đây là nội dung hiển thị trực tiếp cho ứng viên và sẽ được gửi cho nhà tuyển dụng nếu ứng viên đồng ý.

Nguyên tắc bắt buộc:
- Chỉ trả về đúng 1 đoạn ghi chú, không tiêu đề, không markdown, không gạch đầu dòng.
- Dài tối đa 450 ký tự.
- Giọng lịch sự, tự nhiên, dễ hiểu, không khoe quá mức.
- Không nhắc AI, không nhắc hệ thống, không nhắc VIECLAMGANNHA nếu không cần.
- Không nhắc bounty, hoa hồng, CTV, platform fee, 80/20.
- Không yêu cầu hoặc tự bịa CCCD, OTP, mật khẩu, tài khoản ngân hàng, giấy tờ nhạy cảm.
- Không bịa kinh nghiệm/chứng chỉ nếu hồ sơ không có.
- Nếu dữ liệu thiếu, viết câu an toàn: muốn ứng tuyển, có thể trao đổi thêm qua SĐT/Zalo đã cung cấp.

Thông tin ứng viên đang nhập trong form:
- Họ tên: ${limitText(f.fullName) || limitText(p.fullName) || 'Chưa có'}
- Khu vực ứng tuyển: ${[f.district, f.province].filter(Boolean).map(v => limitText(v)).join(', ') || 'Chưa có'}
- Ghi chú hiện có: ${limitText(f.note) || 'Chưa có'}

Hồ sơ đã lưu tạm:
- Khu vực đang ở: ${limitText(p.area) || 'Chưa có'}
- Việc muốn làm: ${limitText(p.desiredJob) || 'Chưa có'}
- Khu vực muốn làm: ${limitText(p.desiredArea) || 'Chưa có'}
- Ca mong muốn: ${limitText(p.desiredShift) || 'Chưa có'}
- Lương mong muốn: ${limitText(p.desiredSalary) || 'Chưa có'}
- Có thể đi làm từ: ${limitText(p.availableDate) || 'Chưa có'}
- Từng làm bảo vệ: ${limitText(p.hasGuardExperience) || 'Chưa có'}
- Số năm kinh nghiệm: ${limitText(p.yearsExperience) || 'Chưa có'}
- Kỹ năng: ${limitText(skills) || 'Chưa có'}
- Có xe máy: ${yesNo(p.hasMotorbike)}
- Có thể ở lại chỗ làm: ${yesNo(p.canStayAtWork)}
- Có chứng chỉ bảo vệ: ${yesNo(p.hasGuardCertificate)}

Tin việc đang ứng tuyển:
- Mã tin: ${limitText(j.id) || 'Chưa có'}
- Tiêu đề: ${limitText(j.title) || 'Chưa có'}
- Ngành/loại việc: ${limitText(j.categoryLabel || j.category) || 'Chưa có'}
- Khu vực: ${[j.district, j.province].filter(Boolean).map(v => limitText(v)).join(', ') || 'Chưa có'}
- Lương: ${limitText(j.salary) || 'Chưa có'}

Hãy viết ghi chú ứng tuyển ngay bây giờ.`;
}

async function callCandidateProfileAi(config, prompt) {
  const settings = safeJsonParse(config.config_json, {});
  const providerType = config.provider_type;
  const systemPrompt = 'Bạn là trợ lý giúp người lao động hoàn thiện hồ sơ, chọn việc phù hợp và viết ghi chú ứng tuyển. Không đưa thông tin nội bộ tuyển dụng.';

  if (providerType === 'gemini_api') {
    const model = normalizeGeminiModel(settings.model || 'gemini-2.0-flash');
    if (!settings.apiKey) throw new Error('AI hồ sơ chưa có apiKey');
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
    return extractGeminiText(data) || 'AI không trả về nội dung gợi ý.';
  }

  if (providerType === 'claude_api') {
    if (!settings.apiKey) throw new Error('AI hồ sơ chưa có apiKey');
    if (!settings.model) throw new Error('AI hồ sơ chưa có model');
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
    return data?.choices?.[0]?.message?.content || 'AI không trả về nội dung gợi ý.';
  }

  if (providerType === 'dialogflow' || providerType === 'agent_builder' || settings.runtime === 'dialogflow_cx') {
    let accessToken = settings.authToken;
    const projectId = settings.projectId || extractProjectIdFromCredentialsJson(settings.credentialsJson);
    const loc = String(settings.location || 'global').trim().toLowerCase() || 'global';
    const agentId = normalizeResourceId(settings.agentId || settings.model || settings.engineId);
    const languageCode = String(settings.languageCode || 'vi').trim() || 'vi';

    if (settings.credentialsJson && String(settings.credentialsJson).trim().startsWith('{')) {
      accessToken = await getAccessTokenFromServiceAccountJson(settings.credentialsJson);
    }

    if (!accessToken) throw new Error('AI hồ sơ thiếu Credentials JSON hoặc Auth Token.');
    if (!projectId) throw new Error('AI hồ sơ thiếu Project ID.');
    if (!loc) throw new Error('AI hồ sơ thiếu Location.');
    if (!agentId) throw new Error('AI hồ sơ thiếu Agent ID.');

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

    return extractDialogflowReplyText(data) || 'AI đã phản hồi nhưng chưa có nội dung text. Kiểm tra lại playbook/response trong agent.';
  }

  throw new Error(`Provider AI hồ sơ chưa hỗ trợ: ${providerType || 'none'}`);
}

function isUnsafeInternalOutput(text) {
  const value = String(text || '').toLowerCase();
  return ['bounty', 'platform fee', '80/20', 'hoa hồng', 'ctv'].some(term => value.includes(term));
}

async function getActiveCandidateAiConfig() {
  const configs = await getAiConfigsByType('cv_analyzer');
  return configs.find(cfg => cfg.status === 'active') || configs.find(cfg => cfg.provider_type && cfg.provider_type !== 'none') || null;
}

// Validation schema for creating/updating candidate
const candidateSchema = z.object({
  name: z.string().min(2, 'Họ tên ít nhất 2 ký tự').max(100),
  phone: z.string().regex(/^[0-9\-\+\s]{9,15}$/, 'Số điện thoại không hợp lệ'),
  zalo_phone: z.string().regex(/^[0-9\-\+\s]{9,15}$/, 'Số Zalo không hợp lệ').optional().nullable(),
  birth_year: z.number().int().min(1950).max(2010).optional().nullable(),
  age_range: z.string().max(20).optional().nullable(),
  province: z.string().max(100).optional().nullable(),
  district: z.string().max(100).optional().nullable(),
  desired_job: z.string().max(200).optional().nullable(),
  desired_shift: z.string().max(100).optional().nullable(),
  available_date: z.string().max(50).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  // Chatbot matching fields
  experience_years: z.number().int().min(0).max(50).optional().nullable(),
  education_level: z.enum(['primary', 'secondary', 'high_school', 'vocational', 'college', 'university', 'postgraduate']).optional().nullable(),
  preferred_shift: z.enum(['morning', 'afternoon', 'night', 'flexible', 'full_day']).optional().nullable(),
  is_stay_in_possible: z.boolean().optional().nullable(),
  has_transport: z.boolean().optional().nullable()
});

const profileAiSuggestSchema = z.object({
  profile: z.record(z.any()).default({})
});

const jobFitSchema = z.object({
  profile: z.record(z.any()).default({}),
  job: z.record(z.any()).default({})
});

const applicationNoteSchema = z.object({
  profile: z.record(z.any()).default({}),
  job: z.record(z.any()).default({}),
  form: z.record(z.any()).default({})
});

// POST /api/candidates/profile/ai-suggest - User-facing profile improvement suggestions
router.post('/profile/ai-suggest', async (req, res) => {
  try {
    const validation = profileAiSuggestSchema.safeParse(req.body || {});
    if (!validation.success) {
      return res.status(400).json({ success: false, message: 'Dữ liệu hồ sơ không hợp lệ' });
    }

    const profile = validation.data.profile || {};
    if (!hasUsefulProfileData(profile)) {
      return res.status(400).json({
        success: false,
        message: 'Bạn cần điền và lưu tạm hồ sơ trước khi dùng AI gợi ý.'
      });
    }

    const activeConfig = await getActiveCandidateAiConfig();
    if (!activeConfig) {
      return res.status(503).json({
        success: false,
        message: 'AI gợi ý hồ sơ chưa được cấu hình. Vui lòng thử lại sau.'
      });
    }

    const prompt = buildCandidateProfileSuggestionPrompt(profile);
    const suggestion = await callCandidateProfileAi(activeConfig, prompt);

    if (isUnsafeInternalOutput(suggestion)) {
      return res.status(502).json({
        success: false,
        message: 'AI trả về nội dung chưa phù hợp để hiển thị cho ứng viên. Vui lòng thử lại.'
      });
    }

    res.json({
      success: true,
      data: {
        suggestion,
        visibleTo: 'candidate_only'
      }
    });
  } catch (error) {
    console.error('Candidate profile AI suggestion error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Không thể tạo gợi ý hồ sơ bằng AI'
    });
  }
});

// POST /api/candidates/job-fit - User-facing job fit check from job detail page
router.post('/job-fit', async (req, res) => {
  try {
    const validation = jobFitSchema.safeParse(req.body || {});
    if (!validation.success) {
      return res.status(400).json({ success: false, message: 'Dữ liệu kiểm tra việc chưa hợp lệ' });
    }

    const profile = validation.data.profile || {};
    const job = validation.data.job || {};

    if (!hasUsefulProfileData(profile)) {
      return res.status(400).json({
        success: false,
        message: 'Bạn cần điền và lưu tạm hồ sơ trong Tài khoản trước khi kiểm tra việc này có hợp không.'
      });
    }

    if (!job.id && !job.title) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu tin việc để AI kiểm tra.' });
    }

    const activeConfig = await getActiveCandidateAiConfig();
    if (!activeConfig) {
      return res.status(503).json({
        success: false,
        message: 'AI kiểm tra việc chưa được cấu hình. Vui lòng thử lại sau.'
      });
    }

    const prompt = buildCandidateJobFitPrompt(profile, job);
    const fit = await callCandidateProfileAi(activeConfig, prompt);

    if (isUnsafeInternalOutput(fit)) {
      return res.status(502).json({
        success: false,
        message: 'AI trả về nội dung chưa phù hợp để hiển thị cho ứng viên. Vui lòng thử lại.'
      });
    }

    res.json({
      success: true,
      data: {
        fit,
        visibleTo: 'candidate_only'
      }
    });
  } catch (error) {
    console.error('Candidate job fit AI error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Không thể kiểm tra việc này bằng AI'
    });
  }
});

// POST /api/candidates/application-note - User-facing application note draft
router.post('/application-note', async (req, res) => {
  try {
    const validation = applicationNoteSchema.safeParse(req.body || {});
    if (!validation.success) {
      return res.status(400).json({ success: false, message: 'Dữ liệu viết ghi chú chưa hợp lệ' });
    }

    const profile = validation.data.profile || {};
    const job = validation.data.job || {};
    const form = validation.data.form || {};

    const hasFormData = Boolean(String(form.fullName || '').trim() || String(form.province || '').trim() || String(form.district || '').trim() || String(form.note || '').trim());
    if (!hasUsefulProfileData(profile) && !hasFormData) {
      return res.status(400).json({
        success: false,
        message: 'Bạn cần điền hồ sơ hoặc nhập thông tin ứng tuyển trước khi AI viết ghi chú.'
      });
    }

    if (!job.id && !job.title) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu tin việc để AI viết ghi chú.' });
    }

    const activeConfig = await getActiveCandidateAiConfig();
    if (!activeConfig) {
      return res.status(503).json({
        success: false,
        message: 'AI viết ghi chú chưa được cấu hình. Vui lòng thử lại sau.'
      });
    }

    const prompt = buildCandidateApplicationNotePrompt(profile, job, form);
    let note = await callCandidateProfileAi(activeConfig, prompt);
    note = String(note || '')
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/```$/i, '')
      .replace(/^ghi chú ứng tuyển\s*:?\s*/i, '')
      .trim()
      .slice(0, 500);

    if (!note) {
      return res.status(502).json({ success: false, message: 'AI chưa trả về ghi chú phù hợp. Vui lòng thử lại.' });
    }

    if (isUnsafeInternalOutput(note)) {
      return res.status(502).json({
        success: false,
        message: 'AI trả về nội dung chưa phù hợp để hiển thị cho ứng viên. Vui lòng thử lại.'
      });
    }

    res.json({
      success: true,
      data: {
        note,
        visibleTo: 'candidate_only'
      }
    });
  } catch (error) {
    console.error('Candidate application note AI error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Không thể viết ghi chú ứng tuyển bằng AI'
    });
  }
});

// GET /api/candidates - List all candidates (admin only)
router.get('/', async (req, res) => {
  try {
    const db = await openDb();
    const candidates = await db.all(`
      SELECT 
        id, name, phone, normalized_phone, zalo_phone,
        birth_year, age_range, province, district,
        desired_job, desired_shift, available_date, note,
        consent_status, created_at,
        experience_years, education_level, preferred_shift,
        is_stay_in_possible, has_transport
      FROM candidates 
      ORDER BY created_at DESC
      LIMIT 100
    `);
    await db.close();
    
    res.json({
      success: true,
      data: candidates
    });
  } catch (error) {
    console.error('List candidates error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống'
    });
  }
});

// GET /api/candidates/:id - Get candidate by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await openDb();
    
    const candidate = await db.get(`
      SELECT 
        id, name, phone, normalized_phone, zalo_phone,
        birth_year, age_range, province, district,
        desired_job, desired_shift, available_date, note,
        consent_status, created_at,
        experience_years, education_level, preferred_shift,
        is_stay_in_possible, has_transport
      FROM candidates 
      WHERE id = ?
    `, id);
    
    await db.close();
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ứng viên'
      });
    }
    
    res.json({
      success: true,
      data: candidate
    });
  } catch (error) {
    console.error('Get candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống'
    });
  }
});

// GET /api/candidates/phone/:phone - Get candidate by phone
router.get('/phone/:phone', async (req, res) => {
  try {
    const normalizedPhone = normalizePhone(req.params.phone);
    const db = await openDb();
    
    const candidate = await db.get(`
      SELECT 
        id, name, phone, normalized_phone, zalo_phone,
        birth_year, age_range, province, district,
        desired_job, desired_shift, available_date, note,
        consent_status, created_at,
        experience_years, education_level, preferred_shift,
        is_stay_in_possible, has_transport
      FROM candidates 
      WHERE normalized_phone = ?
    `, normalizedPhone);
    
    await db.close();
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ứng viên'
      });
    }
    
    res.json({
      success: true,
      data: candidate
    });
  } catch (error) {
    console.error('Get candidate by phone error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống'
    });
  }
});

// POST /api/candidates - Create new candidate
router.post('/', async (req, res) => {
  try {
    const validation = candidateSchema.safeParse(req.body);
    
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
    const normalizedPhone = normalizePhone(data.phone);
    
    const db = await openDb();
    
    // Check if phone already exists
    const existing = await db.get('SELECT id FROM candidates WHERE normalized_phone = ?', normalizedPhone);
    if (existing) {
      await db.close();
      return res.status(409).json({
        success: false,
        message: 'Số điện thoại đã tồn tại',
        candidate_id: existing.id
      });
    }
    
    const candidateId = 'cand-' + Date.now();
    const now = new Date().toISOString();
    
    await db.run(`
      INSERT INTO candidates (
        id, name, phone, normalized_phone, zalo_phone,
        birth_year, age_range, province, district,
        desired_job, desired_shift, available_date, note,
        consent_status, created_at,
        experience_years, education_level, preferred_shift,
        is_stay_in_possible, has_transport
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'granted', ?, ?, ?, ?, ?, ?)
    `, [
      candidateId,
      data.name,
      data.phone,
      normalizedPhone,
      data.zalo_phone || null,
      data.birth_year || null,
      data.age_range || null,
      data.province || null,
      data.district || null,
      data.desired_job || null,
      data.desired_shift || null,
      data.available_date || null,
      data.note || null,
      now,
      data.experience_years || null,
      data.education_level || null,
      data.preferred_shift || null,
      data.is_stay_in_possible ? 1 : 0,
      data.has_transport ? 1 : 0
    ]);
    
    await db.close();
    
    res.status(201).json({
      success: true,
      message: 'Đã tạo hồ sơ ứng viên',
      data: {
        id: candidateId,
        name: data.name,
        phone: data.phone
      }
    });
  } catch (error) {
    console.error('Create candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống'
    });
  }
});

// PUT /api/candidates/:id - Update candidate
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validation = candidateSchema.partial().safeParse(req.body);
    
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
    const db = await openDb();
    
    // Check if candidate exists
    const existing = await db.get('SELECT id FROM candidates WHERE id = ?', id);
    if (!existing) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ứng viên'
      });
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    
    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.zalo_phone !== undefined) { updates.push('zalo_phone = ?'); values.push(data.zalo_phone); }
    if (data.birth_year !== undefined) { updates.push('birth_year = ?'); values.push(data.birth_year); }
    if (data.age_range !== undefined) { updates.push('age_range = ?'); values.push(data.age_range); }
    if (data.province !== undefined) { updates.push('province = ?'); values.push(data.province); }
    if (data.district !== undefined) { updates.push('district = ?'); values.push(data.district); }
    if (data.desired_job !== undefined) { updates.push('desired_job = ?'); values.push(data.desired_job); }
    if (data.desired_shift !== undefined) { updates.push('desired_shift = ?'); values.push(data.desired_shift); }
    if (data.available_date !== undefined) { updates.push('available_date = ?'); values.push(data.available_date); }
    if (data.note !== undefined) { updates.push('note = ?'); values.push(data.note); }
    if (data.experience_years !== undefined) { updates.push('experience_years = ?'); values.push(data.experience_years); }
    if (data.education_level !== undefined) { updates.push('education_level = ?'); values.push(data.education_level); }
    if (data.preferred_shift !== undefined) { updates.push('preferred_shift = ?'); values.push(data.preferred_shift); }
    if (data.is_stay_in_possible !== undefined) { updates.push('is_stay_in_possible = ?'); values.push(data.is_stay_in_possible ? 1 : 0); }
    if (data.has_transport !== undefined) { updates.push('has_transport = ?'); values.push(data.has_transport ? 1 : 0); }
    
    if (updates.length === 0) {
      await db.close();
      return res.status(400).json({
        success: false,
        message: 'Không có dữ liệu để cập nhật'
      });
    }
    
    values.push(id);
    
    await db.run(`
      UPDATE candidates SET ${updates.join(', ')} WHERE id = ?
    `, values);
    
    await db.close();
    
    res.json({
      success: true,
      message: 'Đã cập nhật hồ sơ ứng viên'
    });
  } catch (error) {
    console.error('Update candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống'
    });
  }
});

// DELETE /api/candidates/:id - Delete candidate
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await openDb();
    
    const existing = await db.get('SELECT id FROM candidates WHERE id = ?', id);
    if (!existing) {
      await db.close();
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy ứng viên'
      });
    }
    
    await db.run('DELETE FROM candidates WHERE id = ?', id);
    await db.close();
    
    res.json({
      success: true,
      message: 'Đã xóa hồ sơ ứng viên'
    });
  } catch (error) {
    console.error('Delete candidate error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống'
    });
  }
});

export default router;