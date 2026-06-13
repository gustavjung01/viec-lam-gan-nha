const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const DB_PATH = '/var/www/viec-lam-gan-nha/backend/data/applications.db';
const SEED_DATA_PATH = '/tmp/seed_jobs.lead_intake.v2.json';

const db = new sqlite3.Database(DB_PATH);

function generateCode(prefix) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}${timestamp}${random}`;
}

console.log('--- Bắt đầu Import 30 tin Seed Jobs V2 (VPS Fix) ---');

if (!fs.existsSync(SEED_DATA_PATH)) {
    console.error('Lỗi: Không tìm thấy file JSON V2 tại /tmp/');
    process.exit(1);
}

const seedData = JSON.parse(fs.readFileSync(SEED_DATA_PATH, 'utf8'));
const items = seedData.items;

const seedCompany = {
    id: 'VLGN_SEED',
    company_code: 'VLGN_SEED',
    name: 'Hệ thống VLGN (Seed Data)',
    status: 'active'
};

db.serialize(() => {
    db.run(`
        INSERT OR IGNORE INTO companies (id, company_code, name, status)
        VALUES (?, ?, ?, ?)
    `, [seedCompany.id, seedCompany.company_code, seedCompany.name, seedCompany.status]);

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO campaigns (
            id, campaign_code, company_id, title, job_type, 
            province, district, salary_text, shift_text, 
            requirements, description, visibility, status,
            bounty_amount, ctv_reward_amount, platform_fee_amount,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const formatList = (arr) => arr.map(item => `• ${item}`).join('\n');

    let count = 0;
    items.forEach(item => {
        const salary_text = `${item.salary_min.toLocaleString('vi-VN')}đ - ${item.salary_max.toLocaleString('vi-VN')}đ/tháng`;
        
        stmt.run(
            item.id,
            generateCode('CMP'),
            seedCompany.id,
            item.title,
            item.category,
            item.province,
            item.district,
            salary_text,
            item.shift,
            formatList(item.requirements),
            item.public_description,
            'public_candidate',
            'active',
            0,
            0,
            0,
            function(err) {
                if (err) console.error(`Lỗi tin ${item.id}:`, err.message);
                else count++;
            }
        );
    });

    stmt.finalize(() => {
        console.log(`--- HOÀN TẤT: Đã import thành công ${count}/${items.length} tin. ---`);
        db.close();
    });
});
