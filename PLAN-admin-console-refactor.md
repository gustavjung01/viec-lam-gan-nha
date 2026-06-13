# Admin Console Refactor Plan - Codex-5.5 Mini

Tách `AdminConsolePage.tsx` (941 dòng) thành module nhỏ và cập nhật backend API, rate limit, tài chính nội bộ, config screen.

---

## Phase 1: Cấu trúc thư mục và types

**Files tạo mới:**
- `src/pages/admin/types.ts` - Shared types cho tất cả tab components

**Nội dung types.ts:**
```typescript
export interface Campaign { id, campaign_code, title, company_name, company_code, status, visibility, bounty_amount, platform_fee_amount, ctv_reward_amount, total_leads }
export interface Lead { id, lead_code, campaign_id, campaign_title, company_id, company_name, ctv_id, ctv_name, candidate_name, candidate_phone, normalized_phone, zalo_phone, province, district, status, submitted_at, processed_by, notes }
export interface CTVAccount { id, ctv_code, name, phone, email, zalo_phone, province, district, bank_account, bank_name, status, rejection_reason, submitted_at, created_at }
export interface CompanyAccount { id, company_code, name, phone, email, tax_code, address, province, district, status, rejection_reason, submitted_at, created_at }
export interface AuditLog { id, entity_type, entity_id, action, actor_role, actor_id, details, created_at }
export interface TaxReport { summary: { total_qualified_leads, total_company_bounty, total_platform_fees_20_percent, total_ctv_payouts_80_percent }, split_verification: { math_check } }
export interface LeadStatusHistory { id, lead_id, from_status, to_status, changed_by_role, changed_by_id, reason, created_at }
```

**Constants dùng chung:**
```typescript
export const TABS = ['Tổng quan', 'CTV', 'Công ty', 'Chiến dịch', 'Lead', 'Tài chính nội bộ', 'Cấu hình'];
export const TH_CLASS = "px-4 py-3 text-left text-sm font-semibold text-slate-700";
export const TH_CENTER_CLASS = "px-4 py-3 text-center text-sm font-semibold text-slate-700";
export const TD_CLASS = "px-4 py-3 text-sm text-slate-600";
export const TD_CENTER_CLASS = "px-4 py-3 text-center text-sm";
```

---

## Phase 2: Tách thành 7 tab components

### Tab 1: AdminOverviewTab.tsx (200 dòng)
**Input props:** `{ campaigns, leads, ctvAccounts, companyAccounts, taxReport }`

**Chức năng:**
- Hiển thị 4 stat cards: Chiến dịch, Tổng Lead, CTV chờ duyệt, Công ty chờ duyệt
- Section "Cảnh báo & Tranh chấp" - đếm disputed leads

**Copy logic từ:** `AdminConsolePage.tsx` lines 484-508

---

### Tab 2: AdminLeadTab.tsx (400 dòng)
**Input props:**
```typescript
interface Props {
  leads: Lead[];
  pagination: { page, limit, total, totalPages, hasMore };
  loading: boolean;
  filters: { search, status, campaignId, companyId, ctvId, province, district, dateFrom, dateTo };
  onSearchChange: (search: string) => void;
  onFilterChange: (key: string, value: string) => void;
  onPageChange: (page: number) => void;
  onViewDetails: (lead: Lead) => void;
}
```

**UI Bảng Lead (12 cột):**
| Cột | Nội dung |
|-----|----------|
| Mã lead | `lead_code` |
| Ngày gửi | `submitted_at` format dd/mm/yyyy |
| Ứng viên | `candidate_name` |
| SĐT/Zalo | Hiển thị `zalo_phone` nếu có, else `candidate_phone` |
| Khu vực | `province` + `district` |
| Campaign | `campaign_title` |
| Công ty | `company_name` |
| CTV/Nguồn | `ctv_name` hoặc "Direct" |
| Trạng thái | `<StatusBadge status={status} />` |
| Người xử lý | `processed_by` hoặc "-" |
| Thao tác | Button "Chi tiết" mở modal |

**Filters UI:**
- Search input (debounce 500ms)
- Status dropdown: all, submitted, approved, rejected, claimed, interviewing, hired, qualified, disputed, closed
- Campaign select (fetch từ `/api/admin/campaigns`)
- Company select (fetch từ `/api/admin/companies`)
- CTV select (fetch từ `/api/admin/ctv`)
- Province/District select
- Date range: from - to

**Copy logic từ:** `AdminConsolePage.tsx` lines 652-770 (LeadTab component), nhưng bỏ cột "Chiến dịch" thứ 2, thêm các cột mới.

---

### Tab 3: AdminCtvTab.tsx (250 dòng)
**Input props:** `{ ctvAccounts: CTVAccount[], onSearch, onFilter, onAction }`

**UI:**
- FilterControls component
- Bảng 5 cột: Họ tên, SĐT/Email, Khu vực, Trạng thái, Thao tác

**Copy logic từ:** `AdminConsolePage.tsx` lines 526-569

---

### Tab 4: AdminCompanyTab.tsx (250 dòng)
**Input props:** `{ companyAccounts: CompanyAccount[], onSearch, onFilter, onAction }`

**UI:**
- FilterControls component  
- Bảng 5 cột: Tên công ty, SĐT/Email, Mã số thuế, Trạng thái, Thao tác

**Copy logic từ:** `AdminConsolePage.tsx` lines 572-615

---

### Tab 5: AdminCampaignTab.tsx (200 dòng)
**Input props:** `{ campaigns: Campaign[], onAction }`

**UI:**
- Bảng 5 cột: Chiến dịch, Công ty, Trạng thái, Visibility, Thao tác

**Copy logic từ:** `AdminConsolePage.tsx` lines 618-650

---

### Tab 6: AdminFinanceTab.tsx (350 dòng)
**Input props:** `{ taxReport: TaxReport }`

**Yêu cầu:**
- Đổi title từ "Tài chính" → "Tài chính nội bộ"
- Thêm bộ lọc theo tháng (month picker)
- Thêm nút Export báo cáo (CSV/Excel)
- **QUAN TRỌNG:** Hiển thị "20/80" split CHỈ ở đây, không leak ra CTV/Company UI

**UI:**
- Stat cards: Tổng qualified leads, Tổng bounty, Platform fees (20%), CTV payouts (80%)
- Bảng chi tiết các leads qualified
- Nút Export

---

### Tab 7: AdminConfigTab.tsx (300 dòng)
**Yêu cầu:** Không dùng placeholder

**Hiển thị config thật:**
- App version (from package.json hoặc env)
- Database path (cảnh báo nếu sai)
- Rate limit config (admin read limit, login limit, default limit)
- Public mode status
- Backend health status (gọi `/api/health`)

---

## Phase 3: AdminConsolePage.tsx gọn lại (200 dòng)

**Structure mới:**
```typescript
import { AdminOverviewTab } from './tabs/AdminOverviewTab';
import { AdminLeadTab } from './tabs/AdminLeadTab';
// ... other imports

export function AdminConsolePage() {
  // State declarations (giữ nguyên)
  const [session, setSession] = useState(...);
  // ... all other states

  // Handlers (giữ nguyên logic)
  const handleLogin = async () => { ... };
  const handleLogout = () => { ... };
  const fetchLeads = async (...) => { ... };
  const fetchData = async (...) => { ... };
  const handleGenericAction = async (...) => { ... };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'Tổng quan': return <AdminOverviewTab stats={{ campaigns, leads, ctvAccounts, companyAccounts, taxReport }} />;
      case 'Lead': return <AdminLeadTab leads={leads} pagination={leadsPagination} ... />;
      // ... other tabs
    }
  };

  // Return JSX gọn (chỉ layout + tab switcher)
}
```

---

## Phase 4: Backend API Updates

### File: `backend/src/routes/marketplace.js`

**Update GET `/api/admin/leads`:**

**Current (lines 798-878):**
- Chỉ hỗ trợ: page, limit, status, search, campaign_id, company_id, ctv_id
- Không có: province, district, date_from, date_to
- Search đã có nhưng có thể mở rộng

**Update thêm params:**
```javascript
const { 
  page = 1, 
  limit = 10, 
  status, 
  search, 
  campaign_id, 
  company_id, 
  ctv_id,
  province,      // NEW
  district,      // NEW
  date_from,    // NEW - ISO date string
  date_to       // NEW - ISO date string
} = req.query;

// Thêm vào whereClause:
if (province) { whereClause += ' AND cd.province = ?'; params.push(province); }
if (district) { whereClause += ' AND cd.district = ?'; params.push(district); }
if (date_from) { whereClause += ' AND ls.submitted_at >= ?'; params.push(date_from); }
if (date_to) { whereClause += ' AND ls.submitted_at <= ?'; params.push(date_to); }
```

**Response đã có hasMore:**
```javascript
pagination: {
  total, page, limit, totalPages,
  hasMore: page < totalPages  // Đã có, giữ nguyên
}
```

---

## Phase 5: Modal LeadDetails mới

### File: `src/pages/admin/components/LeadDetailsModal.tsx`

**Props:**
```typescript
interface Props {
  lead: Lead;
  onClose: () => void;
  onStatusChange: (leadId: string, newStatus: string, reason?: string) => void;
  onAddNote: (leadId: string, note: string) => void;
}
```

**UI Sections:**
1. **Header:** Mã lead, Ngày gửi, Status badge, Nút đóng
2. **Thông tin ứng viên:** Họ tên, SĐT (có nút Copy), Zalo phone, Khu vực
3. **Campaign/Công ty/CTV:** Hiển thị đầy đủ thông tin
4. **Lịch sử status:** Timeline các thay đổi (gọi API `/api/admin/leads/:id/history` nếu có, hoặc hiển thị status hiện tại)
5. **Ghi chú admin:** Textarea + nút Lưu
6. **Actions:**
   - Dropdown đổi trạng thái (với validate: nếu "rejected" bắt buộc nhập lý do)
   - Nút Copy SĐT
   - Nút mở Zalo (link: `https://zalo.me/{phone}`)

---

## Phase 6: Rate Limit Fix

### File: `backend/server.js`

**Current issue (line 66 & 98):**
```javascript
app.use('/api/', limiter);           // Line 66 - Apply to all /api/
app.use('/api', limiter, marketplaceRoutes);  // Line 98 - Apply again!
```

**Fix:**
```javascript
// Remove duplicate at line 98, change to:
app.use('/api/admin', adminAuth, adminReadLimiter, marketplaceRoutes);  // Admin APIs with relaxed limit

// Keep general limiter for other routes
app.use('/api/', limiter);

// Specific limiters
app.use('/api/apply', applyLimiter, applyRoutes);
app.use('/api/admin/auth', strictLimiter, adminAuthRoutes);  // Strict for login
```

**Add new limiters:**
```javascript
// Relaxed limit for admin read operations
const adminReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,  // 1000 requests per 15 min for admin
  message: { success: false, message: 'Quá nhiều request' }
});

// Strict limit for login
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,  // 10 login attempts per 15 min
  message: { success: false, message: 'Quá nhiều lần đăng nhập thất bại' }
});
```

---

## Phase 7: Hide 20/80 from Public UI

### Kiểm tra và sửa các file:

**`src/pages/ctv/CTVDashboardPage.tsx`:**
- Line 451-454: Hiển thị "80% thực nhận" và bounty_amount gạch ngang
- **Sửa:** Chỉ hiển thị `ctv_reward_amount`, KHÔNG hiển thị % và bounty_amount

**`src/pages/company/CompanyDashboardPage.tsx`:**
- Kiểm tra không hiển thị platform_fee_amount hay % chia 20/80
- Company chỉ thấy bounty_amount họ trả

---

## Execution Order for Codex-5.5 Mini

1. **Step 1:** Tạo `src/pages/admin/types.ts` với tất cả interfaces
2. **Step 2:** Tạo thư mục `src/pages/admin/tabs/`
3. **Step 3:** Tạo 7 tab components (làm theo thứ tự: Overview → Lead → CTV → Company → Campaign → Finance → Config)
4. **Step 4:** Tạo `src/pages/admin/components/LeadDetailsModal.tsx`
5. **Step 5:** Refactor `AdminConsolePage.tsx` - giữ lại chỉ ~200 dòng core logic
6. **Step 6:** Update `backend/src/routes/marketplace.js` - mở rộng API `/api/admin/leads`
7. **Step 7:** Fix rate limit `backend/server.js` - gỡ duplicate, thêm adminReadLimiter
8. **Step 8:** Kiểm tra và sửa CTV/Company UI - ẩn 20/80 split
9. **Step 9:** Build test - `npm run build` phải pass
10. **Step 10:** Verify types - `npx tsc --noEmit` phải pass

---

## Success Criteria

- [ ] `AdminConsolePage.tsx` < 300 dòng
- [ ] 7 tab files tách riêng, mỗi file < 400 dòng
- [ ] `/api/admin/leads` hỗ trợ đầy đủ filter params
- [ ] Lead table hiển thị đúng 12 cột theo yêu cầu
- [ ] Lead modal có copy SĐT, ghi chú, đổi status
- [ ] Rate limit không còn duplicate
- [ ] Login API có limit riêng nghiêm ngặt
- [ ] Tài chính tab đổi thành "Tài chính nội bộ", có export
- [ ] CTV/Company UI không thấy 20/80 split
- [ ] Config tab hiển thị config thật, không placeholder
- [ ] Build pass, không lỗi TypeScript
