# Anti-Fraud Rules - Chống Gian Lận

## 1. Mục tiêu

Bảo vệ cả 3 bên: Platform, CTV, và Company khỏi các hành vi gian lận.

## 2. Các loại gian lận

### 2.1 Fake Lead (CTV tạo lead ảo)

**Dấu hiệu:**
- SĐT không liên lạc được (tắt máy, không tồn tại)
- Nhiều lead cùng SĐT trong thời gian ngắn
- Lead từ chối khi Company liên hệ (không biết đã ứng tuyển)
- Pattern: CTV mới tạo liên tục nhiều lead trong ngày đầu

**Phòng chống:**
- OTP verification trước khi submit lead (tùy chọn, charge CTV)
- Rate limit: Tối đa 5 lead/ngày cho CTV mới (< 7 ngày)
- Quality score: Lead không được nhận > 3 lần → CTV bị giảm limit
- Random audit: Admin gọi lại 10% lead để verify

### 2.2 Lead Hijacking (CTV cướp lead của người khác)

**Dấu hiệu:**
- CTV B gửi lại lead đã được CTV A gửi trước đó
- Chờ cooldown hết để gửi lại ngay lập tức

**Phòng chống:**
- Cooldown 30 ngày cho lead approved
- Notify CTV A nếu có người cố gửi lead trùng
- Audit log ghi nhận ai thử gửi khi đang cooldown

### 2.3 Company Không Trả Thưởng

**Dấu hiệu:**
- Company nhận lead nhưng không update trạng thái
- Claim lead nhưng không trả tiền (tự động từ ví)
- Báo cáo lead "không chất lượng" liên tục để tránh trả

**Phòng chống:**
- Auto-deduct từ ví khi claim (không cho nợ)
- Reputation score cho Company
- Nếu tỷ lệ "không chất lượng" > 30%, Company bị review
- Cọc tối thiểu: 2 triệu để tham gia

### 2.4 Self-Referral (CTV tự tạo tài khoản ứng viên)

**Dấu hiệu:**
- SĐT lead trùng với SĐT CTV
- IP address lead = IP CTV
- Device fingerprint trùng nhau

**Phòng chống:**
- Check IP + device fingerprint khi submit
- Không cho phép lead có SĐT trùng với CTV profile
- Pattern detection: CTV nào có nhiều lead từ cùng khu vực lạ

## 3. Rule Engine

### 3.1 Lead Submission Rules

```yaml
rule_1_rate_limit:
  condition: ctv.tenure < 7_days
  action: max_leads_per_day = 5
  
rule_2_duplicate_phone:
  condition: phone_hash exists in leads with cooldown > now
  action: reject with reason "lead_exists"
  
rule_3_self_referral:
  condition: lead.phone == ctv.phone OR lead.ip == ctv.ip
  action: reject with flag "potential_self_referral"
  
rule_4_fake_pattern:
  condition: similar_names_count > 3 in 24h
  action: hold_for_review
```

### 3.2 Company Claim Rules

```yaml
rule_1_balance_check:
  condition: company.wallet.balance < lead.reward
  action: reject_claim with "insufficient_balance"
  
rule_2_reputation_check:
  condition: company.rejection_rate > 30% in 30_days
  action: flag_for_review
  
rule_3_lead_quality:
  condition: lead.claimed_count > 3  # 3 công ty đã thử nhận
  action: reduce_reward_50%  # Lead khó tuyển
```

## 4. Scoring System

### 4.1 CTV Trust Score (0-100)

| Factor | Weight | Description |
|--------|--------|-------------|
| Tenure | 20% | Thời gian tham gia |
| Lead quality | 40% | % lead được nhận và tuyển |
| Response rate | 15% | Phản hồi khi Company hỏi |
| Complaints | 15% | Số lần bị report |
| Audit pass | 10% | Kết quả audit ngẫu nhiên |

**Actions:**
- Score < 30: Suspended, require re-verification
- Score 30-60: Limited (max 3 lead/day)
- Score 60-80: Normal
- Score > 80: Trusted (instant approval, higher limit)

### 4.2 Company Reputation Score (0-100)

| Factor | Weight | Description |
|--------|--------|-------------|
| Payment history | 40% | Thanh toán đúng hạn |
| Lead feedback | 30% | Tỷ lệ hired/rejected |
| Dispute resolution | 20% | Giải quyết tranh chấp |
| Communication | 10% | Phản hồi nhanh |

**Actions:**
- Score < 40: Required prepay 100%
- Score 40-70: Normal with deposit
- Score > 70: Credit limit available

## 5. Dispute Resolution

### 5.1 CTV khiếu nại Company không trả

1. CTV submit ticket trong 7 ngày sau khi lead claimed
2. Company phải phản hồi trong 48h
3. Admin review:
   - Lead có liên lạc được không?
   - Company có report fraud không?
   - Timeline có hợp lý không?
4. Decision:
   - CTV đúng: Force payment từ ví Company
   - Company đúng: Lead rejected, không trả CTV

### 5.2 Company khiếu nại lead giả

1. Company report trong 24h sau khi claim
2. Evidence required: Screenshot call log, ghi âm (nếu có)
3. Admin audit:
   - Gọi lại SĐT để verify
   - Check pattern CTV
4. Decision:
   - Lead giả: Refund Company, ban CTV
   - Lead thật: Giữ tiền, cảnh báo Company nếu report vô lý

## 6. Automated Flags

### 6.1 Real-time Alerts

```
Alert: ctv_suspicious_pattern
Trigger: CTV tạo > 10 lead trong 1 giờ
Action: Auto-pause CTV, notify admin

Alert: company_payment_delay
Trigger: Lead claimed > 7 ngày, chưa update status
Action: Email reminder, reduce reputation

Alert: duplicate_phone_spike
Trigger: > 5 lead cùng SĐT từ CTV khác nhau trong 24h
Action: Phone lock, investigation
```

### 6.2 Daily Reports

- CTV mới có > 10 lead trong ngày đầu
- Company có rejection rate > 50%
- Lead không được nhận sau 7 ngày
- Commission pending > 30 ngày

## 7. Blacklist

### 7.1 Auto-blacklist

| Vi phạm | Hậu quả | Thời gian |
|---------|---------|-----------|
| Fake lead > 3 lần | Ban CTV | Vĩnh viễn |
| Self-referral confirmed | Ban CTV | Vĩnh viễn |
| Company không thanh toán | Suspend | Đến khi nạp cọc |
| Lead farming (mua bán lead) | Ban cả 2 bên | Vĩnh viễn |

### 7.2 Appeal Process

1. Submit appeal trong 14 ngày
2. Admin review trong 7 ngày
3. Decision: uphold hoặc reverse
4. Max 1 appeal per decision

## 8. Audit Trail

Mọi hành động liên quan đến fraud phải log:
- Timestamp
- User ID
- IP Address
- Device info (fingerprint)
- Action taken
- Reason

Logs giữ tối thiểu 2 năm.
