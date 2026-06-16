/**
 * AI Configs CRUD operations using the shared DB adapter.
 */
import { openDb } from './database.js';

async function withDb(fn) {
  const db = await openDb();
  try {
    return await fn(db);
  } finally {
    await db.close();
  }
}

export async function getAllAiConfigs() {
  return await withDb((db) => db.all(`
    SELECT id, name, type, provider_type, config_json, rules, status, error_reason, created_at, updated_at
    FROM ai_configs ORDER BY created_at ASC
  `));
}

export async function getAiConfigById(id) {
  return await withDb((db) => db.get(`
    SELECT id, name, type, provider_type, config_json, rules, status, error_reason, created_at, updated_at
    FROM ai_configs WHERE id = ?
  `, [id]));
}

export async function getAiConfigsByType(type) {
  return await withDb((db) => db.all(`
    SELECT id, name, type, provider_type, config_json, rules, status, error_reason, created_at, updated_at
    FROM ai_configs WHERE type = ? ORDER BY created_at ASC
  `, [type]));
}

export async function getActiveChatbotConfig() {
  return await withDb((db) => db.get(`
    SELECT id, name, type, provider_type, config_json, rules, status, error_reason
    FROM ai_configs WHERE type = 'chatbot_main' AND status = 'active' LIMIT 1
  `));
}

export async function getFallbackChatbotConfig() {
  return await withDb((db) => db.get(`
    SELECT id, name, type, provider_type, config_json, rules, status, error_reason
    FROM ai_configs WHERE type = 'chatbot_fallback' AND status = 'active' LIMIT 1
  `));
}

export async function createAiConfig(data) {
  const { id, name, type, provider_type, config_json, rules, status } = data;
  const now = new Date().toISOString();
  await withDb((db) => db.run(`
    INSERT INTO ai_configs (id, name, type, provider_type, config_json, rules, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, name, type, provider_type, config_json, rules || '', status || 'inactive', now, now]));
  return await getAiConfigById(id);
}

export async function updateAiConfig(id, data) {
  const { name, provider_type, config_json, rules, status, error_reason } = data;
  const now = new Date().toISOString();
  const result = await withDb((db) => db.run(`
    UPDATE ai_configs
    SET name = COALESCE(?, name),
        provider_type = COALESCE(?, provider_type),
        config_json = COALESCE(?, config_json),
        rules = COALESCE(?, rules),
        status = COALESCE(?, status),
        error_reason = ?,
        updated_at = ?
    WHERE id = ?
  `, [name, provider_type, config_json, rules, status, error_reason || null, now, id]));
  return result.changes > 0;
}

export async function deleteAiConfig(id) {
  const result = await withDb((db) => db.run('DELETE FROM ai_configs WHERE id = ?', [id]));
  return result.changes > 0;
}

export function maskSensitiveConfig(config) {
  if (!config || !config.config_json) return config;
  try {
    const parsed = JSON.parse(config.config_json);
    if (parsed.apiKey && parsed.apiKey.length > 8) {
      parsed.apiKey = 'sk-********' + parsed.apiKey.slice(-4);
    }
    if (parsed.authToken && parsed.authToken.length > 8) {
      parsed.authToken = 'tk-********' + parsed.authToken.slice(-4);
    }
    if (parsed.credentialsJson) {
      parsed.credentialsJson = '{...masked...}';
    }
    return { ...config, config_json: JSON.stringify(parsed) };
  } catch {
    return config;
  }
}

export function unmaskForSave(maskedData, currentData) {
  if (!currentData) return maskedData;
  try {
    const masked = JSON.parse(maskedData.config_json || '{}');
    const current = JSON.parse(currentData.config_json || '{}');
    const merged = { ...current, ...masked };
    if (masked.apiKey && masked.apiKey.startsWith('sk-********')) {
      merged.apiKey = current.apiKey;
    }
    if (masked.authToken && masked.authToken.startsWith('tk-********')) {
      merged.authToken = current.authToken;
    }
    if (masked.credentialsJson === '{...masked...}') {
      merged.credentialsJson = current.credentialsJson;
    }
    return { ...maskedData, config_json: JSON.stringify(merged) };
  } catch {
    return maskedData;
  }
}
