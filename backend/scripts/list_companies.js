import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get absolute path to database
const DB_PATH = path.join(__dirname, '..', '..', 'backend', 'data', 'applications.db');

const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    process.exit(1);
  }
});

console.log('--- DANH SÁCH CÔNG TY ĐÃ ĐĂNG KÝ ---');

const sql = `
  SELECT 
    id,
    company_code,
    name,
    phone,
    email,
    province,
    district,
    status,
    created_at,
    clerk_user_id
  FROM companies
  ORDER BY created_at DESC
`;

db.all(sql, [], (err, rows) => {
  if (err) {
    console.error('Lỗi khi truy vấn:', err.message);
    db.close();
    return;
  }

  if (rows.length === 0) {
    console.log('Chưa có công ty nào đăng ký.');
  } else {
    console.table(rows);
    console.log(`\nTổng số: ${rows.length} công ty`);
  }

  db.close();
});
