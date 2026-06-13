"""
Migration: Move web-support-config.json to ai_configs table
Run on VPS: python3 migrate_ai_config.py
"""
import json
import sqlite3
import os
from datetime import datetime

DATA_DIR = '/var/www/viec-lam-gan-nha/backend/data'
DB_PATH = os.path.join(DATA_DIR, 'applications.db')
CONFIG_PATH = os.path.join(DATA_DIR, 'web-support-config.json')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check if table exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_configs'")
    if not cursor.fetchone():
        print('ERROR: ai_configs table does not exist')
        return

    # Check if already migrated
    cursor.execute("SELECT COUNT(*) FROM ai_configs")
    if cursor.fetchone()[0] > 0:
        print('Already migrated, skipping')
        conn.close()
        return

    # Read existing config
    old_config = {
        'providerType': 'none', 'baseUrl': '', 'apiKey': '',
        'authToken': '', 'credentialsJson': '', 'model': '', 'systemPrompt': ''
    }
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                old_config = json.load(f)
            print(f'Loaded config: providerType={old_config.get("providerType")}')
        except Exception as e:
            print(f'Could not parse config: {e}')

    config_json = json.dumps({
        'baseUrl': old_config.get('baseUrl', ''),
        'model': old_config.get('model', ''),
        'apiKey': old_config.get('apiKey', ''),
        'authToken': old_config.get('authToken', ''),
        'credentialsJson': old_config.get('credentialsJson', ''),
        'systemPrompt': old_config.get('systemPrompt', '')
    }, ensure_ascii=False)

    rules = 'Chỉ tư vấn việc làm bảo vệ và lao động phổ thông trên web. Không tư vấn các công việc khác.'

    # Map provider type
    pt = old_config.get('providerType', 'none')
    if pt in ('vertex', 'vertex_agent'):
        provider_type = 'vertex_ai'
    elif pt == 'gemini':
        provider_type = 'gemini_api'
    elif pt == 'openai':
        provider_type = 'claude_api'
    else:
        provider_type = 'none'

    status = 'active' if pt and pt != 'none' else 'inactive'
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # Insert chatbot_main
    cursor.execute("""
        INSERT INTO ai_configs (id, name, type, provider_type, config_json, rules, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ('chatbot_main', 'VLGN Chat Agent', 'chatbot_main', provider_type, config_json, rules, status, now, now))
    print(f'Inserted chatbot_main (provider={provider_type}, status={status})')

    # Insert placeholders
    cursor.execute("""
        INSERT INTO ai_configs (id, name, type, provider_type, config_json, rules, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ('chatbot_fallback', 'VLGN Chat Agent - Dự phòng', 'chatbot_fallback', 'none',
          '{}', 'Chỉ chạy khi AI chính không trả lời được.', 'inactive', now, now))
    print('Inserted chatbot_fallback placeholder')

    cursor.execute("""
        INSERT INTO ai_configs (id, name, type, provider_type, config_json, rules, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, ('cv_analyzer', 'VLGN CV Agent', 'cv_analyzer', 'none',
          '{}', 'Chỉ chạy khi admin/công ty bấm nút Phân tích hồ sơ. Không chạy trong chatbot website.', 'inactive', now, now))
    print('Inserted cv_analyzer placeholder')

    conn.commit()
    cursor.execute("SELECT id, name, type, provider_type, status FROM ai_configs")
    for row in cursor.fetchall():
        print(f'  {row}')
    conn.close()
    print('Migration complete!')

if __name__ == '__main__':
    migrate()