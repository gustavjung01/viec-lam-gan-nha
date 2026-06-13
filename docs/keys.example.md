# KEYS LOCAL ONLY - KHÔNG PUSH GIT

## Quy tắc
- File này chứa key/API thật của các ứng dụng liên quan.
- Tuyệt đối không push Git.
- Nếu cần chia sẻ cho dev, chỉ gửi riêng qua kênh an toàn.
- Không dán key thật vào README, docs public, code, ảnh chụp màn hình.

## Web-Tuyen-Dung

### Frontend
VITE_API_URL=http://localhost:3001
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

### Backend
PORT=3001
FRONTEND_URL=http://localhost:5173
TELEGRAM_BOT_TOKEN=
TELEGRAM_DEFAULT_CHANNEL=
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

### Telegram company mapping
CTY012=@channel_or_chat_id
CTY015=@channel_or_chat_id
CTY018=@channel_or_chat_id
CTY020=@channel_or_chat_id
CTY025=@channel_or_chat_id
CTY028=@channel_or_chat_id

## Ghi chú
- Nếu key nào chưa dùng thì để trống.
- Khi deploy mới tạo env thật trên server/VPS.
- Không commit file này.
