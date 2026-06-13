# Affiliate Campaign Logic Refactor

Refactor campaign visibility logic từ single `visibility` field sang `is_public` + `ctv_enabled` flags theo mô hình affiliate/Shopee Affiliate.

## 1. Database Schema Changes

### 1.1 Campaigns table - thêm flags
```sql
ALTER TABLE campaigns ADD COLUMN is_public INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN ctv_enabled INTEGER DEFAULT 0;
```

### 1.2 Companies table - thêm trust & quota fields
```sql
-- Trust & deposit fields
ALTER TABLE companies ADD COLUMN trust_level TEXT DEFAULT 'normal' CHECK (trust_level IN ('normal', 'verified', 'priority', 'vip'));
ALTER TABLE companies ADD COLUMN deposit_status TEXT DEFAULT 'none' CHECK (deposit_status IN ('none', 'pending', 'partial', 'confirmed', 'waived'));
ALTER TABLE companies ADD COLUMN lead_trial_limit INTEGER DEFAULT 2;
ALTER TABLE companies ADD COLUMN require_deposit_after_leads INTEGER DEFAULT 2;
ALTER TABLE companies ADD COLUMN is_featured INTEGER DEFAULT 0;

-- Quota fields (gói đăng tin)
ALTER TABLE companies ADD COLUMN plan_code TEXT DEFAULT 'free' CHECK (plan_code IN ('free', 'basic', 'pro', 'vip'));
ALTER TABLE companies ADD COLUMN free_job_posts_limit INTEGER DEFAULT 5;
ALTER TABLE companies ADD COLUMN weekly_push_limit INTEGER DEFAULT 5;
ALTER TABLE companies ADD COLUMN used_job_posts_count INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN used_push_count INTEGER DEFAULT 0;
ALTER TABLE companies ADD COLUMN push_week_start DATETIME;
ALTER TABLE companies ADD COLUMN plan_expired_at DATETIME;
```

## 2. Data Migration

### 2.1 Migrate visibility cũ sang flags mới
```sql
-- visibility='public_candidate' => is_public=1, ctv_enabled=0
UPDATE campaigns SET is_public = 1, ctv_enabled = 0 WHERE visibility = 'public_candidate';

-- visibility='ctv_private' => is_public=1, ctv_enabled=1
UPDATE campaigns SET is_public = 1, ctv_enabled = 1 WHERE visibility = 'ctv_private';

-- visibility='internal' hoặc 'draft' => is_public=0, ctv_enabled=0
UPDATE campaigns SET is_public = 0, ctv_enabled = 0 WHERE visibility IN ('internal', 'draft');
```

## 3. API Changes

### 3.1 GET /api/ctv/campaigns (Sửa)
**Hiện tại:** Lấy tất cả active campaigns, trả về cả bounty_amount

**Sửa thành:**
```javascript
// Filter: status='active', ctv_enabled=1, ctv_reward_amount > 0, còn hạn
// Select: chỉ trả fields CTV được thấy, LOẠI BỎ bounty_amount, platform_fee_amount
SELECT c.id, c.campaign_code, c.title, c.job_type, c.location, 
       c.province, c.district, c.salary_text, c.shift_text,
       c.ctv_reward_amount,  -- Chỉ trả hoa hồng CTV
       c.quantity_needed, c.requirements,
       c.start_date, c.end_date,
       co.name as company_name
FROM campaigns c
JOIN companies co ON c.company_id = co.id
WHERE c.status = 'active'
  AND c.ctv_enabled = 1
  AND c.ctv_reward_amount > 0
  AND c.start_date <= date('now')
  AND (c.end_date IS NULL OR c.end_date >= date('now'))
```

### 3.2 Public Jobs API (GET /api/jobs hoặc tương đương)
**Sửa filter:** Chỉ lấy campaigns có `is_public=1`, `status='active'`

### 3.3 POST /api/company/campaigns (Sửa)
**Thêm validation:**
```javascript
// Check company quota
const company = await db.get('SELECT * FROM companies WHERE id = ?', company_id);
if (company.used_job_posts_count >= company.free_job_posts_limit) {
  return res.status(400).json({ error: 'QUOTA_EXCEEDED', message: 'Đã đạt giới hạn tin đăng miễn phí' });
}

// Nếu ctv_enabled=1 thì bắt buộc có ctv_reward_amount > 0
if (ctv_enabled && (!ctv_reward_amount || ctv_reward_amount <= 0)) {
  return res.status(400).json({ error: 'MISSING_CTV_REWARD' });
}

// Increment used_job_posts_count
await db.run('UPDATE companies SET used_job_posts_count = used_job_posts_count + 1 WHERE id = ?', company_id);
```

### 3.4 POST /api/company/leads/:leadId/claim (Sửa)
**Thêm logic deposit:**
```javascript
// Get company trust info
const company = await db.get(`
  SELECT wallet_balance, credit_limit, trust_level, deposit_status, 
         lead_trial_limit, require_deposit_after_leads,
         (SELECT COUNT(*) FROM lead_submissions WHERE claimed_by_company_id = ? AND status IN ('claimed', 'interviewing', 'hired')) as claimed_lead_count
  FROM companies WHERE id = ?
`, [company_id, company_id]);

// Check if company needs deposit
const needsDeposit = company.claimed_lead_count >= company.require_deposit_after_leads 
  && company.deposit_status !== 'waived' 
  && company.trust_level !== 'vip';

if (needsDeposit && company.deposit_status === 'none') {
  return res.status(400).json({ error: 'DEPOSIT_REQUIRED' });
}

// Check balance (giữ nguyên logic cũ)
const totalCredit = company.wallet_balance + company.credit_limit;
if (totalCredit < lead.bounty_amount) {
  return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' });
}
```

### 3.5 Admin APIs (Thêm mới)
```javascript
// PUT /api/admin/companies/:id/trust - Set trust level, deposit status
// PUT /api/admin/companies/:id/quota - Set plan_code, limits
// GET /api/admin/companies - List with trust_level, deposit_status
```

## 4. Frontend Changes (nếu cần)

### 4.1 CompanyDashboardPage.tsx
- Sửa form tạo campaign: thay dropdown `visibility` bằng 2 checkbox `is_public` + `ctv_enabled`
- Hiển thị quota còn lại: "Đã dùng X/5 tin miễn phí"

### 4.2 CTVDashboardPage.tsx
- Đảm bảo không hiển thị bounty_amount từ API (đã lọc ở backend)
- Giữ nguyên ctv_reward_amount

### 4.3 Public Job Pages
- Đảm bảo không hiển thị nút/button CTV (nhận lead, gửi lead)
- Chỉ hiển thị "Ứng tuyển", "Gọi/Zalo"

## 5. Files cần sửa

### Backend
```
backend/src/db/marketplace-schema.sql        -- Thêm columns mới
backend/src/routes/marketplace.js            -- Sửa GET /ctv/campaigns, POST /campaigns, POST /claim
backend/src/routes/jobs.js                   -- Sửa public jobs filter (nếu có file riêng)
backend/src/database.js                      -- Thêm migration script
```

### Frontend (optional)
```
src/pages/company/CompanyDashboardPage.tsx   -- Sửa form visibility
src/pages/ctv/CTVDashboardPage.tsx           -- Kiểm tra data display
```

### Migration
```
backend/scripts/migrate_visibility.sql       -- Script migration data cũ
```

## 6. Test Checklist

- [ ] Tạo campaign với is_public=1, ctv_enabled=1 → Hiện cả public + CTV
- [ ] Tạo campaign với is_public=1, ctv_enabled=0 → Chỉ hiện public
- [ ] Tạo campaign với is_public=0, ctv_enabled=1 → Chỉ hiện CTV
- [ ] CTV dashboard không thấy bounty_amount, platform_fee_amount
- [ ] Public web không thấy nút CTV
- [ ] Company đạt quota 5 tin không tạo được tin thứ 6
- [ ] VIP company (trust_level='vip') claim lead không cần deposit
- [ ] Normal company sau 2 lead trial thì yêu cầu deposit
- [ ] Admin có thể set trust_level, deposit_status cho company

## 7. Implementation Order

1. Schema migration (ALTER TABLE)
2. Data migration (visibility -> flags)
3. Sửa API GET /ctv/campaigns (filter + select fields)
4. Sửa API POST /company/campaigns (quota check)
5. Sửa API POST /claim (deposit logic)
6. Thêm Admin APIs
7. Frontend changes (nếu cần)
8. Test & commit
