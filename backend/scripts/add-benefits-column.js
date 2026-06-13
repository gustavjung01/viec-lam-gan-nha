import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cấu hình đường dẫn (Tự động thích ứng local/VPS)
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../data/applications.db');

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
    console.log('--- Bắt đầu Migration: Thêm cột benefits ---');

    // Thêm cột benefits nếu chưa có
    db.run("ALTER TABLE campaigns ADD COLUMN benefits TEXT", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Cột benefits đã tồn tại.');
            } else {
                console.error('Lỗi thêm cột benefits:', err.message);
            }
        } else {
            console.log('Đã thêm cột benefits thành công.');
        }
    });

    // Thêm cột description nếu chưa có (đề phòng)
    db.run("ALTER TABLE campaigns ADD COLUMN description TEXT", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('Cột description đã tồn tại.');
            }
        } else {
            console.log('Đã thêm cột description thành công.');
        }
    });

    console.log('--- Hoàn tất Migration ---');
    db.close();
});
