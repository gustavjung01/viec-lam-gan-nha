# MVP Roadmap - ViecLamGanNha

## Hiện trạng (Current State)

✅ **Frontend MVP**: Public site với việc làm, ứng tuyển  
✅ **Backend Phase 01**: SQLite, Telegram notifications  
✅ **Documentation**: Project scope, data model, fraud rules, tax engine  
⏳ **Clerk Auth**: Plan sẵn, chưa tích hợp  
⏳ **Assets**: Ảnh thật đã map, sẵn sàng deploy  

---

## Phase 1: Foundation (Đã hoàn thành)

**Mục tiêu**: Public MVP chạy được

| Task | Status | File liên quan |
|------|--------|----------------|
| Frontend React + Vite | ✅ Done | `src/` |
| Routing 4 pages | ✅ Done | `App.tsx` |
| Hero + Search | ✅ Done | `HeroSearch.tsx` |
| Job listing | ✅ Done | `JobsPage.tsx` |
| Job detail + Apply | ✅ Done | `JobDetailPage.tsx` |
| Employer dashboard UI | ✅ Done | `EmployerDashboardPage.tsx` |
| Assets mapped | ✅ Done | `public/images/` |
| Backend SQLite + API | ✅ Done | `backend/` |
| Telegram notifications | ✅ Done | `backend/src/telegram.js` |

**Output**: Demo public site hoạt động

---

## Phase 2: Clerk Authentication (Next)

**Mục tiêu**: Đăng nhập phân quyền

| Task | Effort | Dependencies |
|------|--------|--------------|
| Cài Clerk React SDK | 2h | Clerk account |
| Bọc App với ClerkProvider | 2h | SDK cài xong |
| Tạo trang /dang-nhap | 4h | ClerkProvider |
| Tạo trang /dang-ky | 4h | ClerkProvider |
| Protected routes wrapper | 4h | Trang login |
| Role detection (user.role) | 4h | Login xong |
| Header với UserButton | 2h | Login xong |
| Test multi-role | 4h | All above |

**Total**: ~26 giờ  
**Output**: User đăng nhập, thấy UI khác nhau theo role

---

## Phase 3: CTV Dashboard (Headhunt Core)

**Mục tiêu**: CTV có thể gửi lead, xem hoa hồng

| Task | Effort | Dependencies |
|------|--------|--------------|
| CTV registration flow | 8h | Clerk auth |
| CTV profile form | 4h | Registration |
| Admin approve CTV | 4h | Profile form |
| CTV dashboard UI | 8h | Approved CTV |
| Campaign list (public) | 4h | Dashboard |
| Lead submit form | 8h | Campaign list |
| Phone dedup logic | 8h | Lead submit |
| Cooldown mechanism | 8h | Phone dedup |
| My leads page | 4h | Lead submit |
| Commission tracking | 8h | My leads |

**Total**: ~56 giờ  
**Output**: CTV đăng ký → được duyệt → chọn chiến dịch → gửi lead → xem hoa hồng

---

## Phase 4: Company Dashboard

**Mục tiêu**: Công ty tạo chiến dịch, nhận lead, thanh toán

| Task | Effort | Dependencies |
|------|--------|--------------|
| Company registration | 8h | Clerk auth |
| Admin verify company | 4h | Registration |
| Company profile | 4h | Verification |
| Wallet/deposit system | 16h | Company profile |
| Campaign creation form | 8h | Wallet |
| Admin approve campaign | 4h | Campaign form |
| My campaigns list | 4h | Approve flow |
| Lead inbox (ẩn danh) | 8h | Lead từ CTV |
| Lead claim (trừ tiền) | 12h | Lead inbox |
| Payment history | 8h | Lead claim |

**Total**: ~72 giờ  
**Output**: Company tạo chiến dịch, nhận lead, quản lý thanh toán

---

## Phase 5: Admin Console

**Mục tiêu**: Quản lý toàn hệ thống

| Task | Effort | Dependencies |
|------|--------|--------------|
| Admin middleware | 4h | Clerk auth |
| Admin dashboard UI | 8h | Middleware |
| User management | 8h | Dashboard |
| CTV approval queue | 4h | User mgmt |
| Company verification queue | 4h | User mgmt |
| Campaign approval | 4h | Queue |
| Lead audit view | 8h | All above |
| Dispute resolution | 12h | Lead audit |
| Audit logs viewer | 8h | Dispute |

**Total**: ~48 giờ  
**Output**: Admin duyệt CTV, công ty, chiến dịch; xử lý tranh chấp

---

## Phase 6: Commission & Payout

**Mục tiêu**: Tính toán và thanh toán hoa hồng

| Task | Effort | Dependencies |
|------|--------|--------------|
| Commission calculation (80/20) | 8h | Lead claimed |
| Commission approval workflow | 8h | Calculation |
| 14-day hold mechanism | 8h | Approval |
| CTV payout request | 8h | Hold done |
| Admin payout approval | 8h | Request |
| Payment gateway integration | 16h | Approval |
| Commission history | 4h | Payment |
| Tax withholding (10%) | 16h | Commission |

**Total**: ~76 giờ  
**Output**: CTV rút tiền, platform thu phí, đóng thuế

---

## Phase 7: Anti-Fraud & Security

**Mục tiêu**: Chống gian lận, bảo vệ dữ liệu

| Task | Effort | Dependencies |
|------|--------|--------------|
| IP + device fingerprint | 8h | Lead submit |
| Rate limiting | 8h | IP tracking |
| CTV trust score | 16h | Lead history |
| Company reputation score | 16h | Payment history |
| Fraud detection alerts | 12h | Scores |
| Auto-ban mechanism | 8h | Alerts |
| Appeal process | 8h | Auto-ban |
| Data encryption | 16h | Security |

**Total**: ~92 giờ  
**Output**: Hệ thống tự động phát hiện và xử lý gian lận

---

## Phase 8: Scale & Optimize

**Mục tiêu**: Sẵn sàng production scale

| Task | Effort | Dependencies |
|------|--------|--------------|
| PostgreSQL migration | 16h | All phases |
| Redis for caching | 12h | PostgreSQL |
| Redis for phone lock | 8h | Redis setup |
| CDN for assets | 4h | Deploy |
| Monitoring (Sentry) | 8h | Deploy |
| Analytics (Mixpanel) | 8h | Deploy |
| API rate limiting | 8h | Monitoring |
| Backup strategy | 8h | PostgreSQL |

**Total**: ~72 giờ  
**Output**: Production-ready, scalable, monitored

---

## Timeline Tóm Tắt

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 1. Foundation | ✅ Done | Week 0 |
| 2. Clerk Auth | 1 week | Week 1 |
| 3. CTV Dashboard | 2 weeks | Week 3 |
| 4. Company Dashboard | 2 weeks | Week 5 |
| 5. Admin Console | 1.5 weeks | Week 6.5 |
| 6. Commission | 2 weeks | Week 8.5 |
| 7. Anti-Fraud | 2 weeks | Week 10.5 |
| 8. Scale | 1.5 weeks | Week 12 |

**Total**: ~12 tuần (3 tháng) với 1 developer full-time  
**Team 2 devs**: ~6-8 tuần

---

## Quyết định cần làm

### Ngay bây giờ
1. **Triển khai Clerk không?**
   - Có → Phase 2 sẵn sàng
   - Không → Giữ public site, hoãn marketplace

2. **Thứ tự ưu tiên:**
   - Ưu tiên CTV trước (để có nguồn lead)
   - Hoặc Company trước (để có nhu cầu tuyển)

3. **Payment gateway:**
   - Momo?
   - Bank transfer?
   - Stripe?

### Sau Phase 5
4. **Tax reporting tự động:**
   - Tích hợp API Tổng cục Thuế?
   - Hay export file thủ công?

5. **Mobile app:**
   - PWA đủ không?
   - Hay cần native app?

---

## File Documentation

- `PROJECT_SCOPE.md` - Overview và role-based design
- `HEADHUNT_MARKETPLACE_PLAN.md` - Business logic
- `DATA_MODEL_DRAFT.md` - Database schema
- `ANTI_FRAUD_RULES.md` - Fraud detection
- `TAX_REPORT_ENGINE.md` - Tax reporting
- `MVP_ROADMAP.md` - File này

---

## Next Action

**Chờ quyết định từ anh Khương:**
1. Có triển khai Clerk authentication không?
2. Ưu tiên xây CTV dashboard hay Company dashboard trước?
3. Timeline kỳ vọng?

Sau khi có quyết định, có thể bắt đầu Phase 2 ngay.
