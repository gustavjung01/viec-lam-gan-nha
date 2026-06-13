# Báo cáo hoàn thành: Affiliate Campaign Refactor & Logic Hạn Mức Push Tin

## 1. Cơ sở dữ liệu (Database Schema & Migration)
Đã thực hiện cập nhật `backend/src/db/marketplace-schema.sql` và tạo file migration `backend/migrations/001_affiliate_refactor.sql`:
- `companies`: Thêm các cột quản lý hạn mức, cọc và gói dịch vụ (`trust_level`, `deposit_status`, `lead_trial_limit`, `free_job_posts_limit`, `weekly_push_limit`, `require_deposit_after_leads`, `plan_code`, `plan_expired_at`, `is_featured`, `used_job_posts_count`, `used_push_count`).
- `campaigns`:
  - Thêm 2 cột `is_public` (hiển thị cho ứng viên) và `ctv_enabled` (cho phép CTV chạy).
  - Thêm cột `promoted_until` để theo dõi thời gian chiến dịch được "Push tin".
- Migrate dữ liệu (Đã thực thi trên file .db): Chạy script để cập nhật `is_public` và `ctv_enabled` từ dữ liệu `visibility` cũ, bảo toàn tính logic.

## 2. API Backend
- **GET /api/ctv/campaigns**: Cập nhật bộ lọc để lấy chiến dịch có `ctv_enabled = 1`. Ẩn trường `bounty_amount`. (Thực hiện ở bước trước).
- **POST /api/company/campaigns & PUT /api/company/campaigns/:id**:
  - Hỗ trợ lưu 2 trường `is_public` và `ctv_enabled` thay vì `visibility`.
  - Bổ sung logic kiểm tra giới hạn `free_job_posts_limit`.
- **POST /api/company/campaigns/:id/push**: API mới cho phép công ty "Push tin".
  - Kiểm tra `used_push_count` so với `weekly_push_limit`.
  - Nếu thành công, set `promoted_until` = NOW + 24 giờ và tăng `used_push_count`.
- **GET /api/jobs**: Sắp xếp ưu tiên các chiến dịch có `promoted_until > datetime('now')`.
- **GET /api/account/me**: Bổ sung trả về thông tin hạn mức (freeJobPostsLimit, usedJobPostsCount, weeklyPushLimit, usedPushCount, planCode) trong object company.
- **PUT /api/admin/company/:id**: Admin API để cập nhật các tham số tín nhiệm và giới hạn của công ty (`trust_level`, `free_job_posts_limit`, `weekly_push_limit`,...).

## 3. Giao diện Frontend
- **Company Dashboard (`src/pages/company/CompanyDashboardPage.tsx`)**:
  - Đã fix lỗi không tìm thấy text để thay thế form tạo chiến dịch.
  - Sửa form tạo chiến dịch: Xóa dropdown Visibility cũ, thay bằng 2 checkbox (`is_public`, `ctv_enabled`).
  - Lấy và hiển thị thông tin giới hạn: Thêm UI hiển thị `Tin đăng miễn phí: đã dùng X/Y` và `Lượt push tuần này: đã dùng Z/W`.
  - Nút Submit form tạo chiến dịch tự động vô hiệu hóa nếu số lượt tạo tin đăng đã đạt tới giới hạn miễn phí.
  - Bổ sung nút **"Push tin"** cạnh nút "Chỉnh sửa" cho mỗi campaign. Tự động mờ (disabled) khi hết hạn mức push tin trong tuần.
- **Admin Company Tab (`src/pages/admin/tabs/AdminCompanyTab.tsx`)**:
  - Bổ sung nút "Cài đặt" bên cạnh mỗi công ty.
  - Tạo Modal cài đặt để thay đổi trực tiếp các thông số `trust_level`, `deposit_status`, `plan_code`, giới hạn tin đăng...
- **Sửa types.ts & useAdminConsole.ts**: 
  - Cập nhật định nghĩa TypeScript cho CompanyAccount.
  - Hỗ trợ method linh hoạt cho tính năng gọi Action (cập nhật thiết lập dùng phương thức `PUT`).

## 4. Testing
- Kết quả test build Vite tĩnh: `✓ built in 4.46s`. Không có lỗi type check (tsc -b).
- Đã khắc phục mọi lỗi liên đới kiểu TS (do thay `visibility` bằng `is_public` và `ctv_enabled`).

## 5. Rủi ro / Các phần có thể tiếp tục cải thiện
- **Cronjob/Reset Hạn mức**: Hệ thống chưa có worker hoặc cronjob tự động reset `used_push_count` về `0` mỗi đầu tuần. Cần triển khai hệ thống trigger cron ở phía backend hoặc DB.
- **Phân trang & Cache List Jobs**: Việc order by `promoted_until` sẽ tốn chi phí scan DB nếu lượng job cực lớn. Tương lai nên sử dụng Cache (Redis) thay cho DB Query trực tiếp.
- Hiện chưa xử lý reset tự động `used_job_posts_count` (giả định tùy thuộc vào ngày đăng ký gói `plan_expired_at`).
