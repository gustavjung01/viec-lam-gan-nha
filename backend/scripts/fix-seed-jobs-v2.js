/**
 * Script: fix-seed-jobs-v2.js
 * Mục đích: Cập nhật nội dung chuẩn cho 30 tin tuyển dụng ảo từ file V2.
 * Rủi ro: Thấp (chỉ cập nhật bảng campaigns, không sửa cấu trúc DB).
 */

import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cấu hình đường dẫn (Tự động thích ứng local/VPS)
const DB_PATH = path.join(__dirname, '../data/applications.db');
const SEED_DATA_PATH = path.join(__dirname, '../../_local_data/datacty/_standardized/seed_jobs.lead_intake.v2.json');

const db = new sqlite3.Database(DB_PATH);

async function run() {
    console.log('--- Bắt đầu cập nhật 30 tin Seed Jobs V2 ---');

    // 1. Đọc dữ liệu từ file JSON
    if (!fs.existsSync(SEED_DATA_PATH)) {
        console.error('Lỗi: Không tìm thấy file dữ liệu chuẩn tại:', SEED_DATA_PATH);
        process.exit(1);
    }
    
    const seedData = JSON.parse(fs.readFileSync(SEED_DATA_PATH, 'utf8'));
    const items = seedData.items;

    console.log(`Đã đọc ${items.length} tin từ file JSON.`);

    // 2. Chuẩn bị câu lệnh SQL
    // Chuyển mảng thành dạng Bullet Points để hiển thị đẹp
    const formatList = (arr) => arr.map(item => `• ${item}`).join('\n');

    db.serialize(() => {
        const stmt = db.prepare(`
            UPDATE campaigns 
            SET 
                title = ?,
                job_type = ?,
                province = ?,
                district = ?,
                salary_text = ?,
                requirements = ?,
                description = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `);

        let updatedCount = 0;
        let processedCount = 0;

        items.forEach(item => {
            const salary_text = `${item.salary_min.toLocaleString('vi-VN')}đ - ${item.salary_max.toLocaleString('vi-VN')}đ/tháng`;
            const reqs = formatList(item.requirements);
            
            stmt.run(
                item.title,
                item.category, // Ánh xạ category vào job_type
                item.province,
                item.district,
                salary_text,
                reqs,
                item.public_description,
                item.id,
                function(err) {
                    processedCount++;
                    if (err) {
                        console.error(`Lỗi khi cập nhật tin ${item.id}:`, err.message);
                    } else if (this.changes > 0) {
                        updatedCount++;
                    }

                    if (processedCount === items.length) {
                        console.log(`--- HOÀN TẤT: Đã cập nhật thành công ${updatedCount}/30 tin. ---`);
                        db.close();
                    }
                }
            );
        });

        stmt.finalize();
    });
}

run().catch(err => console.error('Lỗi hệ thống:', err));
