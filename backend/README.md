# Backend API - ViecLamGanNha

Backend đơn giản nhận đơn ứng tuyển và gửi Telegram.

## Tech Stack

- Node.js + Express
- SQLite (better-sqlite3)
- node-telegram-bot-api
- Zod validation
- express-rate-limit

## Cài đặt

```bash
cd backend
npm install
```

## Cấu hình

Copy `.env.example` thành `.env`:

```bash
cp .env.example .env
```

Sửa `.env` với token thật:

```env
PORT=3001
FRONTEND_URL=http://localhost:5175

# Telegram Bot Token (lấy từ @BotFather)
TELEGRAM_BOT_TOKEN=your_real_bot_token_here

# Company Channel Mapping (dùng @channel_username hoặc chat_id)
CTY012=@ctvieclam012
CTY015=@ctvieclam015
CTY018=@ctvieclam018
CTY020=@ctvieclam020
CTY025=@ctvieclam025
CTY028=@ctvieclam028
```

### Lấy Telegram Chat ID

**Cách 1: Dùng @username**
- Tạo channel/group → Đặt username dạng `@ctvieclam012`
- Thêm bot vào channel làm admin
- Dùng `@username` trong .env

**Cách 2: Lấy numeric chat_id**
- Truy cập: `https://api.telegram.org/bot<TOKEN>/getUpdates`
- Gửi tin nhắn vào channel/group
- Tìm `"chat":{"id":-123456789` trong response
- Dùng `-123456789` trong .env

### Lưu ý Telegram

**Khi chưa cấu hình `TELEGRAM_BOT_TOKEN`:**
- Backend vẫn lưu DB và trả về success
- `telegram_sent` = 0, `telegram_error` = 'TELEGRAM_NOT_CONFIGURED'
- API trả kèm warning: `"telegramWarning": "Telegram chưa được cấu hình"`
- Không gọi Telegram API (tránh lỗi 404)

**Khi đã cấu hình đúng:**
- Gửi Telegram message tới channel theo companyCode
- `telegram_sent` = 1 nếu thành công
- `telegram_error` lưu lỗi nếu gửi thất bại

**Bảo mật:**
- ⚠️ KHÔNG commit file `.env` chứa token thật
- Dữ liệu người dùng được escape HTML trước khi gửi

## Chạy dev

```bash
npm run dev
```

Server chạy tại: http://localhost:3001

## API Endpoints

### Health Check
```bash
curl http://localhost:3001/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-05-23T06:57:23.123Z",
  "version": "0.1.0"
}
```

### Gửi đơn ứng tuyển
**Endpoint:** `POST /api/apply`

Headers:
```
Content-Type: application/json
```

Body:
```json
{
  "fullName": "Nguyễn Văn A",
  "phone": "0909123456",
  "area": "Quận 1, TP.HCM",
  "note": "Có kinh nghiệm 2 năm",
  "jobId": "job-001",
  "jobSlug": "nhan-vien-bao-ve-ca-ngay",
  "jobTitle": "Nhân viên bảo vệ ca ngày",
  "companyCode": "CTY012",
  "targetCode": "MT004"
}
```

Response Success (201):
```json
{
  "success": true,
  "message": "Đã ghi nhận đơn ứng tuyển",
  "data": {
    "applicationId": 1,
    "telegramSent": false,
    "telegramChannel": null
  }
}
```

Response Error (400):
```json
{
  "success": false,
  "message": "Dữ liệu không hợp lệ",
  "errors": [
    { "field": "phone", "message": "Số điện thoại không hợp lệ" }
  ]
}
```

### Stats
```bash
curl http://localhost:3001/api/apply/stats
```

Response:
```json
{
  "success": true,
  "data": {
    "total": 100,
    "sent_to_telegram": 98,
    "pending": 2,
    "companies": 6
  }
}
```

## Database

File: `data/applications.db`

### Kiểm tra dữ liệu
```bash
# Dùng script Node.js
node check-db.js

# Hoặc dùng sqlite3 CLI
sqlite3 data/applications.db "SELECT * FROM applications ORDER BY id DESC LIMIT 5;"
```

### Schema
```sql
CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  area TEXT NOT NULL,
  note TEXT,
  job_id TEXT,
  job_slug TEXT,
  job_title TEXT,
  company_code TEXT NOT NULL,
  target_code TEXT NOT NULL,
  telegram_sent INTEGER DEFAULT 0,
  telegram_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Fields quan trọng
- `telegram_sent`: 0 = chưa gửi, 1 = đã gửi Telegram
- `telegram_error`: Lưu lỗi nếu gửi Telegram thất bại
- `company_code`: Dùng để routing đến đúng Telegram channel

## Rate Limiting

- General API: 50 requests / 15 phút
- Apply endpoint: 10 requests / 1 giờ (chống spam)

## Telegram Message Format

```
🎯 <b>ĐƠN ỨNG TUYỂN MỚI</b>
⏰ 23/05/2026, 14:30:00

📋 <b>Thông tin ứng viên:</b>
👤 Họ tên: <b>Nguyễn Văn A</b>
📱 SĐT: <code>0909123456</code>
📍 Khu vực: Quận 1, TP.HCM
📝 Ghi chú: Có kinh nghiệm 2 năm

💼 <b>Thông tin công việc:</b>
🏢 Mã công ty: <code>CTY012</code>
🎯 Mã mục tiêu: <code>MT004</code>
📌 Vị trí: Nhân viên bảo vệ ca ngày
🔗 Link: /viec-lam/nhan-vien-bao-ve-ca-ngay

<i>Phân phối tự động theo mã CTY012</i>
```

## Production

```bash
npm start
```

Dùng PM2 cho production:
```bash
pm2 start server.js --name vieclam-api
```
