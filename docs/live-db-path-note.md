# Ghi chú quan trọng về Database Path trên Live (VPS)

Do có sự không nhất quán giữa file cấu hình `.env` và logic thực thi, tài liệu này ghi nhận đường dẫn thực sự của database live để tránh thao tác nhầm lẫn (đặc biệt khi thực hiện backup, migration, hay query dữ liệu trực tiếp).

## 1. Database live thực sự
* **Path:** `/var/www/viec-lam-gan-nha/backend/data/applications.db`
* App Node.js hiện đang đọc và ghi vào file này do trong `backend/src/database.js` sử dụng path tĩnh (hardcode): 
  `path.join(__dirname, '..', 'data', 'applications.db')`
* **Xác nhận:** DB này chứa đầy đủ schema của Marketplace (`campaigns`, `ctv_accounts`, `companies`, v.v.) và các counts thực tế.

## 2. Database "mồ côi" (Không dùng)
* **Path:** `/var/www/viec-lam-gan-nha/data/applications.db`
* Đây là path được chỉ định bởi biến `DATABASE_PATH` trong file `.env` trên VPS.
* Tuy nhiên, file này **BỊ BỎ QUA** trong code runtime. Khi kiểm tra cấu trúc, DB này là rỗng (hoặc chỉ chứa vài thông tin cũ) và không có schema của Marketplace.
* **Quy tắc:** TUYỆT ĐỐI KHÔNG dùng nhầm DB này cho bất kỳ thao tác nghiệp vụ nào. KHÔNG xóa/rename nó nếu chưa được phê duyệt toàn bộ.

## 3. Quy trình an toàn cho tương lai
* **Không tự ý đổi `database.js`**: Tuyệt đối không thay thế việc đọc path tĩnh sang `process.env.DATABASE_PATH` nếu chưa có kế hoạch đồng bộ lại `.env` và kiểm tra toàn diện trên live. Nếu sửa gấp có thể gây mất toàn bộ data.
* **Khi chạy Migration**: Bắt buộc phải truyền cờ `--db` trỏ rõ ràng tới DB thật (ví dụ: `node scripts/migrate-add-rejected-status.cjs --db data/applications.db` khi đang đứng ở thư mục `backend/`).
* **Sao lưu (Backup)**: Trước bất cứ migration nào, phải luôn backup DB thật (như cách đã tạo backup `applications.db.bak-before-...` tại thư mục `/var/www/viec-lam-gan-nha/backend/data/`).
* **Verification (Kiểm tra chéo)**: Sau migration, phải chạy lệnh verify kiểm tra:
  * Count dữ liệu trước/sau (ví dụ: ctv_accounts, companies).
  * Kiểm tra tính toàn vẹn thông qua `PRAGMA foreign_key_check` và `PRAGMA integrity_check`.
  * So sánh Schema xem thay đổi có đúng bảng đích không.