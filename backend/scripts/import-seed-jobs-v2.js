/**
 * Script: import-seed-jobs-v2.js
 * Mục đích: Import 30 tin tuyển dụng ảo từ file JSON V2 vào Database.
 * Rủi ro: Thấp.
 */

import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../data/applications.db');
const SEED_DATA_PATH = path.join(__dirname, '../../_local_data/datacty/_standardized/seed_jobs.lead_intake.v2.json');

const db = new sqlite3.Database(DB_PATH);

function generateCode(prefix) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}${timestamp}${random}`;
}

async function run() {
    console.log('--- Bắt đầu Import 30 tin Seed Jobs V2 ---');

    if (!fs.existsSync(SEED_DATA_PATH)) {
        console.error('Lỗi: Không tìm thấy file JSON V2');
        process.exit(1);
    }
    
    const seedData = JSON.parse(fs.readFileSync(SEED_DATA_PATH, 'utf8'));
    const items = seedData.items;

    // 1. Tạo công ty SEED nếu chưa có
    const seedCompany = {
        id: 'VLGN_SEED',
        company_code: 'VLGN_SEED',
        name: 'Hệ thống VLGN (Seed Data)',
        status: 'active'
    };

    db.serialize(() => {
        // 0. Dọn dẹp tin cũ (Cầm trịch Fix)
        db.run("DELETE FROM campaigns WHERE id LIKE 'seed-%' OR company_id = 'VLGN_SEED'");
        db.run("DELETE FROM companies WHERE id = 'VLGN_SEED'");

        db.run(`
            INSERT OR IGNORE INTO companies (id, company_code, name, status)
            VALUES (?, ?, ?, ?)
        `, [seedCompany.id, seedCompany.company_code, seedCompany.name, seedCompany.status]);

        // 2. Chuẩn bị statement cho Campaigns
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
                generateCode('CMP'), // Mã code duy nhất
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
                0, // Seed jobs không có bounty thật
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
}

run().catch(err => console.error(err));
