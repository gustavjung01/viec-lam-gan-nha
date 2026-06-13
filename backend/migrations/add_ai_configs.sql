-- Migration: Add ai_configs table for multi-AI configuration
-- Run this once

CREATE TABLE IF NOT EXISTS ai_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('chatbot_main', 'chatbot_fallback', 'cv_analyzer')),
  provider_type TEXT NOT NULL CHECK(provider_type IN ('dialogflow', 'gemini_api', 'claude_api', 'vertex_ai', 'agent_builder', 'none')),
  config_json TEXT NOT NULL DEFAULT '{}',
  rules TEXT DEFAULT '',
  status TEXT DEFAULT 'inactive' CHECK(status IN ('active', 'inactive', 'error')),
  error_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_configs_type ON ai_configs(type);
CREATE INDEX IF NOT EXISTS idx_ai_configs_status ON ai_configs(status);