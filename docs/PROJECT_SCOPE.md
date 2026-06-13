# Project Scope - ViecLamGanNha Phase 1

## Tổng quan

Nền tảng headhunt marketplace phân quyền rõ ràng, kết nối:
- **Nhà tuyển dụng (Company)**: Đăng chiến dịch, trả thưởng cho lead chất lượng
- **Cộng tác viên (CTV/Affiliate)**: Giới thiệu ứng viên, nhận hoa hồng
- **Ứng viên (Candidate)**: Tìm việc, ứng tuyển (không cần đăng nhập)

## Nguyên tắc Phân quyền (Role-Based)

### 1. Guest / Ứng viên (Public)
**Không đăng nhập, không thấy dữ liệu nhạy cảm**

**Thấy được:**
- Trang chủ, danh sách việc làm, chi tiết tin tuyển
- Form ứng tuyển nhanh (họ tên, SĐT, khu vực)
- Giới thiệu chương trình CTV/affiliate (public landing)

**Không thấy:**
- ❌ Dashboard công ty
- ❌ Dashboard CTV  
- ❌ Lead, hoa hồng, công nợ
- ❌ Dữ liệu ứng viên khác

---

### 2. CTV / Affiliate
**Đăng nhập CTV mode, chỉ thấy dữ liệu của mình**

**Thấy được:**
- Danh sách chiến dịch được phép chạy (public campaigns)
- Form gửi ứng viên (referral form)
- Lead của chính mình gửi
- Trạng thái lead: pending/approved/rejected
- Hoa hồng: chờ trả / đã trả (80% thực nhận)

**Không thấy:**
- ❌ Dashboard công ty
- ❌ Lead của CTV khác
- ❌ Công nợ công ty
- ❌ Dữ liệu toàn hệ thống

---

### 3. Company / Nhà tuyển dụng
**Đăng nhập Company mode, chỉ thấy dữ liệu của công ty họ**

**Thấy được:**
- Dashboard công ty (chỉ của họ)
- Chiến dịch của họ (tạo/sửa/tắt)
- Form tạo chiến dịch
- Tiền thưởng tự set cho mỗi lead
- Lead ẩn danh (trước khi nhận): chỉ thấy khu vực, ngành nghề
- Lead đã bấm "Nhận": unlock thông tin chi tiết
- Trạng thái tuyển dụng: contacted/interviewed/hired
- Thanh toán, cọc, hạn mức, công nợ của chính họ

**Không thấy:**
- ❌ Lead của công ty khác
- ❌ CTV khác (chỉ thấy referral ID ẩn danh)
- ❌ Kho ứng viên thô toàn hệ thống
- ❌ Danh sách SĐT hàng loạt

---

### 4. Admin
**Toàn quyền xem hệ thống**

**Thấy được:**
- Tất cả công ty, CTV, lead
- Chống trùng lead (deduplication)
- Lead lock, tranh chấp giữa các CTV
- Cọc/hạn mức/công nợ toàn hệ thống
- Báo cáo thuế tổng hợp
- Audit logs

---

## Luồng User

### Guest → Candidate
1. Vào trang chủ
2. Lọc việc làm theo khu vực
3. Xem chi tiết tin
4. Ứng tuyển (form nhanh, không cần login)
5. Nhận SMS/email xác nhận

### Guest → CTV
1. Xem landing "Trở thành CTV"
2. Đăng ký CTV (form + xác minh)
3. Chờ admin duyệt
4. Đăng nhập CTV mode
5. Chọn chiến dịch → Gửi ứng viên
6. Theo dõi lead và hoa hồng

### Guest → Company
1. Xem landing "Dành cho công ty"
2. Đăng ký công ty (form + xác minh doanh nghiệp)
3. Chờ admin duyệt
4. Nạp cọc / xác nhận hạn mức
5. Tạo chiến dịch tuyển dụng
6. Lead về → Nhận lead → Trả thưởng CTV

---

## Menu Structure

### Public Menu (Guest)
```
- Việc làm
- Dành cho công ty
- Cộng tác viên  
- Đăng nhập
```

### Company Menu (Sau đăng nhập)
```
- Dashboard công ty
- Chiến dịch của tôi
- Lead đã nhận
- Thanh toán
```

### CTV Menu (Sau đăng nhập)
```
- Dashboard CTV
- Chiến dịch đang chạy
- Gửi ứng viên
- Hoa hồng của tôi
```

### Admin Menu
```
- Admin Console
- Duyệt chiến dịch
- Quản lý lead
- Đối soát
- Báo cáo
```

---

## Phase Triển khai

### Phase 1: Foundation (Hiện tại)
- Public site: việc làm, ứng tuyển
- Backend cơ bản: SQLite, Telegram
- Role-based documentation (file này)

### Phase 2: Headhunt Core
- CTV registration & dashboard
- Referral form với tracking
- Lead deduplication (chống trùng)
- Lead lock mechanism

### Phase 3: Company Onboarding
- Company registration & verification
- Campaign management
- Lead unlock (nhận lead)
- Payment/cọc system

### Phase 4: Commission & Tax
- Commission calculation (80/20)
- Payout workflow
- Tax report engine
- Audit logs

### Phase 5: Scale
- PostgreSQL migration
- Redis for lead lock
- Advanced analytics
- API for partners

---

## Liên kết tài liệu

- `HEADHUNT_MARKETPLACE_PLAN.md` - Chi tiết marketplace
- `DATA_MODEL_DRAFT.md` - Database schema
- `ANTI_FRAUD_RULES.md` - Chống gian lận
- `TAX_REPORT_ENGINE.md` - Báo cáo thuế
- `MVP_ROADMAP.md` - Lộ trình cụ thể
