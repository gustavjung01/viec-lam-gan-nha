/**
 * AI Resource Loader
 * Gọi API thật từ các provider để list models/agents/engines/servingConfigs/environments
 * cho admin chọn thay vì gõ tay.
 *
 * BẢO MẬT:
 * - Không log apiKey, credentialsJson, accessToken
 * - Không trả credentials về frontend
 * - Response chỉ chứa id, name, displayName, type, meta (location, token limit, supportedActions)
 */

const ERROR_CODES = {
  INVALID_CREDENTIALS: 'API key hoặc credentials không hợp lệ',
  PERMISSION_DENIED: 'Service account không có quyền truy cập resource',
  API_DISABLED: 'API chưa được enable trong Google Cloud Console',
  NOT_FOUND: 'Không tìm thấy resource nào',
  UNSUPPORTED_PROVIDER: 'Provider không hỗ trợ list models/agents/engines',
  NETWORK_ERROR: 'Không kết nối được provider',
};

// ============================================================
// Helper: Get access token from Service Account JSON
// Tái sử dụng pattern từ server.js
// ============================================================
let _tokenCache = { fingerprint: null, accessToken: null, expiresAtMs: 0 };

function base64UrlEncodeJson(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getAccessTokenFromServiceAccount(credentialsJson) {
  let credentials;
  try {
    credentials = typeof credentialsJson === 'string'
      ? JSON.parse(credentialsJson)
      : credentialsJson;
  } catch (e) {
    throw makeError('INVALID_CREDENTIALS', 'Credentials JSON không hợp lệ');
  }

  if (!credentials?.client_email || !credentials?.private_key) {
    throw makeError('INVALID_CREDENTIALS', 'Thiếu client_email hoặc private_key');
  }

  const crypto = await import('crypto');
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${credentials.client_email}::${credentials.private_key}::${credentials.token_uri || ''}`)
    .digest('hex');

  if (
    _tokenCache.fingerprint === fingerprint &&
    _tokenCache.accessToken &&
    Date.now() < _tokenCache.expiresAtMs
  ) {
    return _tokenCache.accessToken;
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
    .replace(/=+$/, '');
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw makeError('INVALID_CREDENTIALS', `Không lấy được access token: ${errText.slice(0, 100)}`);
  }

  const data = await response.json();
  if (!data?.access_token) {
    throw makeError('INVALID_CREDENTIALS', 'Response thiếu access_token');
  }

  const expiresInMs = Math.max(60, Number(data.expires_in || 3600) - 60) * 1000;
  _tokenCache = {
    fingerprint,
    accessToken: data.access_token,
    expiresAtMs: Date.now() + expiresInMs,
  };

  return data.access_token;
}

function makeError(code, message) {
  const err = new Error(message);
  err.errorCode = code;
  return err;
}

function extractProjectId(credentialsJson) {
  try {
    const parsed = typeof credentialsJson === 'string'
      ? JSON.parse(credentialsJson)
      : credentialsJson;
    return parsed?.project_id || null;
  } catch {
    return null;
  }
}

// ============================================================
// 1. Gemini API / Gemini Studio
// ============================================================
async function loadGeminiModels({ apiKey }) {
  if (!apiKey) throw makeError('INVALID_CREDENTIALS', 'Thiếu API Key');

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  let response;
  try {
    response = await fetch(url);
  } catch (e) {
    throw makeError('NETWORK_ERROR', 'Không kết nối được Gemini API');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 400 || response.status === 403) {
      throw makeError('INVALID_CREDENTIALS', data?.error?.message || 'API Key không hợp lệ');
    }
    throw makeError('NETWORK_ERROR', data?.error?.message || 'Lỗi Gemini API');
  }

  const models = (data.models || [])
    .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .filter(m => m.name?.includes('gemini'))
    .map(m => {
      const id = m.name.replace('models/', '');
      return {
        id,
        name: id,
        displayName: m.displayName || id,
        type: 'model',
        meta: {
          inputTokenLimit: m.inputTokenLimit,
          outputTokenLimit: m.outputTokenLimit,
          supportedGenerationMethods: m.supportedGenerationMethods,
        },
      };
    });

  if (models.length === 0) {
    throw makeError('NOT_FOUND', 'Không tìm thấy Gemini model nào hỗ trợ generateContent');
  }
  return models;
}

// ============================================================
// 2. Vertex AI Gemini (Publisher Models)
// ============================================================
async function loadVertexModels({ projectId, location, credentialsJson, authToken }) {
  let accessToken = authToken;
  const proj = projectId || extractProjectId(credentialsJson);

  if (credentialsJson && credentialsJson.trim().startsWith('{')) {
    try {
      accessToken = await getAccessTokenFromServiceAccount(credentialsJson);
    } catch (e) {
      throw e;
    }
  }

  if (!accessToken) {
    throw makeError('INVALID_CREDENTIALS', 'Thiếu Credentials JSON hoặc Auth Token');
  }
  if (!proj) {
    throw makeError('INVALID_CREDENTIALS', 'Thiếu Project ID');
  }

  const loc = location || 'us-central1';
  const endpoint = `https://${loc}-aiplatform.googleapis.com/v1/projects/${proj}/locations/${loc}/publishers/google/models?view=PUBLISHER_MODEL_VIEW_BASIC&pageSize=200`;

  let response;
  try {
    response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    throw makeError('NETWORK_ERROR', 'Không kết nối được Vertex AI');
  }

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 403) {
      if (errText.includes('API has not been used') || errText.includes('disabled')) {
        throw makeError('API_DISABLED', 'Vertex AI API chưa enable trong project');
      }
      throw makeError('PERMISSION_DENIED', 'Service account không có quyền');
    }
    if (response.status === 404) {
      throw makeError('NOT_FOUND', `Project ${proj} không tìm thấy`);
    }
    throw makeError('NETWORK_ERROR', `Vertex API lỗi ${response.status}`);
  }

  const data = await response.json();
  const models = (data.publisherModels || [])
    .filter(m => m.name?.includes('gemini') || m.name?.includes('claude') || m.name?.includes('llama'))
    .map(m => {
      const id = m.name.replace(`publishers/google/models/`, '');
      return {
        id,
        name: id,
        displayName: m.displayName || id,
        type: 'model',
        meta: {
          launchStage: m.launchStage,
          supportedActions: m.publisherModelView?.publisherModelActions || [],
        },
      };
    });

  if (models.length === 0) {
    throw makeError('NOT_FOUND', 'Không tìm thấy generative model nào trong region này');
  }
  return models;
}

// ============================================================
// 3. Claude API (Anthropic chính hãng hoặc OpenAI-compat)
// ============================================================
async function loadClaudeModels({ apiKey, baseUrl, providerFormat }) {
  if (!apiKey) throw makeError('INVALID_CREDENTIALS', 'Thiếu API Key');

  // Nếu là OpenAI-compatible
  if (providerFormat === 'openai_compatible' || baseUrl) {
    return await loadOpenAICompatModels({ apiKey, baseUrl: baseUrl || 'https://api.openai.com/v1' });
  }

  // Anthropic chính hãng: API list models chưa stable → trả lỗi mềm
  // (admin sẽ nhập tay theo whitelist phổ biến)
  throw makeError(
    'UNSUPPORTED_PROVIDER',
    'Anthropic API chưa hỗ trợ list models công khai. Vui lòng nhập Model ID thủ công (claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022, claude-3-opus-20240229).'
  );
}

// ============================================================
// 4. OpenAI-compatible (bên thứ ba hoặc OpenAI)
// ============================================================
async function loadOpenAICompatModels({ apiKey, baseUrl }) {
  if (!apiKey) throw makeError('INVALID_CREDENTIALS', 'Thiếu API Key');

  // Normalize baseUrl: tránh double /v1/v1, /v1/models, /models
  let url = (baseUrl || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');

  // Nếu baseUrl chưa có /v1, thử /v1/models trước
  if (!url.endsWith('/v1') && !url.includes('/v1/')) {
    // Thử /v1/models
    const testUrl1 = `${url}/v1/models`;
    const r1 = await safeFetch(testUrl1, apiKey);
    if (r1.ok) {
      const data = await r1.json();
      return normalizeOpenAIModels(data);
    }
    // Thử /models
    const testUrl2 = `${url}/models`;
    const r2 = await safeFetch(testUrl2, apiKey);
    if (r2.ok) {
      const data = await r2.json();
      return normalizeOpenAIModels(data);
    }
    throw makeError('NOT_FOUND', 'Base URL không trả về danh sách models');
  } else {
    // Đã có /v1 rồi
    url = url.replace(/\/v1$/, '');
    const modelsUrl = `${url}/v1/models`;
    const response = await safeFetch(modelsUrl, apiKey);
    if (!response.ok) {
      throw makeError('INVALID_CREDENTIALS', `Models endpoint trả về ${response.status}`);
    }
    const data = await response.json();
    return normalizeOpenAIModels(data);
  }
}

async function safeFetch(url, apiKey) {
  try {
    return await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (e) {
    throw makeError('NETWORK_ERROR', `Không kết nối được ${url}`);
  }
}

function normalizeOpenAIModels(data) {
  const raw = data?.data || data?.models || [];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw makeError('NOT_FOUND', 'Provider không trả về danh sách models');
  }
  const models = raw
    .filter(m => m.id || m.name)
    .map(m => ({
      id: m.id || m.name,
      name: m.id || m.name,
      displayName: m.display_name || m.displayName || m.id || m.name,
      type: 'model',
      meta: {
        ownedBy: m.owned_by || m.ownedBy,
      },
    }));
  return models;
}

// ============================================================
// 5. Dialogflow CX / Conversational Agents
// ============================================================
async function loadDialogflowAgents({ projectId, location, credentialsJson, authToken }) {
  let accessToken = authToken;
  const proj = projectId || extractProjectId(credentialsJson);

  if (credentialsJson && credentialsJson.trim().startsWith('{')) {
    accessToken = await getAccessTokenFromServiceAccount(credentialsJson);
  }

  if (!accessToken) throw makeError('INVALID_CREDENTIALS', 'Thiếu Credentials JSON');
  if (!proj) throw makeError('INVALID_CREDENTIALS', 'Thiếu Project ID');

  const loc = location || 'global';
  const endpoint = `https://${loc === 'global' ? 'dialogflow' : loc + '-dialogflow'}.googleapis.com/v3/projects/${proj}/locations/${loc}/agents`;

  let response;
  try {
    response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    throw makeError('NETWORK_ERROR', 'Không kết nối được Dialogflow');
  }

  if (!response.ok) {
    if (response.status === 403) {
      throw makeError('PERMISSION_DENIED', 'Service account không có quyền Dialogflow');
    }
    if (response.status === 404) {
      throw makeError('NOT_FOUND', 'Không tìm thấy agent nào');
    }
    throw makeError('NETWORK_ERROR', `Dialogflow lỗi ${response.status}`);
  }

  const data = await response.json();
  const agents = (data.agents || []).map(a => {
    // Resource name: projects/{p}/locations/{l}/agents/{agentId}
    const parts = a.name.split('/');
    const agentId = parts[parts.length - 1];
    return {
      id: agentId,
      name: agentId,
      displayName: a.displayName || agentId,
      type: 'agent',
      meta: {
        defaultLanguageCode: a.defaultLanguageCode || 'vi',
        supportedLanguageCodes: a.supportedLanguageCodes || [],
        timeZone: a.timeZone,
        description: a.description,
      },
    };
  });

  if (agents.length === 0) {
    throw makeError('NOT_FOUND', 'Không tìm thấy agent nào trong project này');
  }
  return agents;
}

async function loadDialogflowEnvironments({ projectId, location, agentId, credentialsJson, authToken }) {
  let accessToken = authToken;
  const proj = projectId || extractProjectId(credentialsJson);

  if (credentialsJson && credentialsJson.trim().startsWith('{')) {
    accessToken = await getAccessTokenFromServiceAccount(credentialsJson);
  }

  if (!accessToken || !proj || !agentId) {
    throw makeError('INVALID_CREDENTIALS', 'Thiếu credentials hoặc agentId');
  }

  const loc = location || 'global';
  const endpoint = `https://${loc === 'global' ? 'dialogflow' : loc + '-dialogflow'}.googleapis.com/v3/projects/${proj}/locations/${loc}/agents/${agentId}/environments`;

  let response;
  try {
    response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    throw makeError('NETWORK_ERROR', 'Không kết nối được Dialogflow');
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw makeError('NOT_FOUND', 'Agent này chưa có environment nào');
    }
    throw makeError('NETWORK_ERROR', `Lỗi ${response.status}`);
  }

  const data = await response.json();
  const envs = (data.environments || []).map(e => {
    const parts = e.name.split('/');
    const envId = parts[parts.length - 1];
    return {
      id: envId,
      name: envId,
      displayName: e.displayName || envId,
      type: 'environment',
      meta: {
        description: e.description,
        agentVersion: e.agentVersion,
      },
    };
  });

  if (envs.length === 0) {
    throw makeError('NOT_FOUND', 'Agent chưa có environment');
  }
  return envs;
}

// ============================================================
// 6. Agent Builder / Vertex AI Search / Discovery Engine
// ============================================================
async function loadAgentBuilderEngines({ projectId, location, collectionId, credentialsJson, authToken }) {
  let accessToken = authToken;
  const proj = projectId || extractProjectId(credentialsJson);

  if (credentialsJson && credentialsJson.trim().startsWith('{')) {
    accessToken = await getAccessTokenFromServiceAccount(credentialsJson);
  }

  if (!accessToken) throw makeError('INVALID_CREDENTIALS', 'Thiếu Credentials JSON');
  if (!proj) throw makeError('INVALID_CREDENTIALS', 'Thiếu Project ID');

  const loc = location || 'global';
  const coll = collectionId || 'default_collection';
  const endpoint = `https://${loc === 'global' ? 'discoveryengine' : loc + '-discoveryengine'}.googleapis.com/v1/projects/${proj}/locations/${loc}/collections/${coll}/engines`;

  let response;
  try {
    response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    throw makeError('NETWORK_ERROR', 'Không kết nối được Discovery Engine');
  }

  if (!response.ok) {
    if (response.status === 403) {
      throw makeError('PERMISSION_DENIED', 'Service account không có quyền Discovery Engine');
    }
    if (response.status === 404) {
      throw makeError('NOT_FOUND', 'Không tìm thấy engine nào');
    }
    throw makeError('NETWORK_ERROR', `Lỗi ${response.status}`);
  }

  const data = await response.json();
  const engines = (data.engines || []).map(e => {
    // Resource name: projects/{p}/locations/{l}/collections/{c}/engines/{engineId}
    const parts = e.name.split('/');
    const engineId = parts[parts.length - 1];
    return {
      id: engineId,
      name: engineId,
      displayName: e.displayName || engineId,
      type: 'engine',
      meta: {
        solutionType: e.solutionType,
        industryVertical: e.industryVertical,
        description: e.description,
      },
    };
  });

  if (engines.length === 0) {
    throw makeError('NOT_FOUND', 'Không tìm thấy engine nào trong collection này');
  }
  return engines;
}

async function loadAgentBuilderServingConfigs({ projectId, location, collectionId, engineId, credentialsJson, authToken }) {
  let accessToken = authToken;
  const proj = projectId || extractProjectId(credentialsJson);

  if (credentialsJson && credentialsJson.trim().startsWith('{')) {
    accessToken = await getAccessTokenFromServiceAccount(credentialsJson);
  }

  if (!accessToken || !proj || !engineId) {
    throw makeError('INVALID_CREDENTIALS', 'Thiếu credentials hoặc engineId');
  }

  const loc = location || 'global';
  const coll = collectionId || 'default_collection';
  const endpoint = `https://${loc === 'global' ? 'discoveryengine' : loc + '-discoveryengine'}.googleapis.com/v1/projects/${proj}/locations/${loc}/collections/${coll}/engines/${engineId}/servingConfigs`;

  let response;
  try {
    response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    throw makeError('NETWORK_ERROR', 'Không kết nối được Discovery Engine');
  }

  if (!response.ok) {
    if (response.status === 404) {
      // 404 thường = engine chỉ có default_config, cho nhập tay
      throw makeError('NOT_FOUND', 'Không load được serving configs. Thử dùng "default_config" hoặc nhập tay.');
    }
    throw makeError('NETWORK_ERROR', `Lỗi ${response.status}`);
  }

  const data = await response.json();
  const configs = (data.servingConfigs || []).map(c => {
    const parts = c.name.split('/');
    const configId = parts[parts.length - 1];
    return {
      id: configId,
      name: configId,
      displayName: c.displayName || configId,
      type: 'servingConfig',
      meta: {
        solutionType: c.solutionType,
      },
    };
  });

  if (configs.length === 0) {
    throw makeError('NOT_FOUND', 'Engine chưa có serving config nào');
  }
  return configs;
}

// ============================================================
// Main dispatcher
// ============================================================
export async function loadProviderResources({ providerType, ...params }) {
  try {
    let items;
    switch (providerType) {
      case 'gemini_api':
        items = await loadGeminiModels(params);
        break;
      case 'vertex_ai':
        items = await loadVertexModels(params);
        break;
      case 'claude_api':
        items = await loadClaudeModels(params);
        break;
      case 'openai':
        items = await loadOpenAICompatModels(params);
        break;
      case 'dialogflow':
        items = await loadDialogflowAgents(params);
        break;
      case 'agent_builder':
        items = await loadAgentBuilderEngines(params);
        break;
      default:
        throw makeError('UNSUPPORTED_PROVIDER', `Provider ${providerType} chưa hỗ trợ Load`);
    }
    return { success: true, items };
  } catch (err) {
    return {
      success: false,
      errorCode: err.errorCode || 'NETWORK_ERROR',
      message: err.message || 'Lỗi không xác định',
    };
  }
}

export async function loadSecondaryResources({ providerType, resourceType, ...params }) {
  try {
    let items;
    if (providerType === 'dialogflow' && resourceType === 'environments') {
      items = await loadDialogflowEnvironments(params);
    } else if (providerType === 'agent_builder' && resourceType === 'servingConfigs') {
      items = await loadAgentBuilderServingConfigs(params);
    } else {
      throw makeError('UNSUPPORTED_PROVIDER', `Resource type ${resourceType} không hỗ trợ`);
    }
    return { success: true, items };
  } catch (err) {
    return {
      success: false,
      errorCode: err.errorCode || 'NETWORK_ERROR',
      message: err.message || 'Lỗi không xác định',
    };
  }
}

export const PROVIDER_ERROR_CODES = ERROR_CODES;
