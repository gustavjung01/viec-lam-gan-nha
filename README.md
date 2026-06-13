# Việc Làm Gần Nhà - code khung

Đây là code khung React + Vite + Tailwind cho web tuyển dụng bảo vệ và lao động phổ thông theo khu vực.

## Chạy local

```bash
npm install
npm run dev
```

Mở đường dẫn Vite hiển thị trong terminal, thường là:

```bash
http://localhost:5173
```

## Build

```bash
npm run build
npm run preview
```

## Phạm vi hiện tại

Đã có:

- Trang chủ giao diện mẫu
- Header, hero, bộ lọc
- Danh sách tin tuyển nổi bật
- Popup ứng tuyển nhanh
- Khu vực tuyển dụng
- Gói 499k, 799k, 999k
- Dashboard công ty dạng preview
- Khung tạo nội dung gửi Telegram mock

Chưa có:

- Backend thật
- Database thật
- Login công ty
- API gửi Telegram thật
- Thanh toán
- Admin duyệt tin

## Ghi chú sản phẩm

- Web không hiển thị tên công ty ra ngoài.
- Nội bộ dùng `companyCode` và `targetCode` để điều phối hồ sơ.
- Telegram chỉ nên là nơi nhận thông báo. Hồ sơ thật vẫn cần lưu database.
- Tên miền trong code là tạm: `VIECLAMGANNHA.COM`.
