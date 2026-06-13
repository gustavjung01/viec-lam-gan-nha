/**
 * Migration script: Move web-support-config.json to ai_configs table
 * Run once to migrate existing data to new schema
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'applications.db');
const CONFIG_PATH = path.join(DATA_DIR, 'web-support-config.json');

function migrate() {
  const db = Database(DB_PATH);

  // Check if table exists
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_configs'").get();
  if (!tableExists) {
    console.error('ERROR: ai_configs table does not exist. Run add_ai_configs.sql first.');
    process.exit(1);
  }

  // Check if already migrated
  const existing = db.prepare("SELECT COUNT(*) as count FROM ai_configs").get();
  if (existing.count > 0) {
    console.log(`Already migrated: ${existing.count} configs found. Skipping.`);
    process.exit(0);
  }

  // Read existing config
  let oldConfig = { providerType: 'none', baseUrl: '', apiKey: '', authToken: '', credentialsJson: '', model: '', systemPrompt: '' };
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      oldConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      console.log('Loaded existing config from web-support-config.json');
    } catch (e) {
      console.warn('Could not parse config file, starting fresh:', e.message);
    }
  } else {
    console.log('No existing config file found, starting fresh.');
  }

  const configJson = JSON.stringify({
    baseUrl: oldConfig.baseUrl || '',
    model: oldConfig.model || '',
    apiKey: oldConfig.apiKey || '',
    authToken: oldConfig.authToken || '',
    credentialsJson: oldConfig.credentialsJson || '',
    systemPrompt: oldConfig.systemPrompt || ''
  });

  const rules = 'Chỉ tư vấn việc làm bảo vệ và lao động phổ thông trên web. Không tư vấn các công việc khác.';

  const status = oldConfig.providerType && oldConfig.providerType !== 'none' ? 'active' : 'inactive';

  // Map providerType to new format
  let providerType = 'none';
  if (oldConfig.providerType === 'vertex' || oldConfig.providerType === 'vertex_agent') {
    providerType = 'vertex_ai';
  } else if (oldConfig.providerType === 'gemini') {
    providerType = 'gemini_api';
  } else if (oldConfig.providerType === 'openai') {
    providerType = 'claude_api'; // Map openai to claude_api as closest match
  }

  // Insert chatbot_main
  db.prepare(`
    INSERT INTO ai_configs (id, name, type, provider_type, config_json, rules, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run('chatbot_main', 'VLGN Chat Agent', 'chatbot_main', providerType, configJson, rules, status);

  console.log('Inserted chatbot_main config');

  // Insert chatbot_fallback placeholder
  db.prepare(`
    INSERT INTO ai_configs (id, name, type, provider_type, config_json, rules, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('chatbot_fallback', 'VLGN Chat Agent - Dự phòng', 'chatbot_fallback', 'none', '{}',
    'Chỉ chạy khi AI chính không trả lời được.', 'inactive');

  console.log('Inserted chatbot_fallback placeholder');

  // Insert cv_analyzer placeholder
  db.prepare(`
    INSERT INTO ai_configs (id, name, type, provider_type, config_json, rules, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('cv_analyzer', 'VLGN CV Agent', 'cv_analyzer', 'none', '{}',
    'Chỉ chạy khi admin/công ty bấm nút Phân tích hồ sơ. Không chạy trong chatbot website.', 'inactive');

  console.log('Inserted cv_analyzer placeholder');

  // Verify
  const count = db.prepare("SELECT COUNT(*) as count FROM ai_configs").get();
  console.log(`Migration complete: ${count.count} configs in table`);

  db.close();
}

migrate();