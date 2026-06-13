# Product Direction — Revenue-first

Phiên bản tóm tắt cho team: ưu tiên revenue-first nhưng không bỏ mô hình CTV. Mục tiêu: tối đa hóa lead/thu nhập bằng cách cho phép CTV và Admin/platform chạy song song; nơi nào CTV chưa phủ thì admin nhận lead.

## Nguyên tắc chính
- Revenue-first = CTV + Admin cùng chạy; không hiểu là loại CTV.
- Không bắt buộc campaign phải có CTV để public.
- Lead từ web public mặc định không gắn ctv_id.

## Luồng chính

### 1) CTV-sourced
- Điều kiện: campaign có CTV nhận hoặc lead đến từ link/form do CTV phát hành.
- Khi lead tạo: `source_type = ctv`, `ctv_id` bắt buộc.
- Có commission/payout cho CTV.

### 2) Admin/platform-sourced
- Điều kiện: campaign chưa có CTV nhận hoặc lead từ public web form.
- Khi lead tạo: `source_type = organic_web` (hoặc `admin`/`manual` khi admin import).
- `ctv_id` nullable (NULL). Lead được đẩy vào admin queue để admin xử lý và gửi/apply cho công ty.
- Không tạo payout CTV nếu `ctv_id` NULL.

## Campaign visibility
- `public_candidate`: ứng viên thấy & apply (không bắt buộc CTV).
- `ctv_private`: CTV thấy để chạy lead (bắt buộc `bounty`/`ctv_reward`).
- `internal`: chỉ admin xử lý.
- `draft`: chưa dùng.

## Tóm tắt kỹ thuật (ngắn)
- `leads.source_type`: enum {ctv, organic_web, admin, manual, facebook, zalo}.
- `leads.ctv_id`: nullable; khi `source_type = ctv` phải có giá trị.
- Khi tạo lead từ web public: backend auto set `source_type = organic_web` và `ctv_id = NULL`.
- Khi tạo lead từ CTV link/form: set `source_type = ctv` và require `ctv_id`.

## Không làm ở phase này
- Không tự động cho phép ứng viên apply trực tiếp vào dashboard công ty. (Feature này cho phase sau khi có gói công ty.)

## Next steps (đã yêu cầu)
1. PR spec backend (migration đề xuất, API changes, validation, routing, payout rules, admin queue, QA checklist). — Đã soạn tại docs/PR_SPEC_REVENUE_FIRST_BACKEND.md.
2. Routing/Admin queue — soạn riêng tại docs/ROUTING_ADMIN_QUEUE.md.
