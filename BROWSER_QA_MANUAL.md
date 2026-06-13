# Browser QA Manual Testing Guide

## URL: http://40.233.83.234

**Basic Auth:** User: `staging`, Password: *(hỏi admin)*

---

## 1. Guest Role Tests

### Test 1.1: Trang chủ load
- [ ] Mở http://40.233.83.234
- [ ] Nhập Basic Auth
- [ ] Kiểm tra trang chủ hiển thị
- [ ] Kiểm tra logo, menu, hero section

### Test 1.2: /nha-tuyen-dung landing
- [ ] Click "Dành cho công ty" hoặc vào /nha-tuyen-dung
- [ ] Kiểm tra là landing page public
- [ ] Không có dashboard, lead, hoa hồng data

### Test 1.3: Guest không thấy dashboard
- [ ] Thử vào /ctv/dashboard
- [ ] Thử vào /company/dashboard
- [ ] Thử vào /admin/console
- [ ] Expect: Không có data hoặc redirect

---

## 2. CTV Role Tests

**Setup:** Mở DevTools Console, chạy:
```javascript
localStorage.setItem('dev_role', 'ctv');
localStorage.setItem('user_id', 'ctv-001');
location.reload();
```

### Test 2.1: Dashboard CTV load
- [ ] Vào /ctv/dashboard
- [ ] Kiểm tra "CTV Dashboard" title
- [ ] Kiểm tra campaigns list load từ API

### Test 2.2: Campaigns active với hoa hồng 80%
- [ ] Kiểm tra campaign card hiển thị
- [ ] Kiểm tra bounty amount (VD: 600K)
- [ ] Kiểm tra CTV reward (VD: 480K = 80%)

### Test 2.3: Leads/Payouts hiển thị
- [ ] Kiểm tra leads table
- [ ] Kiểm tra payouts table
- [ ] Kiểm tra status colors

### Test 2.4: Submit lead mới
- [ ] Click "Gửi Lead Mới"
- [ ] Điền form:
  - Tên: "Nguyễn Văn Test"
  - SĐT: "0909555111" (số mới)
  - Campaign: chọn 1 campaign
- [ ] Click Submit
- [ ] Expect: Success message

### Test 2.5: Submit trùng số bị chặn
- [ ] Click "Gửi Lead Mới"
- [ ] Điền số đã tồn tại: "0901111111"
- [ ] Click Submit
- [ ] Expect: Error "Số điện thoại đã tồn tại"
- [ ] Verify: Không lộ thông tin lead cũ (tên CTV, tên ứng viên)

---

## 3. Company Role Tests

**Setup:**
```javascript
localStorage.setItem('dev_role', 'company');
localStorage.setItem('company_id', 'comp-001');
location.reload();
```

### Test 3.1: Dashboard Company load
- [ ] Vào /company/dashboard
- [ ] Kiểm tra "Company Dashboard" title
- [ ] Kiểm tra campaigns của công ty

### Test 3.2: Lead chưa claim ẩn contact
- [ ] Kiểm tra leads list
- [ ] Lead chưa claim: Name = "***", Phone = "***"
- [ ] Không thấy contact info

### Test 3.3: Claim lead unlock contact
- [ ] Click "Nhận Lead" trên lead chưa claim
- [ ] Confirm claim
- [ ] Kiểm tra: Name và Phone hiện rõ

### Test 3.4: Update status
- [ ] Trên lead đã claim
- [ ] Click "Cập nhật status"
- [ ] Chọn status mới (interviewing -> hired -> qualified)
- [ ] Verify status thay đổi

### Test 3.5: Không có export/download
- [ ] Kiểm tra không có nút "Export"
- [ ] Kiểm tra không có nút "Download"
- [ ] Kiểm tra không có "Tải danh sách SĐT"

---

## 4. Admin Role Tests

**Setup:**
```javascript
localStorage.setItem('dev_role', 'admin');
location.reload();
```

### Test 4.1: Admin console load
- [ ] Vào /admin/console
- [ ] Kiểm tra "Admin Console" title
- [ ] Kiểm tra các stats cards

### Test 4.2: Tax report 20/80 đúng
- [ ] Kiểm tra "Báo cáo 20/80 Split" section
- [ ] Verify: 
  - Platform fee = 20% (VD: 120K)
  - CTV payout = 80% (VD: 480K)
  - Math check = OK

### Test 4.3: Audit logs hiển thị
- [ ] Kiểm tra "Audit Logs" section
- [ ] Verify có logs (lead submitted, claimed, status changed)

### Test 4.4: Disputed leads
- [ ] Kiểm tra section "Cảnh báo & Tranh chấp"
- [ ] Verify disputed leads hiển thị

---

## 5. Technical Tests

### Test 5.1: Console errors
- [ ] Mở DevTools (F12)
- [ ] Chuyển sang tab Console
- [ ] Reload page
- [ ] Kiểm tra: Không có lỗi đỏ (trừ 401 khi chưa auth)

### Test 5.2: Network requests
- [ ] Mở Network tab
- [ ] Chuyển role và xem API calls
- [ ] Verify: 
  - CTV gọi `/api/ctv/*`
  - Company gọi `/api/company/*`
  - Admin gọi `/api/admin/*`

### Test 5.3: Mobile responsive
- [ ] Mở DevTools
- [ ] Toggle Device Toolbar (Ctrl+Shift+M)
- [ ] Chọn iPhone 12 Pro (390x844)
- [ ] Kiểm tra:
  - [ ] Layout không bị tràn
  - [ ] Text readable
  - [ ] Buttons clickable
  - [ ] Tables scrollable

### Test 5.4: Tablet responsive
- [ ] Chọn iPad (768x1024)
- [ ] Kiểm tra layout

---

## Reporting Issues

Nếu phát hiện lỗi, ghi lại:
1. **Browser:** Chrome/Firefox/Safari version
2. **Role:** Guest/CTV/Company/Admin
3. **Steps:** Step-by-step để reproduce
4. **Expected:** Kết quả mong đợi
5. **Actual:** Kết quả thực tế
6. **Screenshot:** (quan trọng)
7. **Console errors:** Copy từ DevTools

---

## Pass/Fail Criteria

| Test | Pass Criteria |
|------|--------------|
| Guest trang chủ | Load < 3s, không lỗi console |
| CTV dashboard | API trả data, hiển thị đúng |
| Submit lead | Success message, lead xuất hiện trong list |
| Duplicate block | Error message, không leak data |
| Company lead | Anonymous trước claim, visible sau claim |
| Tax report | 20/80 chính xác, math check OK |
| Console | 0 lỗi đỏ (trừ 401) |
| Mobile | Layout không vỡ |
