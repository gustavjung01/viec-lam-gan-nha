import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

// --- Google Auth Helpers ---
let _webSupportOAuthCache = {};

function base64UrlEncodeJson(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function getAccessTokenFromServiceAccountJson(credentialsJson) {
  let credentials;
  try {
    credentials = typeof credentialsJson === 'string' ? JSON.parse(credentialsJson) : credentialsJson;
  } catch (e) {
    throw new Error('Invalid Google Cloud credentials JSON.');
  }

  if (!credentials || !credentials.client_email || !credentials.private_key) {
    throw new Error('Invalid Google Cloud credentials JSON. Missing client_email or private_key.');
  }

  const fingerprint = crypto
    .createHash('sha256')
    .update(`${credentials.client_email}::${credentials.private_key}::${credentials.token_uri || ''}`)
    .digest('hex');

  if (_webSupportOAuthCache.fingerprint === fingerprint && _webSupportOAuthCache.accessToken && Date.now() < _webSupportOAuthCache.expiresAtMs) {
    return _webSupportOAuthCache.accessToken;
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
  const signature = signer.sign(credentials.private_key, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to get Google access token (${response.status}): ${responseText.slice(0, 200)}`);
  }

  const data = JSON.parse(responseText);
  if (!data?.access_token) {
    throw new Error('Google access token response missing access_token.');
  }

  const expiresInMs = Math.max(60, Number(data.expires_in || 3600) - 60) * 1000;
  _webSupportOAuthCache = {
    fingerprint,
    accessToken: data.access_token,
    expiresAtMs: Date.now() + expiresInMs,
  };

  return data.access_token;
}

function extractAssistantTextFromVertexResponse(data) {
  if (!data) return '';
  if (typeof data.output === 'string') return data.output;
  if (Array.isArray(data.output?.parts)) {
    const text = data.output.parts.map((part) => part?.text || '').filter(Boolean).join('\n').trim();
    if (text) return text;
  }
  const outputText = data.output?.text || data.output?.response?.text;
  if (typeof outputText === 'string' && outputText.trim()) return outputText.trim();
  const candidates = data.candidates || data.response?.candidates || [];
  for (const candidate of candidates) {
    const content = candidate?.content;
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    const text = parts.map((part) => part?.text || '').filter(Boolean).join('\n').trim();
    if (text) return text;
  }
  return '';
}

function normalizeGeminiStudioModel(model) {
  let s = String(model || '').trim();
  if (!s) return '';

  // Strip common Gemini resource prefixes first.
  if (s.includes('/')) {
    const parts = s.split('/').filter(Boolean);
    s = parts[parts.length - 1];
  }
  s = s
    .replace(/^models\//i, '')
    .replace(/^google\//i, '')
    .replace(/^publishers\/google\/models\//i, '')
    .replace(/[:@].*$/, '')
    .trim();

  // If the input still looks like a display name, convert it to a slug.
  if (!/^[a-z0-9._-]+$/.test(s)) {
    s = s
      .toLowerCase()
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  return s.trim();
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
  let s = String(value || '').trim();
  if (!s) return '';
  s = s.split(':')[0].trim();
  const parts = s.split('/').filter(Boolean);
  return (parts[parts.length - 1] || s).trim();
}

function getLastUserMessageText(messages = []) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role === 'user' && typeof msg.content === 'string' && msg.content.trim()) {
      return msg.content.trim();
    }
  }
  const last = messages[messages.length - 1];
  return String(last?.content || '').trim();
}

function getGoogleApiHost(service, location) {
  const loc = String(location || 'global').trim().toLowerCase() || 'global';
  return loc === 'global' ? `${service}.googleapis.com` : `${loc}-${service}.googleapis.com`;
}

function extractDiscoveryEngineAnswerText(data) {
  const answer = data?.answer || data;
  const answerText = answer?.answerText || answer?.answer_text || data?.answerText || data?.answer_text;
  if (typeof answerText === 'string' && answerText.trim()) {
    return answerText.trim();
  }
  return '';
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
        if (typeof part === 'string' && part.trim()) {
          parts.push(part.trim());
        }
      }
    }
  }

  return parts.join('\n').trim();
}

function normalizeRuntimeProviderType(providerType) {
  const value = String(providerType || '').trim();
  if (value === 'gemini_api') return 'gemini';
  if (value === 'vertex_ai') return 'vertex';
  if (value === 'agent_builder') return 'agent_builder';
  if (value === 'vertex_agent') return 'agent_builder';
  if (value === 'claude_api') return 'openai';
  return value;
}

function shouldRestoreSecretField(value, maskedPrefix, maskedPlaceholder = '') {
  const text = String(value || '').trim();
  if (!text) return true;
  if (maskedPlaceholder && text === maskedPlaceholder) return true;
  return text.startsWith(maskedPrefix);
}

async function hydrateSavedSecretsForType({ type, providerType, settings = {} }) {
  const hydrated = { ...settings };

  let savedConfig = null;
  if (type) {
    try {
      const configs = await getAiConfigsByType(type);
      savedConfig = configs.find(cfg => cfg.provider_type === providerType) || configs.find(cfg => cfg.status === 'active') || configs[0] || null;
    } catch (e) {
      savedConfig = null;
    }
  }

  if (!savedConfig) {
    const needsFallback =
      shouldRestoreSecretField(hydrated.apiKey, 'sk-********') ||
      shouldRestoreSecretField(hydrated.authToken, 'tk-********') ||
      shouldRestoreSecretField(hydrated.credentialsJson, '{...masked...}', '{...masked...}');

    if (needsFallback) {
      try {
        savedConfig = await getActiveChatbotConfig();
      } catch (e) {
        savedConfig = null;
      }
    }
  }

  if (!savedConfig) return hydrated;

  let current = {};
  try {
    current = JSON.parse(savedConfig.config_json || '{}');
  } catch (e) {
    current = {};
  }

  if (shouldRestoreSecretField(hydrated.apiKey, 'sk-********') && current.apiKey) {
    hydrated.apiKey = current.apiKey;
  }
  if (shouldRestoreSecretField(hydrated.authToken, 'tk-********') && current.authToken) {
    hydrated.authToken = current.authToken;
  }
  if (shouldRestoreSecretField(hydrated.credentialsJson, '{...masked...}', '{...masked...}') && current.credentialsJson) {
    hydrated.credentialsJson = current.credentialsJson;
  }

  return hydrated;
}
// ----------------------------


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { initDatabase, initMarketplaceTables } from './src/database.js';
import { getAllAiConfigs, getAiConfigById, getAiConfigsByType, createAiConfig, updateAiConfig, deleteAiConfig,
         getActiveChatbotConfig, getFallbackChatbotConfig, maskSensitiveConfig, unmaskForSave } from './src/aiConfigs.js';
import { loadProviderResources, loadSecondaryResources } from './src/aiResourceLoader.js';
import { initTelegramBot, sendWebSupportLeadNotification, readTelegramSettings, writeTelegramSettings, bot } from './src/telegram.js';
import { adminAuth } from './src/middleware/adminAuth.js';
import applyRoutes from './src/routes/apply.js';
import accountRoutes, { clerkLookupRoutes } from './src/routes/account.js';
import marketplaceRoutes from './src/routes/marketplace.js';
import adminAuthRoutes from './src/routes/adminAuth.js';
import jobRoutes from './src/routes/jobs.js';
import candidateRoutes from './src/routes/candidates.js';
import matchingRoutes from './src/routes/matching.js';

// AI Settings path (legacy - kept for reference only)
// const AI_SETTINGS_PATH = path.join(__dirname, 'data', 'web-support-config.json');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5175';

// Security middleware - CORS
const allowedOrigins = [
  FRONTEND_URL,
  'https://vieclamgannha.me',
  'https://preview.vieclamgannha.me',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175'
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS policy: Origin not allowed'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Trust proxy for Nginx
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per windowMs
  message: {
    success: false,
    message: 'Quá nhiều request, vui lòng thử lại sau'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter rate limit for apply endpoint
const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 applications per hour per IP
  message: {
    success: false,
    message: 'Bạn đã gửi quá nhiều đơn ứng tuyển, vui lòng thử lại sau 1 giờ'
  }
});

// Relaxed rate limit for admin read operations
const adminReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: {
    success: false,
    message: 'Quá nhiều request'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limit for admin authentication
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: 'Quá nhiều lần đăng nhập thất bại'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// General API limiter, skipping admin/apply endpoints that have their own limits
app.use((req, res, next) => {
  if (req.path.startsWith('/admin') || req.path.startsWith('/apply') || req.path.startsWith('/web-support')) {
    return next();
  }
  return limiter(req, res, next);
});

// Public Chatbot API
async function getAiResponse(settings, messages, context = {}) {
  try {
    const runtimeProviderType = normalizeRuntimeProviderType(settings.providerType);

    // Normalize helper for Vertex publisher model IDs
    function normalizeVertexModelId(model) {
      return String(model || '')
        .trim()
        .replace(/^projects\/[^\/]+\/locations\/[^^\/]+\/publishers\/google\/models\//, '')
        .replace(/^publishers\/google\/models\//, '')
        .replace(/^models\//, '')
        .replace(/^google\//, '')
        .replace(/^.*\/models\//, '');
    }
    if (runtimeProviderType === 'gemini') {
      const contents = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
      
      const payload = { contents };
      if (settings.systemPrompt) {
        payload.systemInstruction = { parts: [{ text: settings.systemPrompt }] };
      }

      const rawModel = settings.model;
      const modelId = normalizeGeminiStudioModel(rawModel);
      console.log('[Gemini test]', {
        rawModel,
        normalizedModel: modelId,
        urlWithoutKey: `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=***`,
        bodyHasModel: Object.prototype.hasOwnProperty.call(payload, 'model'),
        bodyKeys: Object.keys(payload),
      });
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${settings.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let data;
      const textResponse = await response.text();
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        throw new Error(`Invalid response from Gemini API (Status ${response.status}): ${textResponse.substring(0, 100)}...`);
      }
      if (!response.ok) throw new Error(data.error?.message || 'Gemini API Error');
      return data.candidates[0].content.parts[0].text;
      
    } else if (runtimeProviderType === 'agent_builder') {
      let accessToken = settings.authToken;
      const projectId = settings.projectId || extractProjectIdFromCredentialsJson(settings.credentialsJson);
      const loc = String(settings.location || 'global').trim().toLowerCase() || 'global';
      const collectionId = String(settings.collectionId || 'default_collection').trim() || 'default_collection';
      const legacyModelId = String(settings.model || '').trim();
      const engineId = normalizeResourceId(
        settings.agentId ||
        settings.engineId ||
        ((legacyModelId && !/^gemini[-._]/i.test(legacyModelId) && !/\s/.test(legacyModelId)) ? legacyModelId : '')
      );
      const servingConfigId = normalizeResourceId(settings.servingConfigId || settings.servingConfig) || 'default_serving_config';
      const lastUserText = getLastUserMessageText(messages);

      if (settings.credentialsJson && settings.credentialsJson.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(settings.credentialsJson);
          accessToken = await getAccessTokenFromServiceAccountJson(parsed);
        } catch (e) {
          console.error('Error parsing Agent Builder credentials JSON:', e);
        }
      }

      if (!accessToken) throw new Error('Auth Token or valid Credentials JSON is required for Agent Builder.');
      if (!projectId) throw new Error('Project ID is missing for Agent Builder.');
      if (!engineId) throw new Error('Agent ID is required for Agent Builder.');
      if (!lastUserText) throw new Error('User message is required for Agent Builder.');

      const host = getGoogleApiHost('discoveryengine', loc);
      const url = `https://${host}/v1/projects/${projectId}/locations/${loc}/collections/${collectionId}/engines/${engineId}/servingConfigs/${servingConfigId}:answer`;
      const sessionId = normalizeResourceId(context.sessionId || settings.sessionId || crypto.randomUUID()).slice(0, 36) || crypto.randomUUID();
      const payload = {
        query: { text: lastUserText },
        session: `projects/${projectId}/locations/${loc}/collections/${collectionId}/engines/${engineId}/sessions/${sessionId}`,
      };

      console.log('[Agent Builder test]', {
        projectId,
        location: loc,
        collectionId,
        engineId,
        servingConfigId,
        sessionId,
        urlWithoutKey: url,
        bodyKeys: Object.keys(payload),
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });

      let data;
      const textResponse = await response.text();
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        throw new Error(`Invalid response from Discovery Engine (Status ${response.status}): ${textResponse.substring(0, 100)}...`);
      }

      if (!response.ok) throw new Error(data.error?.message || `Discovery Engine Error (${response.status})`);

      const assistantText = extractDiscoveryEngineAnswerText(data);
      return assistantText || 'Discovery Engine responded successfully but returned empty text.';

    } else if (runtimeProviderType === 'dialogflow') {
      let accessToken = settings.authToken;
      const projectId = settings.projectId || extractProjectIdFromCredentialsJson(settings.credentialsJson);
      const loc = String(settings.location || 'global').trim().toLowerCase() || 'global';
      const legacyModelId = String(settings.model || '').trim();
      const agentId = normalizeResourceId(
        settings.agentId ||
        settings.environmentId ||
        ((legacyModelId && !/^gemini[-._]/i.test(legacyModelId) && !/\s/.test(legacyModelId)) ? legacyModelId : '')
      );
      const languageCode = String(settings.languageCode || 'vi').trim() || 'vi';
      const lastUserText = getLastUserMessageText(messages);

      if (settings.credentialsJson && settings.credentialsJson.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(settings.credentialsJson);
          accessToken = await getAccessTokenFromServiceAccountJson(parsed);
        } catch (e) {
          console.error('Error parsing Dialogflow credentials JSON:', e);
        }
      }

      if (!accessToken) throw new Error('Auth Token or valid Credentials JSON is required for Dialogflow.');
      if (!projectId) throw new Error('Project ID is missing for Dialogflow.');
      if (!agentId) throw new Error('Agent ID is required for Dialogflow.');
      if (!lastUserText) throw new Error('User message is required for Dialogflow.');

      const host = getGoogleApiHost('dialogflow', loc);
      const sessionId = normalizeResourceId(context.sessionId || settings.sessionId || crypto.randomUUID()).slice(0, 36) || crypto.randomUUID();
      const sessionPath = `projects/${projectId}/locations/${loc}/agents/${agentId}/sessions/${sessionId}`;
      const url = `https://${host}/v3/${sessionPath}:detectIntent`;
      const payload = {
        queryInput: {
          text: {
            text: lastUserText
          },
          languageCode
        }
      };

      console.log('[Dialogflow test]', {
        projectId,
        location: loc,
        agentId,
        languageCode,
        sessionId,
        urlWithoutKey: url,
        bodyKeys: Object.keys(payload),
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });

      let data;
      const textResponse = await response.text();
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        throw new Error(`Invalid response from Dialogflow API (Status ${response.status}): ${textResponse.substring(0, 100)}...`);
      }

      if (!response.ok) throw new Error(data.error?.message || `Dialogflow API Error (${response.status})`);

      const assistantText = extractDialogflowReplyText(data);
      return assistantText || 'Dialogflow responded successfully but returned empty text.';

    } else if (runtimeProviderType === 'vertex' || runtimeProviderType === 'vertex_agent') {
      let accessToken = settings.authToken;
      let projectId = '';
      
      // Auto-get access token from credentials JSON if available
      if (settings.credentialsJson && settings.credentialsJson.trim().startsWith('{')) {
         try {
           const parsed = JSON.parse(settings.credentialsJson);
           projectId = parsed.project_id;
           accessToken = await getAccessTokenFromServiceAccountJson(parsed);
         } catch(e) {
           console.error('Error parsing credentials JSON:', e);
         }
      }
      
      if (!accessToken) throw new Error('Auth Token or valid Credentials JSON is required for Vertex AI.');
      if (!settings.model) throw new Error('Model name is required for Vertex AI.');

      let url = settings.baseUrl;
      const loc = settings.location || 'us-central1';
      
      // Auto-construct URL if missing or just domain
      if (!url || url === `https://${'us-central1'}-aiplatform.googleapis.com/v1/projects//locations/${'us-central1'}/publishers/google/models/`) {
        if (!projectId) throw new Error('Project ID is missing. Please provide valid Credentials JSON or a complete Base URL.');
          const modelId = normalizeVertexModelId(settings.model);
          if (runtimeProviderType === 'vertex_agent') {
            // Legacy fallback only: older configs may still store reasoning engine ids in model.
            url = `https://${loc}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${loc}/reasoningEngines/${modelId}:query`;
          } else {
            url = `https://${loc}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${loc}/publishers/google/models/${modelId}:generateContent`;
          }
      } else if (url.endsWith('/models/')) {
        const modelId = normalizeVertexModelId(settings.model);
        url = `${url}${modelId}:generateContent`;
      }

      let payload;
      if (runtimeProviderType === 'vertex_agent') {
         // Vertex Agent requires a different payload
         payload = { input: { messages: messages.map(m => ({ role: m.role, content: m.content })) } };
      } else {
         payload = {
           contents: messages.map(msg => ({
             role: msg.role === 'assistant' ? 'model' : 'user',
             parts: [{ text: msg.content }]
           })),
           systemInstruction: settings.systemPrompt ? { parts: [{ text: settings.systemPrompt }] } : undefined,
         };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });
      
      let data;
      const textResponse = await response.text();
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        throw new Error(`Invalid response from Vertex API (Status ${response.status}): ${textResponse.substring(0, 100)}...`);
      }

      if (!response.ok) throw new Error(data.error?.message || `Vertex API Error (${response.status})`);
      
      const assistantText = extractAssistantTextFromVertexResponse(data);
      return assistantText || 'Vertex Agent responded successfully but returned empty text.';
      
    } else if (runtimeProviderType === 'openai') {
      const url = settings.baseUrl || 'https://api.openai.com/v1';
      
      const apiMessages = [];
      if (settings.systemPrompt) {
        apiMessages.push({ role: 'system', content: settings.systemPrompt });
      }
      apiMessages.push(...messages);

      const response = await fetch(`${url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.model,
          messages: apiMessages
        })
      });
      let data;
      const textResponse = await response.text();
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        throw new Error(`Invalid response from OpenAI API (Status ${response.status}): ${textResponse.substring(0, 100)}...`);
      }
      if (!response.ok) throw new Error(data.error?.message || 'OpenAI API Error');
      return data.choices[0].message.content;
    }
  } catch (err) {
    console.error('AI Provider Error:', err);
    throw err;
  }
  
  return 'Chatbot is not properly configured. Please contact support.';
}

const LOG_PATH = path.join(__dirname, 'data', 'web-support-logs.jsonl');

async function logWebSupportActivity(logEntry) {
  try {
    const logLine = JSON.stringify({ ...logEntry, timestamp: new Date().toISOString() }) + '\n';
    await fs.promises.appendFile(LOG_PATH, logLine, 'utf8');
  } catch (error) {
    console.error('Error writing web support log:', error);
  }
}

function extractPhoneNumber(text) {
  const phoneRegex = /(0[3|5|7|8|9])+([0-9]{8})\b/g;
  const matches = text.match(phoneRegex);
  return matches ? matches[0] : null;
}

app.post('/api/web-support/chat', async (req, res) => {
  try {
    let { messages, sessionId } = req.body;

    if (!sessionId) {
      sessionId = crypto.randomUUID();
      logWebSupportActivity({ type: 'new_chat', sessionId });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid messages format' });
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'user') {
      const phone = extractPhoneNumber(lastMessage.content);
      if (phone) {
        logWebSupportActivity({ type: 'lead', sessionId, phone, message: lastMessage.content });
        sendWebSupportLeadNotification({ sessionId, phone, message: lastMessage.content });
      } else {
        logWebSupportActivity({ type: 'chat', sessionId, role: 'user', message: lastMessage.content });
      }
    }

    // Try main chatbot first
    const mainConfig = await getActiveChatbotConfig();
    let aiResponse = null;
    let usingFallback = false;
    let providerErrorMessage = '';

    if (mainConfig && mainConfig.provider_type !== 'none') {
      try {
        const mainSettings = JSON.parse(mainConfig.config_json);
        mainSettings.providerType = mainConfig.provider_type; // Map to old field name
        mainSettings.sessionId = sessionId;
        aiResponse = await getAiResponse(mainSettings, messages, { sessionId });
      } catch (mainErr) {
        console.error('Main chatbot error:', mainErr.message);
        providerErrorMessage = String(mainErr.message || '').trim();
        // Try fallback chatbot
        const fallbackConfig = await getFallbackChatbotConfig();
        if (fallbackConfig && fallbackConfig.provider_type !== 'none') {
          try {
            const fallbackSettings = JSON.parse(fallbackConfig.config_json);
            fallbackSettings.providerType = fallbackConfig.provider_type;
            fallbackSettings.sessionId = sessionId;
            aiResponse = await getAiResponse(fallbackSettings, messages, { sessionId });
            usingFallback = true;
          } catch (fallbackErr) {
            console.error('Fallback chatbot error:', fallbackErr.message);
            if (!providerErrorMessage) {
              providerErrorMessage = String(fallbackErr.message || '').trim();
            }
          }
        }
      }
    } else {
      // No main config, try fallback directly
      const fallbackConfig = await getFallbackChatbotConfig();
      if (fallbackConfig && fallbackConfig.provider_type !== 'none') {
        try {
          const fallbackSettings = JSON.parse(fallbackConfig.config_json);
          fallbackSettings.providerType = fallbackConfig.provider_type;
          fallbackSettings.sessionId = sessionId;
          aiResponse = await getAiResponse(fallbackSettings, messages, { sessionId });
          usingFallback = true;
        } catch (fallbackErr) {
          console.error('Fallback chatbot error:', fallbackErr.message);
          providerErrorMessage = String(fallbackErr.message || '').trim();
        }
      }
    }

    if (!aiResponse) {
      return res.status(503).json({
        success: false,
        error: providerErrorMessage || 'Không có AI nào được cấu hình hoạt động.',
        sessionId
      });
    }

    logWebSupportActivity({ type: 'chat', sessionId, role: 'assistant', message: aiResponse, viaFallback: usingFallback });

    res.json({ success: true, data: { reply: aiResponse, sessionId, viaFallback: usingFallback } });
  } catch (error) {
    console.error('Error in chatbot API:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// Apply routes
app.use('/api/apply', applyLimiter, applyRoutes);

// Account routes (requires Clerk auth)
app.use('/api/account', accountRoutes);
app.use('/api', clerkLookupRoutes);

// Admin auth: only login uses the strict failed-login limiter.
app.use('/api/admin/auth/login', strictLimiter);
app.use('/api/admin/auth/me', adminAuth, adminReadLimiter);
app.use('/api/admin/auth', adminAuthRoutes);

// Job detail routes (public)
app.use('/api/jobs', jobRoutes);

// Candidate routes (public)
app.use('/api/candidates', candidateRoutes);

// Matching routes (public)
app.use('/api', matchingRoutes);

// Admin Web Support Settings API (backward compat - reads from ai_configs)
app.get('/api/admin/web-support-settings', adminAuth, adminReadLimiter, async (req, res) => {
  try {
    const mainConfig = await getActiveChatbotConfig();
    if (mainConfig) {
      const masked = maskSensitiveConfig(mainConfig);
      const config = JSON.parse(masked.config_json || '{}');
      res.json({
        success: true,
        data: {
          providerType: masked.provider_type,
          baseUrl: config.baseUrl || '',
          model: config.model || '',
          apiKey: config.apiKey || '',
          authToken: config.authToken || '',
          credentialsJson: config.credentialsJson || '',
          systemPrompt: config.systemPrompt || '',
        }
      });
    } else {
      res.json({ success: true, data: { providerType: 'none', baseUrl: '', apiKey: '', authToken: '', credentialsJson: '', model: '', systemPrompt: '' } });
    }
  } catch (error) {
    console.error('Error getting web support settings:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST test AI config connection
app.post('/api/admin/ai-configs/test', adminAuth, async (req, res) => {
  try {
    const { provider_type, config_json } = req.body;
    // Allow caller to omit provider_type/config_json and use saved config
    let providerTypeFromReq = provider_type;
    let settings = {};
    let usedSavedConfig = false;

    try {
      settings = typeof config_json === 'string' && config_json ? JSON.parse(config_json) : (config_json || {});
    } catch (e) {
      return res.status(400).json({ success: false, message: 'config_json không hợp lệ' });
    }

    // If no config supplied, try to use the active saved chatbot config
    if ((!settings || Object.keys(settings).length === 0) && !providerTypeFromReq) {
      const active = await getActiveChatbotConfig();
      if (active) {
        try {
          settings = JSON.parse(active.config_json || '{}');
          providerTypeFromReq = active.provider_type;
          usedSavedConfig = true;
        } catch (e) {
          // ignore parse error and continue
        }
      }
    }

    if ((!settings || Object.keys(settings).length === 0) && providerTypeFromReq && (!config_json || config_json === '{}')) {
      // Try to load matching saved config when provider_type provided but config empty
      const active = await getActiveChatbotConfig();
      if (active && active.provider_type === providerTypeFromReq) {
        try {
          settings = JSON.parse(active.config_json || '{}');
          usedSavedConfig = true;
        } catch (e) {}
      }
    }

    settings = await hydrateSavedSecretsForType({
      type: req.body.type,
      providerType: providerTypeFromReq,
      settings,
    });

    if (!providerTypeFromReq) return res.status(400).json({ success: false, message: 'Thiếu provider_type' });

    // Map UI provider_type to internal providerType used by getAiResponse
    const map = {
      gemini_api: 'gemini',
      vertex_ai: 'vertex',
      agent_builder: 'agent_builder',
      claude_api: 'openai',
      dialogflow: 'dialogflow'
    };
    settings.providerType = map[providerTypeFromReq] || providerTypeFromReq;

    // Basic validations with clear field names
    const missing = [];
    if (providerTypeFromReq === 'gemini_api') {
      if (!settings.apiKey) missing.push('apiKey');
      if (!settings.model) missing.push('model');
    } else if (providerTypeFromReq === 'claude_api') {
      if (!settings.baseUrl) missing.push('baseUrl');
      if (!settings.apiKey) missing.push('apiKey');
      if (!settings.model) missing.push('model');
    } else if (providerTypeFromReq === 'vertex_ai') {
      if (!settings.credentialsJson && !settings.authToken) missing.push('credentialsJson/authToken');
      if (!settings.model) missing.push('model');
    } else if (providerTypeFromReq === 'dialogflow' || providerTypeFromReq === 'agent_builder') {
      // For Dialogflow and Agent Builder we require projectId, location, agentId and credentialsJson.
      if (!settings.projectId) missing.push('projectId');
      if (!settings.location) missing.push('location');
      if (!settings.agentId) missing.push('agentId');
      if (!settings.credentialsJson) missing.push('credentialsJson');
    }

    if (missing.length > 0) {
      // Return clear messages like "Thiếu projectId"
      return res.status(400).json({ success: false, message: missing.map(f => `Thiếu ${f}`).join(', ') });
    }

    // Try a lightweight test call via existing getAiResponse for other supported providers
    try {
      // Safe log: only provider_type and normalized model
      const normalizeModel = (m) => String(m || '').trim().replace(/^models\//, '').replace(/^google\//, '').replace(/^publishers\/google\/models\//, '').replace(/^.*\/models\//, '');
      const safeModel = providerTypeFromReq === 'gemini_api'
        ? normalizeGeminiStudioModel(settings.model)
        : normalizeModel(settings.model);
      console.log('AI test request:', { provider_type: providerTypeFromReq, model: safeModel, usedSavedConfig });

      const testMessages = [{ role: 'user', content: 'Kiểm tra kết nối: xin chào' }];
      const reply = await getAiResponse(settings, testMessages, { sessionId: crypto.randomUUID() });
      return res.json({ success: true, message: `Kết nối thành công. Trả lời mẫu: ${String(reply).slice(0, 200)}` });
    } catch (err) {
      // Mask any long tokens in error messages before logging/returning
      const safeMsg = String(err.message || '').replace(/[A-Za-z0-9_\-]{20,}/g, '[REDACTED]');
      console.error('AI test error:', { provider_type: providerTypeFromReq, message: safeMsg });
      return res.status(500).json({ success: false, message: safeMsg || 'Lỗi khi kiểm tra kết nối' });
    }
  } catch (error) {
    console.error('Error testing AI config:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.put('/api/admin/web-support-settings', adminAuth, async (req, res) => {
  try {
    const newSettings = req.body;
    const currentConfig = await getActiveChatbotConfig();

    // Unmask if necessary
    let unmaskedData = { ...newSettings };
    if (currentConfig) {
      const current = JSON.parse(currentConfig.config_json || '{}');
      if (newSettings.apiKey && newSettings.apiKey.startsWith('sk-********')) {
        unmaskedData.apiKey = current.apiKey;
      }
      if (newSettings.authToken && newSettings.authToken.startsWith('tk-********')) {
        unmaskedData.authToken = current.authToken;
      }
      if (newSettings.credentialsJson === '{...masked...}') {
        unmaskedData.credentialsJson = current.credentialsJson;
      }
    }

    const config_json = JSON.stringify({
      baseUrl: unmaskedData.baseUrl || '',
      model: unmaskedData.model || '',
      apiKey: unmaskedData.apiKey || '',
      authToken: unmaskedData.authToken || '',
      credentialsJson: unmaskedData.credentialsJson || '',
      systemPrompt: unmaskedData.systemPrompt || ''
    });

    let providerType = 'none';
    if (unmaskedData.providerType === 'vertex' || unmaskedData.providerType === 'vertex_agent') {
      providerType = 'vertex_ai';
    } else if (unmaskedData.providerType === 'gemini') {
      providerType = 'gemini_api';
    } else if (unmaskedData.providerType === 'openai') {
      providerType = 'claude_api';
    }

    if (currentConfig) {
      await updateAiConfig('chatbot_main', {
        name: 'VLGN Chat Agent',
        provider_type: providerType,
        config_json,
        rules: 'Chỉ tư vấn việc làm bảo vệ và lao động phổ thông trên web. Không tư vấn các công việc khác.',
        status: providerType !== 'none' ? 'active' : 'inactive'
      });
    } else {
      await createAiConfig({
        id: 'chatbot_main',
        name: 'VLGN Chat Agent',
        type: 'chatbot_main',
        provider_type: providerType,
        config_json,
        rules: 'Chỉ tư vấn việc làm bảo vệ và lao động phổ thông trên web. Không tư vấn các công việc khác.',
        status: providerType !== 'none' ? 'active' : 'inactive'
      });
    }

    res.json({ success: true, message: 'Web support settings updated successfully' });
  } catch (error) {
    console.error('Error updating web support settings:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// =============================================
// NEW: AI Configs CRUD endpoints
// =============================================

// GET all AI configs
app.get('/api/admin/ai-configs', adminAuth, adminReadLimiter, async (req, res) => {
  try {
    const configs = await getAllAiConfigs();
    const masked = configs.map(maskSensitiveConfig);
    res.json({ success: true, data: masked });
  } catch (error) {
    console.error('Error getting AI configs:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST create new AI config
app.post('/api/admin/ai-configs', adminAuth, async (req, res) => {
  try {
    const { id, name, type, provider_type, config_json, rules, status } = req.body;

    if (!id || !name || !type || !provider_type) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin bắt buộc (id, name, type, provider_type)' });
    }

    if (!['chatbot_main', 'chatbot_fallback', 'cv_analyzer'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Loại AI không hợp lệ' });
    }

    if (!['dialogflow', 'gemini_api', 'claude_api', 'vertex_ai', 'agent_builder', 'none'].includes(provider_type)) {
      return res.status(400).json({ success: false, error: 'Provider không hợp lệ' });
    }

    const existing = await getAiConfigById(id);
    if (existing) {
      return res.status(409).json({ success: false, error: 'ID đã tồn tại' });
    }

    const created = await createAiConfig({
      id,
      name,
      type,
      provider_type,
      config_json: config_json || '{}',
      rules: rules || '',
      status: status || 'inactive'
    });

    res.json({ success: true, data: maskSensitiveConfig(created), message: 'Tạo AI mới thành công' });
  } catch (error) {
    console.error('Error creating AI config:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// PUT update AI config
app.put('/api/admin/ai-configs/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, provider_type, config_json, rules, status, error_reason } = req.body;

    const existing = await getAiConfigById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'AI config không tìm thấy' });
    }

    // Unmask if necessary
    let finalConfigJson = config_json;
    if (config_json) {
      const unmasked = unmaskForSave({ config_json }, existing);
      finalConfigJson = unmasked.config_json;
    }

    const updated = await updateAiConfig(id, {
      name: name || existing.name,
      provider_type: provider_type || existing.provider_type,
      config_json: finalConfigJson || existing.config_json,
      rules: rules !== undefined ? rules : existing.rules,
      status: status || existing.status,
      error_reason: error_reason !== undefined ? error_reason : existing.error_reason
    });

    if (!updated) {
      return res.status(400).json({ success: false, error: 'Không có thay đổi' });
    }

    const refreshed = await getAiConfigById(id);
    res.json({ success: true, data: maskSensitiveConfig(refreshed), message: 'Cập nhật thành công' });
  } catch (error) {
    console.error('Error updating AI config:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// DELETE AI config
app.delete('/api/admin/ai-configs/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (id === 'chatbot_main') {
      return res.status(400).json({ success: false, error: 'Không thể xóa AI chính. Hãy cập nhật trạng thái thành inactive.' });
    }

    const deleted = await deleteAiConfig(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'AI config không tìm thấy' });
    }

    res.json({ success: true, message: 'Xóa AI thành công' });
  } catch (error) {
    console.error('Error deleting AI config:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

app.post('/api/admin/web-support-settings/models', adminAuth, async (req, res) => {
  try {
    let { providerType, baseUrl, apiKey } = req.body;
    
    // Unmask if necessary
    if (apiKey && apiKey.startsWith('sk-********')) {
      const current = await readAiSettings();
      apiKey = current.apiKey;
    }

    let models = [];

    if (providerType === 'gemini') {
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const response = await fetch(testUrl);
      const data = await response.json();
      if (!response.ok) {
         throw new Error(data.error?.message || 'Failed to fetch Gemini models');
      }
      models = data.models.map(m => m.name.replace('models/', '')).filter(m => m.includes('gemini'));
    } else if (providerType === 'vertex' || providerType === 'vertex_agent') {
      let accessToken = req.body.authToken;
      if (req.body.credentialsJson && req.body.credentialsJson.trim().startsWith('{')) {
         try {
           const parsed = JSON.parse(req.body.credentialsJson);
           accessToken = await getAccessTokenFromServiceAccountJson(parsed);
         } catch(e) {}
      }

      if (providerType === 'vertex_agent') {
         models = ['reasoning-engine']; // Default agent ID placeholder
      } else {
         if (accessToken) {
            const endpoint = 'https://aiplatform.googleapis.com/v1beta1/publishers/google/models?view=PUBLISHER_MODEL_VIEW_BASIC&listAllVersions=true&pageSize=200';
            const response = await fetch(endpoint, {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (response.ok) {
              const data = await response.json();
              if (data.publisherModels) {
                models = data.publisherModels.map(m => m.name.replace('publishers/google/models/', ''));
              }
            }
         }
         if (models.length === 0) {
            models = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'];
         }
      }
    } else if (providerType === 'openai') {
      const url = baseUrl || 'https://api.openai.com/v1';
      const response = await fetch(`${url}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch OpenAI models');
      }
      models = data.data.map(m => m.id);
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported provider type' });
    }

    res.json({ success: true, data: { models } });
  } catch (error) {
    console.error('Error testing models:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// =============================================
// NEW: Provider Resource Loading endpoints
// Cho admin chọn model/agent/engine/servingConfig từ dropdown thay vì gõ tay
// =============================================

// POST /api/admin/ai/load-resources
// body: { providerType, apiKey?, baseUrl?, projectId?, location?,
//         collectionId?, engineId?, credentialsJson?, providerFormat? }
app.post('/api/admin/ai/load-resources', adminAuth, async (req, res) => {
  try {
    const { providerType, type } = req.body;
    if (!providerType) {
      return res.status(400).json({
        success: false,
        errorCode: 'UNSUPPORTED_PROVIDER',
        message: 'Thiếu providerType',
      });
    }
    const hydratedBody = await hydrateSavedSecretsForType({
      type,
      providerType,
      settings: req.body,
    });
    const result = await loadProviderResources(hydratedBody);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json({ success: true, items: result.items });
  } catch (error) {
    console.error('Error loading provider resources:', error);
    res.status(500).json({
      success: false,
      errorCode: 'NETWORK_ERROR',
      message: error.message || 'Lỗi không xác định',
    });
  }
});

// POST /api/admin/ai/load-secondary
// Load resources phụ thuộc (servingConfigs sau khi chọn engine, environments sau khi chọn agent)
// body: { providerType, resourceType, projectId?, location?, collectionId?, agentId?, engineId?, credentialsJson?, authToken? }
app.post('/api/admin/ai/load-secondary', adminAuth, async (req, res) => {
  try {
    const { providerType, resourceType } = req.body;
    if (!providerType || !resourceType) {
      return res.status(400).json({
        success: false,
        errorCode: 'UNSUPPORTED_PROVIDER',
        message: 'Thiếu providerType hoặc resourceType',
      });
    }
    const result = await loadSecondaryResources(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json({ success: true, items: result.items });
  } catch (error) {
    console.error('Error loading secondary resources:', error);
    res.status(500).json({
      success: false,
      errorCode: 'NETWORK_ERROR',
      message: error.message || 'Lỗi không xác định',
    });
  }
});

// Admin Telegram Settings API
app.get('/api/admin/telegram-settings', adminAuth, adminReadLimiter, (req, res) => {
  try {
    const settings = readTelegramSettings();
    const maskedSettings = { ...settings };
    if (maskedSettings.botToken && maskedSettings.botToken.length > 10) {
      maskedSettings.botToken = maskedSettings.botToken.substring(0, 5) + '********' + maskedSettings.botToken.slice(-4);
    }
    res.json({ success: true, data: maskedSettings });
  } catch (error) {
    console.error('Error getting Telegram settings:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

app.put('/api/admin/telegram-settings', adminAuth, (req, res) => {
  try {
    const newSettings = req.body;
    
    // Preserve if masked
    if (newSettings.botToken && newSettings.botToken.includes('********')) {
      const current = readTelegramSettings();
      newSettings.botToken = current.botToken;
    }

    writeTelegramSettings(newSettings);
    res.json({ success: true, message: 'Telegram settings updated successfully' });
  } catch (error) {
    console.error('Error updating Telegram settings:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

app.post('/api/admin/telegram-settings/test', adminAuth, async (req, res) => {
  try {
    const { botToken, defaultChannel } = req.body;
    let actualToken = botToken;
    
    if (botToken && botToken.includes('********')) {
      const current = readTelegramSettings();
      actualToken = current.botToken;
    }

    if (!actualToken || !defaultChannel) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đủ Token và Channel ID' });
    }

    // Temporary bot just for testing
    const TelegramBot = (await import('node-telegram-bot-api')).default;
    const testBot = new TelegramBot(actualToken, { polling: false });
    
    await testBot.sendMessage(defaultChannel, '✅ Đây là tin nhắn test từ hệ thống Admin.');
    
    res.json({ success: true, message: 'Đã gửi tin nhắn test thành công!' });
  } catch (error) {
    console.error('Error testing Telegram:', error);
    res.status(500).json({ success: false, message: error.message || 'Lỗi gửi tin nhắn' });
  }
});

// Marketplace routes. Admin sub-routes require admin authentication.
app.use('/api/admin', adminAuth, adminReadLimiter);
app.use('/api', marketplaceRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint không tồn tại'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Lỗi hệ thống'
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Init database
    await initDatabase();
    
    // Init marketplace tables
    await initMarketplaceTables();
    
    // Init Telegram bot
    initTelegramBot();
    
    // Start server
    app.listen(PORT, () => {
      console.log('=================================');
      console.log('🚀 Backend server running');
      console.log(`📡 Port: ${PORT}`);
      console.log(`🌐 Frontend: ${FRONTEND_URL}`);
      console.log(`📊 Health: http://localhost:${PORT}/api/health`);
      console.log('=================================');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
