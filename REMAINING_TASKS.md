# DỰ ÁN VIECLAMGANNHA.ME - CÁC PHẦN VIỆC CÒN LẠI (DÀNH CHO AGENTS)

Đây là danh sách các nhiệm vụ quan trọng cần hoàn thành để dự án đi vào vận hành thực tế. 
Các Agent phải tuân thủ nghiêm ngặt `AGENTS.md` và các quy tắc trong thư mục `.roo/`.

---

## 1. PHASE: CHUẨN HÓA DỮ LIỆU & CHI TIẾT JOB (ƯU TIÊN 1)
*   [ ] **Tạo Page Chi tiết Job chuẩn:** Hiện tại trang chi tiết đang dùng dữ liệu cũ/hardcode. Cần Agent đọc dữ liệu từ DB (Bảng `campaigns`) để hiển thị.
    *   *Yêu cầu:* Phải hiển thị được danh sách `requirements` và `benefits` dưới dạng bullet points.
    *   *Bảo mật:* Tuyệt đối không hiện mã nội bộ, platform fee.
*   [ ] **Cơ chế Fallback dữ liệu:** Nếu một Job thiếu địa chỉ cụ thể hoặc ca làm, phải hiển thị câu thông báo mặc định theo mục 7.4 của Plan tổng.

## 2. PHASE: QUY TRÌNH DUYỆT ĐỐI TÁC (CTV & COMPANY)
*   [ ] **Logic duyệt hồ sơ tại Backend:** Agent cần code các API POST để Admin có thể chuyển trạng thái CTV/Company từ `pending` -> `active`.
    *   *Ràng buộc:* Khi duyệt Company, phải kiểm tra đã có `tax_code`.
*   [ ] **Dashboard phân quyền:** Đảm bảo CTV chưa được duyệt (`pending`) thì không thấy được nút "Gửi Lead" hoặc thông tin hoa hồng thật.

## 3. PHASE: VẬN HÀNH LEAD & TÀI CHÍNH
*   [ ] **Hệ thống Routing Lead:** Khi ứng viên bấm "Ứng tuyển nhanh", hệ thống phải tự động gán Lead đó về đúng `campaign_id` và gán vào hàng chờ của Admin (`owner_type = admin_pool`).
*   [ ] **Tính năng Đối soát (Finance Export):** Hoàn thiện chức năng tải file CSV báo cáo tài chính nội bộ (20/80) cho Admin.
*   [ ] **Audit Log tự động:** Mọi hành động sửa Job, duyệt CTV phải được tự động ghi vào bảng `audit_logs`.

---

## NGUYÊN TẮC CHO AGENTS:
1.  **KHÔNG** tạo thêm bảng User mới. Mọi vai trò đều dùng chung tài khoản Clerk.
2.  **KHÔNG** dùng Vercel. Deploys chỉ thực hiện trên VPS.
3.  **KIỂM TRA** TypeScript (`npx tsc --noEmit`) trước khi bàn giao task.
4.  **BÁO CÁO** rõ ràng file nào đã sửa và rủi ro nếu có.
