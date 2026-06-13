const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const ROOT = process.cwd();
const DEFAULT_SOURCE = path.join(ROOT, '_local_data', 'datacty', '_standardized', 'seed_jobs.normalized.json');
const REPORT_PATH = path.join(ROOT, '_local_data', 'datacty', '_standardized', 'import_seed_jobs.plan.md');

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key] = value || true;
  return acc;
}, {});

const DRY_RUN = args['--dry-run'];
const DB_PATH = args['--db'];
const SOURCE_PATH = args['--source'] || DEFAULT_SOURCE;
const APPLY = args['--apply'];
const REMOVE_BATCH = args['--remove-seed-batch'];

async function main() {
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(`Source file not found: ${SOURCE_PATH}`); vCần xử lý thêm 2 việc:

A. AI vẫn lỗi provider

Trên AccountPage, tôi test:

* “Nên mua gói nào?”
* “xin chào”

Đều trả:
Lỗi: Internal server error calling AI provider.

Yêu cầu kiểm tra nhưng KHÔNG in secret/key/token:

1. Kiểm tra service VPS có nhận đủ env không:

* AI_ENABLED
* AI_PROVIDER
* AI_BASE_URL
* AI_API_KEY
* AI_MODEL_FAST
* AI_TIMEOUT_MS
* AI_SEND_EMPTY_TOOLS

Chỉ báo có/không. Không in API key. Với AI_BASE_URL chỉ được báo host nếu an toàn, không báo full URL nếu có path/token.

2. Kiểm tra:

* /opt/hochungkhoi-backend/.env có AI_API_KEY chưa
* systemd service hochungkhoi-api có load đúng EnvironmentFile không
* sau khi sửa env đã restart service chưa
* AI_BASE_URL có bị thiếu https:// không
* AI_BASE_URL có bị dư /chat/completions không, vì code đã tự nối thêm /chat/completions
* AI_MODEL_FAST có đúng model provider hỗ trợ không
* VPS gọi outbound tới host provider được không
* provider có yêu cầu header khác không

3. Nếu cần debug code tạm, chỉ log an toàn:

* error.name
* error.code
* error.cause?.code
* HTTP status nếu có
* host của AI_BASE_URL
  Không log:
* AI_API_KEY
* Authorization header
* full base URL
* full prompt
* full response body

Nếu chưa tìm ra nhanh thì tắt AI_ENABLED=false lại, restart service, rồi báo.

B. Fix UI 2 nút chat chồng chéo

Hiện ở góc phải dưới có 2 floating buttons bị chồng nhau:

* nút Hỗ trợ nhanh cũ
* nút AI chat mới trong AccountPage

Yêu cầu sửa UI:

1. Không để 2 nút nổi chồng lên nhau.
2. Trên AccountPage, ưu tiên chỉ hiện AI chat hoặc đặt AI chat lệch lên/trái rõ ràng.
3. Tốt nhất: nếu đang ở AccountPage thì ẩn widget “Hỗ trợ nhanh” cũ, chỉ hiện “Trợ lý Học Chung Khối”.
4. Nếu chưa dễ ẩn theo route/page thì chỉnh vị trí:

   * Hỗ trợ nhanh giữ bottom/right mặc định
   * AI chat đặt bottom: 90px hoặc left/right khác để không đè lên
5. Khi AI widget mở ra, bubble đóng/mở không được nằm đè lên khung chat.
6. Mobile/desktop đều phải nhìn gọn.

Sau sửa:

* npm run build
* Nếu pass thì commit local:
  Fix overlapping support and AI chat widgets

Không push nếu chưa được yêu cầu.
Không deploy nếu chưa báo.

Báo cáo cuối:

* Nguyên nhân lỗi AI provider là gì
* AI_ENABLED cuối cùng true hay false
* Đã sửa UI chồng nút bằng cách nào
* Files changed
* Build result
* Commit hash nếu có
* Chưa push, chưa deploy

  }

  const db = DB_PATH ? await open({ filename: DB_PATH, driver: sqlite3.Database }) : null;

  const seedJobs = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const categoryCounts = {};

  const company = {
    id: 'comp_vieclamgannha_me',
    company_code: 'VIECLAMGANNHA_ME',
    name: 'VIECLAMGANNHA.ME',
    status: 'active'
  };

  if (db && !DRY_RUN && APPLY) {
    const existingCompany = await db.get('SELECT * FROM companies WHERE id = ?', company.id);
    if (!existingCompany) {
      await db.run('INSERT INTO companies (id, company_code, name, status) VALUES (?, ?, ?, ?)', [
        company.id, company.company_code, company.name, company.status
      ]);
    }
  }

  for (const job of seedJobs) {
    if (job.is_seed_job && job.source_type === 'seed_intake' && job.campaign_code.startsWith('SEED-')) {
      categoryCounts[job.category] = (categoryCounts[job.category] || 0) + 1;

      if (db) {
        const existing = await db.get('SELECT * FROM campaigns WHERE campaign_code = ?', job.campaign_code);
        if (existing) {
          if (!existing.is_seed_job) {
            skipped++;
            continue;
          }
          if (!DRY_RUN && APPLY) {
            await db.run('UPDATE campaigns SET title = ?, description = ?, salary_text = ?, requirements = ?, benefits = ?, updated_at = CURRENT_TIMESTAMP WHERE campaign_code = ?', 
              [job.title, job.description, job.salary_text, job.requirements, job.benefits, job.campaign_code]);
          }
          updated++;
        } else {
          if (!DRY_RUN && APPLY) {
            const id = `camp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            await db.run('INSERT INTO campaigns (id, campaign_code, company_id, title, description, job_type, location, province, district, salary_text, shift_text, quantity_needed, requirements, benefits, visibility, status, is_seed_job, source_type, seed_batch, internal_marker) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
              [id, job.campaign_code, company.id, job.title, job.description, job.job_type, job.location, job.province, job.district, job.salary_text, job.shift_label, 1, job.requirements, job.benefits, 'public_candidate', 'active', true, 'seed_intake', job.seed_batch, job.internal_marker]);
          }
          inserted++;
        }
      } else {
        inserted++;
      }
    }
  }

  const report = '# Seed Job Import Plan\n\n## DB Schema Fields Mapped\n\n*   `campaign_code` -> `campaigns.campaign_code`\n*   `title` -> `campaigns.title`\n*   `description` -> `campaigns.description`\n*   `job_type` -> `campaigns.job_type`\n*   `location` -> `campaigns.location`\n*   `province` -> `campaigns.province`\n*   `district` -> `campaigns.district`\n*   `salary_text` -> `campaigns.salary_text`\n*   `shift_text` -> `campaigns.shift_text` (from `shift_label`)\n*   `requirements` -> `campaigns.requirements`\n*   `benefits` -> `campaigns.benefits`\n*   `is_seed_job` -> `campaigns.is_seed_job`\n*   `source_type` -> `campaigns.source_type`\n*   `seed_batch` -> `campaigns.seed_batch`\n*   `internal_marker` -> `campaigns.internal_marker`\n\n## Company Strategy\n\nA single company, **VIECLAMGANNHA.ME**, will be used for all seed jobs. If it doesn't exist, it will be created.\n\n## Insert/Update Strategy\n\n*   **Insert:** If a campaign with the given `campaign_code` does not exist, a new record will be inserted.\n*   **Update:** If a campaign with the given `campaign_code` already exists and is a seed job, it will be updated with the new data. Non-seed jobs will not be touched.\n\n## Dry-Run Output\n\n*   **Seed jobs read:** ' + seedJobs.length + '\n*   **Would insert:** ' + inserted + '\n*   **Would update:** ' + updated + '\n*   **Skipped:** ' + skipped + '\n\n### Category Breakdown\n\n' + Object.entries(categoryCounts).map(([cat, count]) => `*   **${cat}:** ${count}`).join('\n') + '\n\n## Proposed Apply Command\n\n`node backend/scripts/import-seed-jobs.cjs --apply --db <path_to_db>`\n\n## Rollback/Remove Command\n\n`node backend/scripts/import-seed-jobs.cjs --remove-seed-batch ' + (REMOVE_BATCH || 'VLGN_SEED_20260531_30') + ' --db <path_to_db>`\n\n## Confirmation\n\n*   This was a dry run. No data has been imported into any database.\n';

  fs.writeFileSync(REPORT_PATH, report.trim() + '\n', 'utf8');
  console.log(report);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
