/**
 * AI Configs CRUD operations using sqlite3 (pure JS, promise-based)
 */
import sqlite3 from 'sqlite3';
import { DB_PATH } from './database.js';

let _db = null;

function getDb() {
  if (!_db) {
    _db = new sqlite3.Database(DB_PATH);
  }
  return _db;
}

function promisifyQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function promisifyGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function promisifyRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes });
    });
  });
}

export async function getAllAiConfigs() {
  return await promisifyQuery(`
    SELECT id, name, type, provider_type, config_json, rules, status, error_reason, created_at, updated_at
    FROM ai_configs ORDER BY created_at ASC
  `);
}

export async function getAiConfigById(id) {
  return await promisifyGet(`
    SELECT id, name, type, provider_type, config_json, rules, status, error_reason, created_at, updated_at
    FROM ai_configs WHERE id = ?
  `, [id]);
}

export async function getAiConfigsByType(type) {
  return await promisifyQuery(`
    SELECT id, name, type, provider_type, config_json, rules, status, error_reason, created_at, updated_at
    FROM ai_configs WHERE type = ? ORDER BY created_at ASC
  `, [type]);
}

export async function getActiveChatbotConfig() {
  return await promisifyGet(`
    SELECT id, name, type, provider_type, config_json, rules, status, error_reason
    FROM ai_configs WHERE type = 'chatbot_main' AND status = 'active' LIMIT 1
  `);
}

export async function getFallbackChatbotConfig() {
  return await promisifyGet(`
    SELECT id, name, type, provider_type, config_json, rules, status, error_reason
    FROM ai_configs WHERE type = 'chatbot_fallback' AND status = 'active' LIMIT 1
  `);
}

export async function createAiConfig(data) {
  const { id, name, type, provider_type, config_json, rules, status } = data;
  const now = new Date().toISOString();
  await promisifyRun(`
    INSERT INTO ai_configs (id, name, type, provider_type, config_json, rules, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, name, type, provider_type, config_json, rules || '', status || 'inactive', now, now]);
  return await getAiConfigById(id);
}

export async function updateAiConfig(id, data) {
  const { name, provider_type, config_json, rules, status, error_reason } = data;
  const now = new Date().toISOString();
  const result = await promisifyRun(`
    UPDATE ai_configs
    SET name = COALESCE(?, name),
        provider_type = COALESCE(?, provider_type),
        config_json = COALESCE(?, config_json),
        rules = COALESCE(?, rules),
        status = COALESCE(?, status),
        error_reason = ?,
        updated_at = ?
    WHERE id = ?
  `, [name, provider_type, config_json, rules, status, error_reason || null, now, id]);
  return result.changes > 0;
}

export async function deleteAiConfig(id) {
  const result = await promisifyRun('DELETE FROM ai_configs WHERE id = ?', [id]);
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
