# Data Model Draft - Headhunt Marketplace

## Entity Overview

| Entity | Mô tả | Chủ sở hữu dữ liệu |
|--------|-------|-------------------|
| `users` | Tài khoản (Clerk) | System |
| `candidates` | Thông tin ứng viên | System |
| `companies` | Công ty tuyển dụng | Company |
| `ctvs` | Cộng tác viên | CTV |
| `campaigns` | Chiến dịch tuyển dụng | Company |
| `leads` | Lead ứng viên | CTV (who submitted) |
| `commissions` | Hoa hồng | CTV |
| `payments` | Thanh toán/cọc | Company |
| `audit_logs` | Lịch sử thay đổi | Admin |

---

## 1. Users (Authentication)

```typescript
interface User {
  id: string;                    // Clerk user_id
  clerkId: string;               // Clerk identifier
  email: string;
  phone?: string;
  
  role: 'guest' | 'candidate' | 'ctv' | 'company' | 'admin';
  
  // Role-specific IDs
  candidateId?: string;          // FK to candidates
  ctvId?: string;                // FK to ctvs
  companyId?: string;            // FK to companies
  
  // Metadata
  createdAt: Date;
  lastLoginAt: Date;
  isActive: boolean;
  
  // Security
  emailVerified: boolean;
  phoneVerified: boolean;
}
```

---

## 2. Candidates (Ứng viên)

```typescript
interface Candidate {
  id: string;
  
  // Thông tin cá nhân
  fullName: string;
  phone: string;                 // Normalized: 0901234567
  email?: string;
  
  // Phân loại
  province: string;
  district: string;
  industry: string;              // "Bảo vệ", "Lao động phổ thông"
  
  // Trạng thái
  status: 'active' | 'hired' | 'blacklisted';
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Chống trùng
  phoneHash: string;             // SHA256 của phone chuẩn hóa
}

// Index: phone (unique), phoneHash (unique)
```

---

## 3. Companies (Nhà tuyển dụng)

```typescript
interface Company {
  id: string;
  code: string;                  // CTY001, CTY002...
  
  // Thông tin doanh nghiệp
  companyName: string;            // Tên thật (chỉ admin thấy)
  displayName: string;            // Tên hiển thị công khai
  taxId?: string;                 // Mã số thuế
  
  // Contact
  email: string;
  phone: string;
  telegramChatId?: string;       // Nhận thông báo
  
  // Tài chính
  wallet: {
    balance: number;              // Số dư hiện tại
    deposited: number;            // Tổng đã nạp
    spent: number;                // Tổng đã chi
    creditLimit: number;          // Hạn mức tín dụng
  };
  
  // Trạng thái
  status: 'pending' | 'verified' | 'suspended' | 'banned';
  verifiedAt?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  ownerUserId: string;           // FK to users
}
```

---

## 4. CTVs (Cộng tác viên)

```typescript
interface CTV {
  id: string;
  referralCode: string;           // CTV001, CTV002...
  
  // Thông tin cá nhân
  fullName: string;
  phone: string;
  email: string;
  
  // Địa chỉ nhận tiền
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
  
  // Tài chính
  wallet: {
    balance: number;              // Có thể rút
    pending: number;              // Chờ 14 ngày
    totalEarned: number;          // Tổng đã nhận
  };
  
  // Trạng thái
  status: 'pending' | 'active' | 'suspended' | 'banned';
  approvedAt?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  userId: string;                // FK to users
}
```

---

## 5. Campaigns (Chiến dịch)

```typescript
interface Campaign {
  id: string;
  campaignCode: string;           // Auto-generate: CMP001
  
  // Relations
  companyId: string;              // FK to companies
  companyCode: string;            // Denormalized
  
  // Thông tin chiến dịch
  title: string;                  // "Tuyển bảo vệ KCN Tân Bình"
  description: string;
  
  // Vị trí
  province: string;
  district: string;
  industry: string;
  
  // Thưởng
  rewardAmount: number;           // VD: 500000
  currency: 'VND';
  
  // Yêu cầu
  requirements: string[];           // ["Có CMND", "Đủ 18 tuổi"]
  
  // Giới hạn
  maxLeads: number;               // Tối đa lead
  currentLeads: number;           // Đã nhận
  
  // Thời gian
  startDate: Date;
  endDate: Date;
  
  // Trạng thái
  status: 'draft' | 'pending' | 'approved' | 'running' | 'paused' | 'completed';
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  approvedBy?: string;            // Admin user_id
}

// Index: companyId, status, province+industry
```

---

## 6. Leads (Lead ứng viên)

```typescript
interface Lead {
  id: string;
  leadCode: string;               // Auto-generate: LED001
  
  // Relations
  campaignId: string;               // FK to campaigns
  candidateId: string;            // FK to candidates
  ctvId: string;                  // FK to ctvs (người gửi)
  
  // Thông tin ứng viên (denormalized cho query)
  candidateName: string;            // Encrypted
  candidatePhone: string;           // Encrypted
  candidateProvince: string;
  candidateDistrict: string;
  candidateIndustry: string;
  
  // Nội dung gửi
  note?: string;
  
  // Trạng thái lead
  status: 'pending' | 'approved' | 'rejected' | 'claimed' | 'hired' | 'expired';
  
  // Timeline
  submittedAt: Date;              // CTV gửi
  approvedAt?: Date;              // Admin/Auto approve
  claimedAt?: Date;               // Company nhận
  hiredAt?: Date;                 // Ứng viên được tuyển
  
  // Claim info
  claimedByCompanyId?: string;    // Company đã nhận
  claimPrice?: number;            // Số tiền trả khi nhận
  
  // Commission
  commission: {
    totalAmount: number;           // Thưởng gốc
    ctvShare: number;              // 80%
    platformShare: number;         // 20%
    status: 'pending' | 'approved' | 'paid';
    paidAt?: Date;
  };
  
  // Chống trùng
  phoneHash: string;              // SHA256 của phone
  cooldownUntil: Date;            // Không cho CTV khác gửi
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Security - Encrypted fields
  _encrypted: {
    fullName: string;
    phone: string;
    email?: string;
  };
}

// Index: phoneHash, ctvId, campaignId, status, cooldownUntil
```

---

## 7. Commissions (Hoa hồng)

```typescript
interface Commission {
  id: string;
  
  // Relations
  leadId: string;
  ctvId: string;
  campaignId: string;
  companyId: string;
  
  // Số tiền
  amount: number;                   // CTV nhận (80%)
  originalReward: number;         // Thưởng gốc
  platformFee: number;            // 20%
  
  // Trạng thái
  status: 'pending' | 'approved' | 'ready' | 'paid' | 'cancelled';
  
  // Timeline
  calculatedAt: Date;
  approvedAt?: Date;
  readyAt?: Date;                 // Sau 14 ngày
  paidAt?: Date;
  
  // Thanh toán
  payoutMethod?: 'bank_transfer' | 'momo' | 'cash';
  payoutReference?: string;       // Mã giao dịch
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 8. Payments (Thanh toán/Cọc)

```typescript
interface Payment {
  id: string;
  
  // Relations
  companyId: string;
  
  // Loại giao dịch
  type: 'deposit' | 'withdrawal' | 'lead_claim' | 'refund' | 'fee';
  
  // Số tiền
  amount: number;
  currency: 'VND';
  
  // Mô tả
  description: string;
  
  // Reference
  referenceId?: string;           // Lead ID nếu là lead_claim
  
  // Trạng thái
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  
  // Payment method
  method: 'bank_transfer' | 'momo' | 'zalopay' | 'cash';
  
  // Thông tin giao dịch bên ngoài
  externalTransactionId?: string;
  
  // Timeline
  createdAt: Date;
  completedAt?: Date;
  
  // Metadata
  metadata?: Record<string, any>;
}
```

---

## 9. Audit Logs

```typescript
interface AuditLog {
  id: string;
  
  // Who
  userId?: string;                // Nếu có user thực hiện
  userRole?: string;              // Role lúc thực hiện
  
  // What
  action: string;                 // 'lead_submitted', 'lead_claimed', etc.
  entityType: 'lead' | 'campaign' | 'company' | 'ctv' | 'payment';
  entityId: string;
  
  // Details
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  
  // Context
  ipAddress?: string;
  userAgent?: string;
  
  // Timestamp
  createdAt: Date;
}

// Index: entityType+entityId, action, createdAt
```

---

## 10. Phone Lock (Chống trùng)

```typescript
interface PhoneLock {
  id: string;
  
  phoneHash: string;              // SHA256 của phone chuẩn hóa
  
  // Lock info
  lockedByCtvId?: string;         // CTV đang giữ lock
  lockedByLeadId?: string;        // Lead đang giữ lock
  
  // Cooldown
  cooldownUntil: Date;            // Thời điểm mở khóa
  cooldownReason: 'pending' | 'approved' | 'claimed';
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

// Index: phoneHash (unique), cooldownUntil
```

---

## Relationships

```
users ──┬──> candidates (1:1, optional)
        ├──> ctvs (1:1, optional) 
        ├──> companies (1:1, optional)
        └──> leads (CTV submit, 1:N)

companies ──┬──> campaigns (1:N)
            ├──> leads (claimed, 1:N)
            └──> payments (1:N)

campaigns ──┬──> leads (1:N)
            └──> commissions (1:N)

ctvs ──┬──> leads (submitted, 1:N)
       └──> commissions (earned, 1:N)

candidates ──> leads (1:N, through lead.candidateId)
```

---

## Indexes cần thiết

| Table | Index | Mục đích |
|-------|-------|----------|
| `users` | `clerkId` | Tìm user theo Clerk ID |
| `users` | `email` | Login lookup |
| `candidates` | `phone` | Chống trùng SĐT |
| `candidates` | `phoneHash` | Hash lookup |
| `companies` | `code` | Company code lookup |
| `ctvs` | `referralCode` | Referral lookup |
| `campaigns` | `companyId + status` | Query campaign của company |
| `campaigns` | `province + industry + status` | Tìm campaign cho CTV |
| `leads` | `phoneHash + cooldownUntil` | Chống trùng + cooldown |
| `leads` | `ctvId + status` | Query lead của CTV |
| `leads` | `campaignId + status` | Query lead của campaign |
| `commissions` | `ctvId + status` | Query hoa hồng CTV |
| `phone_locks` | `phoneHash` | Unique constraint |
| `phone_locks` | `cooldownUntil` | Cleanup expired locks |

---

## Data Privacy Notes

### Encrypted Fields
- `leads._encrypted.fullName`
- `leads._encrypted.phone`
- `leads._encrypted.email`

### Visible by Role

| Data | Guest | CTV | Company | Admin |
|------|-------|-----|---------|-------|
| Candidate phone | ❌ | ✅ (chỉ lead của mình) | ✅ (sau khi claim) | ✅ |
| CTV identity | ❌ | ✅ (mình) | 🔶 (ID ẩn danh) | ✅ |
| Company wallet | ❌ | ❌ | ✅ | ✅ |
| All leads | ❌ | ❌ | ❌ | ✅ |

