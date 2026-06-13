# Headhunt Marketplace Plan

## Mô hình kinh doanh

### 3 bên tham gia

| Bên | Vai trò | Lợi ích |
|-----|---------|---------|
| **Company** | Đăng chiến dịch, cần tuyển | Nhận lead chất lượng từ CTV |
| **CTV/Affiliate** | Giới thiệu ứng viên | Hoa hồng 80% mỗi lead hợp lệ |
| **Platform** | Trung gian, công nghệ | Giữ 20% mỗi lead |

---

## Luồng Lead

### 1. CTV gửi ứng viên
```
CTV chọn chiến dịch
  → Điền form: Họ tên, SĐT, Khu vực, Ghi chú
  → Hệ thống check trùng (dedup)
  → Lead vào "Chờ duyệt" / hoặc auto-approved nếu chưa có
```

### 2. Lead Matching
```
Lead gửi vào
  → Check: SĐT đã có trong hệ thống?
    → Có → Check thời gian gửi trước (cooldown 30 ngày)
      → Trong 30 ngày: Reject (trùng)
      → Quá 30 ngày: Mở lại cho CTV khác
    → Không → Approved
```

### 3. Company nhận Lead
```
Lead approved
  → Hiện trong "Lead ẩn danh" của Company
    → Chỉ thấy: Khu vực, Ngành nghề, Thời gian gửi
    → Không thấy: Họ tên, SĐT, CTV nào gửi
  → Company bấm "Nhận lead"
    → Trừ tiền trong ví/hạn mức
    → Unlock thông tin: Họ tên, SĐT
    → Hiện CTV referral ID (ẩn danh)
```

### 4. Thanh toán CTV
```
Lead đã nhận bởi Company
  → Hệ thống tính hoa hồng: Thưởng × 80%
  → Chuyển sang trạng thái "Chờ trả"
  → Sau 14 ngày (hoặc confirmed): Chuyển "Đã trả" → CTV rút tiền
```

---

## Chiến dịch (Campaign)

### Cấu trúc chiến dịch

```typescript
interface Campaign {
  id: string;
  companyId: string;
  title: string;           // "Tuyển bảo vệ ca đêm KCN Tân Bình"
  description: string;
  location: {
    province: string;
    district: string;
  };
  industry: string;        // "Bảo vệ" | "Lao động phổ thông"
  
  // Thưởng
  rewardAmount: number;    // VD: 500000 (500k/lead)
  currency: 'VND';
  
  // Điều kiện
  requirements: string[];  // ["Có CMND", "Đủ 18 tuổi"]
  
  // Trạng thái
  status: 'pending' | 'approved' | 'running' | 'paused' | 'completed';
  
  // Giới hạn
  maxLeads: number;        // Tối đa lead nhận
  currentLeads: number;    // Đã nhận
  
  // Thời gian
  startDate: Date;
  endDate: Date;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
}
```

### Trạng thái chiến dịch

| Status | Ý nghĩa | CTV thấy? |
|--------|---------|-----------|
| `pending` | Chờ admin duyệt | ❌ Không |
| `approved` | Đã duyệt, chưa chạy | ❌ Không |
| `running` | Đang chạy | ✅ Có |
| `paused` | Tạm dừng | ❌ Không |
| `completed` | Đã kết thúc | ❌ Không |

---

## Lead Lock Mechanism

### Vấn đề: Tranh chấp lead
2 CTV cùng gửi 1 ứng viên trong thời gian ngắn

### Giải pháp: Lock + Cooldown

```
CTV A gửi lead (SĐT: 0901234567)
  → Hệ thống tạo LEAD với status: pending
  → Lock SĐT 0901234567 trong 30 phút (chờ duyệt)
    → CTV B gửi cùng SĐT trong 30 phút
      → Reject: "Lead đang được xử lý bởi CTV khác"
  
  → Sau 30 phút:
    → Approved → Lock 30 ngày (không cho CTV khác gửi)
    → Rejected → Unlock ngay
```

### Cooldown Matrix

| Tình huống | Cooldown | Lý do |
|------------|----------|-------|
| Lead pending | 30 phút | Chờ duyệt |
| Lead approved | 30 ngày | Bảo vệ CTV đầu tiên |
| Lead rejected | 0 | Cho phép CTV khác thử lại |
| Company đã nhận | 90 ngày | Không spam cùng công ty |

---

## Commission Structure

### Tỷ lệ chia

```
Lead value: 500.000 VND (do Company set)

CTV nhận:     400.000 VND (80%)
Platform giữ: 100.000 VND (20%)
```

### Điều kiện nhận hoa hồng

| Điều kiện | Giải thích |
|-----------|------------|
| Lead hợp lệ | Không trùng, đúng format |
| Company đã nhận | Đã bấm "Nhận" và trừ tiền |
| Không fraud | Không báo cáo gian lận từ Company |
| Qua thời gian chờ | 14 ngày sau khi Company nhận |

### Trạng thái hoa hồng

```
pending → approved → waiting_payout → paid
   ↑          ↑            ↑           ↑
  Gửi      Duyệt      Chờ 14d     Đã trả
```

---

## Chống trùng (Deduplication)

### Key để check trùng

| Level | Key | Cooldown |
|-------|-----|----------|
| Phone | SĐT chuẩn hóa | 30 ngày |
| Email | Email (nếu có) | 30 ngày |
| ID Card | CMND/CCCD | 90 ngày |

### Scenarios

| Scenario | Kết quả | Ghi chú |
|----------|---------|---------|
| CTV A gửi → Approved | CTV A được hoa hồng | Nếu Company nhận |
| CTV B gửi cùng SĐT sau 5 phút | Reject | Lead đang pending |
| CTV C gửi sau 35 ngày | New lead | Cooldown hết |
| Company đã tuyển người này | Reject | Check hired status |

---

## Privacy & Data Protection

### Nguyên tắc

1. **CTV không thấy lead của CTV khác**
2. **Company không thấy lead cho đến khi trả tiền**
3. **SĐT/email ẩn cho đến khi unlock**
4. **CTV ẩn danh đối với Company** (chỉ thấy referral ID)

### Data visibility matrix

| Data | CTV | Company (trước nhận) | Company (sau nhận) | Admin |
|------|-----|---------------------|-------------------|-------|
| Họ tên ứng viên | ✅ | ❌ | ✅ | ✅ |
| SĐT ứng viên | ✅ | ❌ | ✅ | ✅ |
| CTV gửi | ✅ (mình) | ❌ | 🔶 (ID ẩn danh) | ✅ |
| Company nhận | ❌ | N/A | N/A | ✅ |
| Reward amount | ✅ | N/A | N/A | ✅ |

---

## API Endpoints (Draft)

### CTV
```
GET  /api/ctv/campaigns           → Danh sách chiến dịch running
POST /api/ctv/leads               → Gửi lead mới
GET  /api/ctv/leads/my            → Lead của tôi
GET  /api/ctv/commissions         → Hoa hồng của tôi
POST /api/ctv/withdraw            → Yêu cầu rút tiền
```

### Company
```
GET  /api/company/campaigns       → Chiến dịch của tôi
POST /api/company/campaigns       → Tạo chiến dịch
GET  /api/company/leads/pending   → Lead ẩn danh
POST /api/company/leads/:id/claim → Nhận lead (trừ tiền)
GET  /api/company/leads/claimed    → Lead đã nhận
GET  /api/company/balance         → Số dư/hạn mức
```

### Admin
```
GET  /api/admin/campaigns         → Tất cả chiến dịch
POST /api/admin/campaigns/:id/approve → Duyệt chiến dịch
GET  /api/admin/leads             → Tất cả lead
GET  /api/admin/ctv               → Tất cả CTV
GET  /api/admin/companies         → Tất cả công ty
GET  /api/admin/audit-logs        → Audit logs
```

---

## Metrics cần track

| Metric | Ý nghĩa |
|--------|---------|
| Lead submission rate | Số lead gửi / CTV active / ngày |
| Approval rate | % lead được approve |
| Claim rate | % lead được Company nhận |
| Time to claim | Trung bình thời gian từ gửi đến nhận |
| CTV retention | % CTV vẫn active sau 30 ngày |
| Company retention | % Company có chiến dịch lặp lại |
| Fraud detection | Số lead flagged / tổng lead |

---

## Risk & Mitigation

| Rủi ro | Mitigation |
|--------|------------|
| Fake leads | Verify SĐT qua OTP, check pattern |
| CTV tự gửi lead ảo | Cooldown, rate limiting, audit |
| Company không trả | Cọc trước, hạn mức, escrow |
| Data leak | Encryption at rest, audit logs |
| Dispute | Admin console, evidence log |
