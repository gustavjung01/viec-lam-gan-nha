# Kế hoạch Phát triển Chatbot Tư vấn Việc làm

**Mục tiêu:** Xây dựng chatbot tự động tư vấn việc làm phù hợp dựa trên thông tin ứng viên.

---

**Các phần đã hoàn thành (Dev không cần làm lại, đã được xác nhận):**
*   Trang Chi tiết Job (Frontend).
*   Quy trình Duyệt Đối tác (Backend & Frontend).
*   Hệ thống Vận hành Lead & Tài chính (Backend).

---

**Kế hoạch phát triển Chatbot (Dev cần làm):**

## 1. Phase 1: Thu thập và chuẩn hóa dữ liệu ứng viên

### 1.1. Mở rộng Candidate Profile (Backend - Schema & API)
*   **Mô tả:** Thêm các trường dữ liệu mới vào bảng `candidates` để lưu trữ thông tin chi tiết về kinh nghiệm, trình độ học vấn, ca làm việc mong muốn, khả năng ở lại, và có phương tiện di chuyển.
*   **Chi tiết thực hiện:**
    *   Tạo migration script để thêm các cột sau vào bảng `candidates` trong SQLite:
        *   `experience_years` (INTEGER)
        *   `education_level` (TEXT)
        *   `preferred_shift` (TEXT)
        *   `is_stay_in_possible` (INTEGER - Boolean, 0: False, 1: True)
        *   `has_transport` (INTEGER - Boolean, 0: False, 1: True)
    *   Cập nhật tệp schema (`backend/src/db/marketplace-schema.sql`) để phản ánh các thay đổi này.
    *   Xây dựng hoặc mở rộng API Backend (trong `backend/src/routes/` hoặc một file mới, ví dụ: `backend/src/routes/candidates.js`) để Frontend có thể gửi (CREATE/UPDATE) và nhận (READ) dữ liệu của các trường này cho từng ứng viên.

### 1.2. Xây dựng form/UI cho ứng viên (Frontend)
*   **Mô tả:** Tạo giao diện người dùng để ứng viên có thể nhập và cập nhật các thông tin profile chi tiết đã mở rộng ở trên.
*   **Chi tiết thực hiện:**
    *   Xác định vị trí thích hợp cho form/UI:
        *   **Tùy chọn 1 (Ưu tiên):** Một trang hồ sơ cá nhân mới (`src/pages/CandidateProfilePage.tsx`).
        *   **Tùy chọn 2:** Tích hợp vào trang tài khoản hiện có (`src/pages/AccountPage.tsx`).
        *   **Tùy chọn 3:** Tích hợp vào trang đăng ký/dashboard của CTV (`src/pages/ctv/CTVRegistrationPage.tsx`, `src/pages/ctv/CTVDashboardPage.tsx`) nếu CTV là người nhập thông tin cho ứng viên.
    *   Sử dụng các thành phần UI hiện có hoặc thiết kế mới để thu thập các thông tin `experience_years`, `education_level`, `preferred_shift`, `is_stay_in_possible`, `has_transport`.

## 2. Phase 2: Logic khớp việc (Matching Logic)

### 2.1. Phát triển thuật toán khớp việc (Rule-based)
*   **Mô tả:** Xây dựng một thuật toán dựa trên các quy tắc để tìm kiếm và đánh giá mức độ phù hợp giữa thông tin của ứng viên và các công việc có sẵn.
*   **Chi tiết thực hiện:**
    *   Phát triển logic trong Backend (có thể trong một file tiện ích mới như `backend/src/utils/jobMatcher.js` hoặc tích hợp vào API) để:
        *   Lấy thông tin ứng viên từ bảng `candidates` (bao gồm các trường mới).
        *   Lấy danh sách công việc `active` và `public_candidate`/`ctv_private` từ bảng `campaigns`.
        *   Thực hiện các quy tắc so khớp dựa trên:
            *   **Địa điểm:** Khớp `province`, `district`.
            *   **Ngành nghề:** Khớp `desired_job` với `job_type`/`title`.
            *   **Mức lương:** So sánh `salary_text` của công việc với mong muốn.
            *   **Ca làm việc:** Khớp `preferred_shift` với `shift_text`.
            *   **Yếu tố mở rộng:** Tính điểm dựa trên `experience_years`, `education_level`, `is_stay_in_possible`, `has_transport`.
        *   Tính `match_score` cho mỗi công việc.

### 2.2. Xây dựng API khớp việc
*   **Mô tả:** Tạo một API Backend mới để cung cấp chức năng khớp việc cho Frontend chatbot.
*   **Chi tiết thực hiện:**
    *   Tạo một API Endpoint mới (ví dụ: POST `/api/match-jobs` trong `backend/src/routes/matching.js`).
    *   API sẽ nhận vào thông tin ứng viên (hoặc `candidate_id`), gọi thuật toán khớp việc, và trả về một danh sách các `job_id` cùng `match_score` và thông tin công việc tóm tắt, được sắp xếp theo `match_score` giảm dần.

## 3. Phase 3: Xây dựng Chatbot (Frontend & Bot Framework)

### 3.1. Chọn framework chatbot (Frontend)
*   **Mô tả:** Lựa chọn công nghệ/thư viện Frontend phù hợp để xây dựng giao diện chatbot.
*   **Chi tiết thực hiện:**
    *   Đề xuất sử dụng một thư viện React nhẹ như `React Chatbot Kit` để có sự linh hoạt trong UI/UX và dễ dàng tích hợp với các component hiện có của dự án.
    *   (Tùy chọn: Nếu cần xử lý ngôn ngữ tự nhiên phức tạp, có thể tích hợp với các dịch vụ NLP như Dialogflow thông qua webhook.)

### 3.2. Thiết kế và triển khai giao diện chatbot (Frontend)
*   **Mô tả:** Thiết kế và triển khai giao diện người dùng (UI) trực quan và tương tác cho chatbot trên web.
*   **Chi tiết thực hiện:**
    *   **Vị trí:** Cửa sổ pop-up ở góc màn hình hoặc thành phần cố định trên trang cụ thể.
    *   **Thành phần UI:** Khung nhập liệu, khu vực tin nhắn (phân biệt tin nhắn người dùng/chatbot), tin nhắn chào mừng, quick replies, loading indicator.
    *   **UI cho thu thập thông tin:** Sử dụng các form nhỏ hoặc lựa chọn để thu thập thông tin profile ứng viên.
    *   **UI cho hiển thị kết quả:** Hiển thị danh sách công việc phù hợp với tóm tắt và liên kết đến trang chi tiết.

### 3.3. Triển khai luồng tương tác chatbot
*   **Mô tả:** Thiết lập logic để chatbot tương tác với người dùng, thu thập thông tin, gọi API Backend và hiển thị kết quả.
*   **Chi tiết thực hiện:**
    *   **Luồng:**
        1.  Người dùng mở chatbot.
        2.  Chatbot chào mừng, hỏi thông tin cơ bản.
        3.  Người dùng cung cấp thông tin (gửi qua API profile ứng viên).
        4.  Chatbot hỏi thông tin chi tiết (gửi qua API profile ứng viên).
        5.  Khi đủ thông tin, chatbot gọi API khớp việc (`/api/match-jobs`).
        6.  Chatbot nhận và hiển thị kết quả công việc phù hợp.
        7.  Cung cấp tùy chọn tìm kiếm thêm hoặc điều chỉnh tiêu chí.

---

**Quy tắc chung cho Dev:**
*   **Không dùng Vercel:** Triển khai trên VPS.
*   **Không Git Push tự ý:** Chỉ push code khi có yêu cầu cụ thể và được phê duyệt.
*   **Kiểm tra TypeScript:** Luôn chạy `npx tsc --noEmit` để đảm bảo chất lượng code và không có lỗi kiểu.
*   **Báo cáo:** Ghi lại các file đã sửa đổi, các file mới tạo và bất kỳ rủi ro tiềm ẩn nào trong quá trình phát triển.
