-- Migration: Insert existing chatbot config into ai_configs table
-- Run AFTER add_ai_configs.sql

-- Insert existing Vertex AI chatbot as chatbot_main
INSERT OR REPLACE INTO ai_configs (id, name, type, provider_type, config_json, rules, status, created_at, updated_at)
VALUES (
  'chatbot_main_vertex',
  'VLGN Chat Agent',
  'chatbot_main',
  'vertex_ai',
  json_object(
    'baseUrl', 'https://us-central1-aiplatform.googleapis.com/v1/projects/agent-498013/locations/us-central1/publishers/google/models/',
    'model', 'gemini-2.5-flash',
    'authToken', '@Binh2401',
    'credentialsJson', '{"type":"service_account","project_id":"agent-498013",...}',
    'systemPrompt', '1. Vai trò của bạn:\nBạn là chuyên viên điều phối nhân sự thực chiến...'
  ),
  'Chỉ tư vấn việc làm bảo vệ và lao động phổ thông trên web. Không tư vấn các công việc khác.',
  'active',
  datetime('now'),
  datetime('now')
);

-- Insert placeholder for chatbot_fallback (inactive)
INSERT OR IGNORE INTO ai_configs (id, name, type, provider_type, config_json, rules, status)
VALUES (
  'chatbot_fallback',
  'VLGN Chat Agent - Dự phòng',
  'chatbot_fallback',
  'none',
  '{}',
  'Chỉ chạy khi AI chính không trả lời được.',
  'inactive'
);

-- Insert placeholder for cv_analyzer (inactive)
INSERT OR IGNORE INTO ai_configs (id, name, type, provider_type, config_json, rules, status)
VALUES (
  'cv_analyzer',
  'VLGN CV Agent',
  'cv_analyzer',
  'none',
  '{}',
  'Chỉ chạy khi admin/công ty bấm nút Phân tích hồ sơ. Không chạy trong chatbot website.',
  'inactive'
);