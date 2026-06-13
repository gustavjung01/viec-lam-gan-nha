# Frontend MVP Status - VIECLAMGANNHA.COM

**Ngày cập nhật:** 23/05/2026  
**Phiên bản:** v0.1.0 MVP  
**Trạng thái:** Đã khóa bản MVP, sẵn sàng cho backend integration

---

## Routes Đã Có

| Route | Mô tả | Trạng thái |
|-------|-------|------------|
| `/` | Trang chủ: Hero, filter, chips ngành nghề, việc làm nổi bật, khu vực, pricing, footer | ✅ Hoàn thiện |
| `/viec-lam` | Trang tìm kiếm: Sidebar filter, danh sách 6 tin, pagination, card hỗ trợ | ✅ Hoàn thiện |
| `/viec-lam/:slug` | Chi tiết tin (SEO-friendly slug): Mô tả, yêu cầu, quyền lợi, sidebar ứng tuyển | ✅ Hoàn thiện |
| `/nha-tuyen-dung` | Dashboard công ty: Sidebar, KPI, bảng tin, nút Đăng tin/Xuất báo cáo | ✅ Hoàn thiện |

### Slug SEO-friendly đang dùng:
- `/viec-lam/nhan-vien-bao-ve-ca-ngay`
- `/viec-lam/lao-dong-pho-thong-di-lam-ngay`
- `/viec-lam/nhan-vien-phu-kho-soan-hang`
- `/viec-lam/tap-vu-van-phong-ca-sang`
- `/viec-lam/nhan-vien-giao-hang-ban-thoi-gian`
- `/viec-lam/bao-ve-ca-dem-khu-cong-nghiep`

---

## Component Chính

### Layout Components
- `Header.tsx` - Navigation với React Router, responsive
- `Footer.tsx` - Footer 4 cột, thông tin liên hệ
- `ApplyModal.tsx` - Popup ứng tuyển với success state

### Home Page Components
- `HeroSearch.tsx` - Hero section với search box navy
- `JobsSection.tsx` - Grid 4 việc làm nổi bật
- `AreasSection.tsx` - Grid 7 khu vực tuyển dụng
- `PricingSection.tsx` - 3 gói dịch vụ 499k/799k/999k
- `DashboardPreview.tsx` - Preview dashboard cho công ty

### Shared Components
- `JobCard.tsx` - Card việc làm với icon, mã tin, nút ứng tuyển
- `SelectBox.tsx` - Select input component

### Page Components
- `HomePage.tsx` - Trang chủ
- `JobsPage.tsx` - Trang tìm kiếm với sidebar filter
- `JobDetailPage.tsx` - Chi tiết tin tuyển dụng
- `EmployerDashboardPage.tsx` - Dashboard nhà tuyển dụng

---

## Data Mock

**Vị trí file:** `src/data/mockData.ts`

### Dữ liệu hiện có:
- `allJobs` - 6 tin tuyển dụng mẫu
- `companies` - 6 công ty (internal use, không hiển thị public)
- `categories` - 6 ngành nghề
- `areas` - 7 khu vực tuyển dụng
- `pricingPlans` - 3 gói dịch vụ
- `dashboardStats` - Thống kê dashboard mẫu

### Helper functions:
- `getJobBySlug(slug)` - Tìm job theo slug SEO-friendly
- `getRelatedJobs(jobId, limit)` - Lấy việc làm liên quan
- `getJobsByCategory(category)` - Lọc theo ngành nghề
- `getJobsByProvince(province)` - Lọc theo tỉnh/thành

**Lưu ý quan trọng:** Public UI không hiển thị tên công ty thật, chỉ hiển thị mã nội bộ dạng `CTY012 - MT004`

---

## Ảnh Tham Khảo

**Vị trí:** `docs/ui-reference/web-ui-images-package/`

| File | Mô tả |
|------|-------|
| `01-trang-chu-desktop.png` | Trang chủ desktop |
| `02-trang-ket-qua-tim-kiem.png` | Trang tìm kiếm |
| `03-trang-chi-tiet-viec-lam.png` | Chi tiết việc làm |
| `04-popup-ung-tuyen-nhanh.png` | Popup ứng tuyển |
| `05-dashboard-nha-tuyen-dung.png` | Dashboard công ty |
| `06-mobile-trang-chu.png` | Mobile trang chủ |

---

## Những Phần Còn Mock (Chưa Làm Thật)

### ❌ Backend/API
- [ ] API endpoint cho jobs
- [ ] Database thật
- [ ] Server-side rendering
- [ ] API authentication

### ❌ Telegram Integration
- [ ] Bot nhận hồ sơ ứng tuyển
- [ ] Channel điều phối theo mã công ty
- [ ] Real-time notifications

### ❌ Authentication
- [ ] Đăng nhập ứng viên
- [ ] Đăng nhập nhà tuyển dụng
- [ ] JWT/session management
- [ ] Protected routes

### ❌ Advanced Features
- [ ] Real-time search/filter
- [ ] Geolocation "gần nhà"
- [ ] Upload CV/ảnh
- [ ] Chat giữa ứng viên và NTD
- [ ] Thanh toán thật
- [ ] Email notifications

### ✅ Đã Có (Mock)
- [x] Form ứng tuyển UI (chỉ hiển thị, chưa gửi dữ liệu)
- [x] Dashboard stats (mock data)
- [x] Success message sau ứng tuyển

---

## Responsive Checklist

| Kích thước | Trạng thái | Ghi chú |
|------------|------------|---------|
| 390px (iPhone 14) | ✅ Kiểm tra | Mobile nhỏ |
| 430px (iPhone 14 Pro Max) | ✅ Kiểm tra | Mobile lớn |
| 768px (iPad Mini) | ✅ Kiểm tra | Tablet |
| 1366px (Laptop) | ✅ Kiểm tra | Desktop |

### Mobile đã xử lý:
- Header có menu icon
- Filter xếp dọc (stack vertically)
- Job card hiển thị gọn
- Popup ứng tuyển căn giữa, không bị khuất nút
- Dashboard bảng có thể scroll ngang

---

## Cách Chạy Local

```bash
# Install dependencies
npm install

# Chạy dev server
npm run dev

# Mở trình duyệt
http://localhost:5175/
```

---

## Cách Build

```bash
# Build production
npm run build

# Preview bản build
npm run preview
```

**Output:** Thư mục `dist/` với các file đã optimize

---

## Brand & Design System

### Màu sắc
- **Navy:** `#071D3A` (brand-navy) - Header, primary buttons
- **Orange:** `#FF7A00` (brand-orange) - CTA, accent
- **Blue:** `#2563EB` (brand-blue) - Links, secondary
- **Surface:** `#F3F6FA` (brand-surface) - Background

### Typography
- **Font:** Be Vietnam Pro (Google Fonts)
- **Weights:** 400, 500, 600, 700, 800, 900

### Spacing
- Container max-width: `max-w-7xl` (1280px)
- Border radius cards: `rounded-2xl` (16px), `rounded-3xl` (24px)
- Padding sections: `px-4` mobile, `md:px-6` desktop

---

## Security & Privacy Notes

⚠️ **Quan trọng:** Hệ thống đang dùng mã nội bộ để bảo vệ thông tin công ty:
- Public UI: Chỉ hiển thị `CTY012 - MT004`
- Internal: Có mapping đến tên công ty thật và Telegram channel
- Địa điểm chi tiết: Ẩn, chỉ hiển thị quận/huyện + tỉnh

---

## Next Steps (Backend Phase)

1. Thiết kế database schema
2. Tạo API endpoints (REST/GraphQL)
3. Tích hợp Telegram Bot API
4. Authentication system
5. Deploy server

---

## Contact

**Hotline:** 1900 8888  
**Email:** hotro@vieclamgannha.com

---

## Keys và Clerk Login

### Quản lý Keys

**File chứa keys thật (local-only):**
- `docs/keys.md` - Chứa keys/API thật, tuyệt đối **KHÔNG push Git**
- Đã được thêm vào `.gitignore`

**File mẫu an toàn (được push):**
- `docs/keys.example.md` - Chỉ chứa placeholder, không có keys thật

**Git untracking:**
```bash
git rm --cached docs/keys.md
```

### Clerk Login Plan

**Tài liệu chi tiết:** `docs/clerk-code-login.txt`

**Mục tiêu:**
- Nhà tuyển dụng / Công ty: Đăng nhập bắt buộc để xem dashboard
- Ứng viên: KHÔNG cần đăng nhập, chỉ điền form nhanh

**Routes cần bảo vệ:**
- `/nha-tuyen-dung`
- `/nha-tuyen-dung/tin-tuyen-dung`
- `/nha-tuyen-dung/ung-vien`
- `/nha-tuyen-dung/goi-dich-vu`
- `/nha-tuyen-dung/cai-dat`

**Phase triển khai:**
- **Phase Clerk 01:** Setup cơ bản, UI login
- **Phase Clerk 02:** Company mapping, phân quyền đơn giản
- **Phase Clerk 03:** Webhook, roles, security

**⚠️ Trạng thái hiện tại:**
- Clerk login **chưa tích hợp thật** trong phase này
- Chỉ chuẩn bị tài liệu/plan
- Chờ keys thật để triển khai

---

*Document version: MVP-v0.1.0 + Backend Phase 01*
