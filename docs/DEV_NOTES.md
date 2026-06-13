# Ghi chú cho dev

## Giai đoạn 1

Chỉ cần dựng front-end theo code khung và chỉnh UI cho đẹp, responsive.

## Giai đoạn 2

Thêm backend:

- Company
- JobPost
- CandidateApplication
- TelegramRouting
- SubscriptionPlan
- JobViewEvent
- JobApplyEvent

## Telegram routing

Mỗi công ty nên có cấu hình:

```txt
companyCode = CTY012
telegramChatId = -100xxxxxxxxxx
```

Mỗi tin tuyển có:

```txt
targetCode = MT004
companyCode = CTY012
```

Khi ứng viên gửi form, backend dùng `companyCode` để tìm Telegram chat cần gửi.

## Bảo mật

Không để `TELEGRAM_BOT_TOKEN` ở frontend.
Không lưu token trong Git.
Dùng `.env` phía server.

## SEO sau này

Tạo route dạng:

```txt
/viec-lam-bao-ve-thu-duc
/viec-lam-lao-dong-pho-thong-binh-duong
/viec-lam-phu-kho-di-an
```
