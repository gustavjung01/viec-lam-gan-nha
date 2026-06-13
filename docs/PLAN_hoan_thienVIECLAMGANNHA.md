PLAN HOÀN THIỆN VIECLAMGANNHA.ME THEO TỪNG PHASE

Mục tiêu sản phẩm:
VIECLAMGANNHA.ME là web tuyển dụng theo mô hình affiliate tuyển dụng.

Một campaign có thể hiển thị ở 2 nơi:

1. Public web cho ứng viên xem và ứng tuyển.
2. Dashboard CTV cho CTV đã duyệt nhận/chạy campaign và gửi lead để nhận hoa hồng.

Nguyên tắc lớn:

* Public không thấy hoa hồng CTV.
* Public không thấy bounty_amount, platform_fee_amount, 80/20.
* CTV chỉ thấy hoa hồng CTV được nhận.
* CTV không thấy platform_fee_amount, bounty tổng nội bộ, tỷ lệ 80/20.
* Company/Admin có thể quản lý campaign, quota, cọc, ví, lead.
* Admin nội bộ mới thấy báo cáo tài chính/thuế/đối soát.

RÀO CHẮN BẮT BUỘC TRƯỚC KHI LÀM

Trước khi sửa chạy:
git status --short
git branch --show-current
git log -1 --oneline

Nguyên tắc:

* Không git push.
* Không deploy VPS nếu chưa được yêu cầu.
* Không đụng secret/env/key.
* Không chạy import DB.
* Không đổi company_id đang được campaign sử dụng.
* Không mở sqlite interactive. Nếu cần kiểm DB thì dùng lệnh một dòng.
* Không làm tất cả phase một lượt.
* Mỗi phase xong phải build/test, nếu pass thì commit local.
* Nếu gặp DB live/VPS/data thật thì dừng hỏi trước, không tự copy DB.

Báo cáo cuối mỗi phase:

1. Đã làm gì
2. Files changed
3. Migration/script nếu có
4. API/UI đã sửa
5. Build/test result
6. Commit hash nếu có
7. Rủi ro còn lại
8. Chưa push Git
9. Chưa deploy VPS

==================================================
PHASE 0: KIỂM TRA HIỆN TRẠNG, CHƯA SỬA CODE
===========================================

Mục tiêu:
Đối chiếu repo local thật trước khi sửa.

Việc cần làm:

1. Kiểm tra file:

* backend/src/routes/marketplace.js
* backend/src/routes/account.js
* backend/src/db/marketplace-schema.sql
* src/pages/admin/*
* src/pages/company/*
* src/pages/ctv/*
* src/hooks/useJobs.ts
* src/hooks/useJobDetail.ts

2. Kiểm tra API hiện tại:

* GET /api/jobs
* GET /api/jobs/:id nếu có
* GET /api/ctv/campaigns
* GET /api/ctv/leads
* GET /api/ctv/commissions
* POST /api/company/campaigns
* POST /api/company/leads/:leadId/claim
* GET /api/admin/tax-report
* GET /api/admin/tax-report/export
* GET /api/admin/all-companies
* PUT /api/admin/company/:id

3. Kiểm tra DB local bằng lệnh một dòng:
   sqlite3 "backend\data\applications.db" "PRAGMA table_info(campaigns);"
   sqlite3 "backend\data\applications.db" "PRAGMA table_info(companies);"
   sqlite3 "backend\data\applications.db" "PRAGMA table_info(ctv_accounts);"

Output Phase 0:

* Tóm tắt route nào đã dùng is_public/ctv_enabled.
* Route nào còn dùng visibility.
* Route nào còn lộ bounty/platform fee/80-20.
* Route nào đã có tax report/payment/payout.
* Chưa sửa code trong Phase 0.

==================================================
PHASE 1: DỌN LOGIC PUBLIC / CTV AFFILIATE
=========================================

Mục tiêu:
Dứt điểm logic public và CTV. Đây là phase ưu tiên cao nhất.

Files dự kiến:

* backend/src/routes/marketplace.js
* backend/src/db/marketplace-schema.sql nếu cần chỉnh schema mới
* backend/scripts/... migration nếu cần
* src/hooks/useJobs.ts nếu API response đổi
* src/hooks/useJobDetail.ts nếu API response đổi
* src/pages/ctv/CTVDashboardPage.tsx nếu còn hiển thị field sai

1.1 Public jobs API

Sửa GET /api/jobs:

* Không dùng visibility để quyết định public nữa.
* Lọc:
  status = 'active'
  is_public = 1
* Không trả:
  bounty_amount
  ctv_reward_amount
  platform_fee_amount
  split_info
  80/20
* Chỉ trả field public cần:
  id, campaign_code, title, job_type, location, province, district,
  salary_text, shift_text, quantity_needed, updated_at,
  company_name, company_code

Nếu DB cũ chưa có is_public thì phải có migration an toàn trước, không để API crash.

1.2 Public job detail API nếu có

Sửa tương tự:

* Chỉ lấy status='active' và is_public=1.
* Không trả field nội bộ.
* Public chỉ có CTA ứng tuyển/gọi/Zalo/xem chi tiết.
* Không có nút nhận lead/gửi lead CTV.

1.3 CTV campaigns API

Sửa GET /api/ctv/campaigns:

* Không SELECT c.* nữa.
* Chỉ select field CTV được thấy:
  c.id
  c.campaign_code
  c.title
  c.job_type
  c.location
  c.province
  c.district
  c.salary_text
  c.shift_text
  c.quantity_needed
  c.requirements
  c.ctv_reward_amount
  c.qualification_days
  c.start_date
  c.end_date
  co.name as company_name
  co.company_code
  my_leads
* Lọc:
  c.status='active'
  c.ctv_enabled=1
  c.ctv_reward_amount > 0
  start_date null hoặc <= today
  end_date null hoặc >= today
* Không trả:
  bounty_amount
  platform_fee_amount
  split_info
  ctv_percentage
  total_bounty

1.4 CTV leads API

Sửa GET /api/ctv/leads:

* Không trả bounty_amount.
* Chỉ trả ctv_reward_amount nếu cần hiển thị hoa hồng CTV.
* Không trả platform_fee_amount.
* Không trả tỷ lệ 80/20.

1.5 CTV commissions API

Sửa GET /api/ctv/commissions:

* Không trả split_info.
* Không trả platform_percentage.
* Không trả ctv_percentage.
* Không trả total_bounty.
* Chỉ trả:
  amount
  status
  campaign_title
  company_name
  lead_code
  hold_until/released_at nếu cần.
* Summary chỉ gồm:
  held
  available
  pending_payout
  paid
  total_earned

1.6 Company tạo campaign

Sửa POST /api/company/campaigns:

* Nhận is_public và ctv_enabled.
* Giữ visibility cũ để tương thích nhưng không dùng làm logic chính.
* Nếu is_public=true và ctv_enabled=false:
  bounty có thể 0.
* Nếu ctv_enabled=true:
  bắt buộc ctv_reward_amount > 0 hoặc bounty_amount > 0 để tính reward.
* Public campaign không bắt buộc bounty.
* Response cho company có thể trả bounty nội bộ nếu company dashboard cần, nhưng không trả ra public/CTV.

Tạm thời cách tính:

* Nếu body có ctv_reward_amount thì dùng trực tiếp.
* Nếu chỉ có bounty_amount thì ctv_reward_amount = floor(bounty_amount * 0.8) và platform_fee_amount = bounty_amount - ctv_reward_amount.
* Sau này có thể bỏ 80/20 hardcode, nhưng Phase 1 chỉ cần không phơi ra public/CTV.

1.7 Migration is_public/ctv_enabled

Nếu DB chưa có hoặc data chưa map, tạo script an toàn:

* Backup DB local trước.
* ALTER TABLE chỉ thêm cột nếu chưa tồn tại.
* Mapping:
  visibility='public_candidate' => is_public=1, ctv_enabled=0
  visibility='ctv_private' => is_public=1, ctv_enabled=1
  visibility='internal' => is_public=0, ctv_enabled=0
  visibility='draft' => is_public=0, ctv_enabled=0
* Không xóa visibility.

Test Phase 1:

* Public API không còn field bounty/platform fee/80-20.
* CTV campaigns không còn bounty_amount/platform_fee_amount.
* Campaign is_public=1, ctv_enabled=1 xuất hiện cả public và CTV.
* Campaign is_public=1, ctv_enabled=0 chỉ public.
* Campaign is_public=0, ctv_enabled=1 chỉ CTV.
* npm run build pass.

Commit gợi ý:
git add backend/src/routes/marketplace.js backend/src/db/marketplace-schema.sql backend/scripts src/hooks src/pages/ctv
git commit -m "Refactor public and CTV campaign visibility"

==================================================
PHASE 2: COMPANY QUOTA, GÓI ĐĂNG TIN, PUSH TIN, CỌC
===================================================

Chỉ làm Phase 2 sau khi Phase 1 pass.

Mục tiêu:
Công ty mới có 5 tin free và 5 lượt push/tuần. Công ty mới nhận thử 1-2 lead, từ lead thứ 3 phải cọc nếu chưa được admin miễn.

Files dự kiến:

* backend/src/routes/marketplace.js
* src/pages/company/*
* src/pages/admin/tabs/AdminCompanyTab.tsx
* src/pages/admin/types.ts

2.1 Field companies

Đảm bảo companies có:

* trust_level TEXT DEFAULT 'normal'
* deposit_status TEXT DEFAULT 'none'
* lead_trial_limit INTEGER DEFAULT 2
* require_deposit_after_leads INTEGER DEFAULT 2
* is_featured INTEGER DEFAULT 0
* plan_code TEXT DEFAULT 'free'
* free_job_posts_limit INTEGER DEFAULT 5
* weekly_push_limit INTEGER DEFAULT 5
* used_job_posts_count INTEGER DEFAULT 0
* used_push_count INTEGER DEFAULT 0
* push_week_start DATETIME
* plan_expired_at DATETIME

Giá trị hợp lệ:
trust_level:

* normal
* verified
* priority
* vip

deposit_status:

* none
* pending
* partial
* confirmed
* waived

plan_code:

* free
* basic
* pro
* vip

2.2 Company registration bắt buộc thông tin

Trong /api/account/company-registration:
Bắt buộc:

* người đại diện hoặc tên công ty nếu hiện chưa có field representative_name thì chưa cần thêm ngay, nhưng phải ghi TODO
* companyName
* phone
* taxId/MST
* email hoặc email từ Clerk
* address/province/district nếu UI có

Nếu thiếu MST thì trả:
error='MISSING_TAX_CODE'
message='Mã số thuế là bắt buộc để xác minh công ty.'

2.3 Quota tạo campaign

Trong POST /api/company/campaigns:

* Lấy company hiện tại.
* Nếu plan_code='free' và used_job_posts_count >= free_job_posts_limit:
  trả 403:
  error='QUOTA_EXCEEDED'
  message='Công ty đã dùng hết 5 tin đăng miễn phí. Vui lòng nâng gói hoặc liên hệ admin để mở thêm lượt đăng.'
* Nếu tạo thành công:
  UPDATE companies SET used_job_posts_count = used_job_posts_count + 1

Lưu ý:

* Không tăng counter nếu insert campaign lỗi.
* Nếu admin tạo campaign thay công ty thì cần quyết định sau. Phase này chỉ xử lý company tự tạo.

2.4 Push tin

Trước khi làm push, tự kiểm repo đã có route/button push chưa.
Nếu chưa có:

* Không tự chế full UI lớn.
* Tạo TODO rõ.
* Có thể thêm backend endpoint tối thiểu:
  POST /api/company/campaigns/:id/push
* Điều kiện:
  campaign thuộc company đang login.
  company chưa vượt weekly_push_limit.
  Nếu qua tuần mới thì reset used_push_count=0, push_week_start=ngày hiện tại.
  Push thành công thì used_push_count += 1 và campaigns.updated_at=datetime('now') hoặc pushed_at nếu có field.

Nếu vượt:
error='PUSH_QUOTA_EXCEEDED'
message='Công ty đã dùng hết 5 lượt push tin trong tuần.'

2.5 Claim lead và cọc

Sửa POST /api/company/leads/:leadId/claim:

* Nếu company.status bị suspended/blocked thì chặn.
* Nếu trust_level='vip' hoặc deposit_status='waived':
  bỏ qua yêu cầu đặt cọc.
* Nếu deposit_status='pending':
  chặn claim:
  error='DEPOSIT_PENDING'
  message='Khoản cọc đang chờ admin xác nhận.'
* Nếu company normal và claimed_lead_count >= require_deposit_after_leads và deposit_status không thuộc partial/confirmed/waived:
  chặn:
  error='DEPOSIT_REQUIRED'
  message='Công ty cần đặt cọc để tiếp tục nhận lead.'
* Nếu deposit_status='partial' hoặc 'confirmed':
  cho claim theo logic ví hiện tại.

2.6 Admin company API

Mở rộng PUT /api/admin/company/:id để admin chỉnh:

* trust_level
* deposit_status
* lead_trial_limit
* require_deposit_after_leads
* free_job_posts_limit
* weekly_push_limit
* plan_code
* plan_expired_at
* is_featured
* used_job_posts_count
* used_push_count nếu cần reset thủ công

Admin list /api/admin/all-companies phải trả các field này.

Test Phase 2:

* Công ty free tạo được tối đa 5 campaign.
* Tạo tin thứ 6 bị QUOTA_EXCEEDED.
* Push quá 5 lần/tuần bị PUSH_QUOTA_EXCEEDED.
* Công ty normal sau 2 lead bị DEPOSIT_REQUIRED.
* VIP hoặc waived claim không bị chặn cọc.
* Admin update trust/deposit/quota thành công.
* npm run build pass.

Commit gợi ý:
git commit -m "Add company quota and deposit controls"

==================================================
PHASE 3: THANH TOÁN NỘI BỘ, VÍ, CỌC, CTV PAYOUT
===============================================

Chỉ làm sau Phase 1 và Phase 2 pass.

Mục tiêu:
Biến phần wallet/platform_fees/ctv_payouts thành quy trình admin có thể đối soát.

Không cần tích hợp cổng thanh toán thật ngay nếu chưa có SePay/webhook.

3.1 Company deposit/wallet

Cần có hoặc thêm API admin:

* POST /api/admin/company/:id/wallet/deposit
* POST /api/admin/company/:id/wallet/adjust
* GET /api/admin/company/:id/wallet-transactions

Payload deposit:

* amount
* transaction_reference
* note
* admin_id

Khi admin xác nhận nạp:

* wallet_balance += amount
* insert wallet_transactions type='deposit'
* audit_logs action='wallet_deposit_confirmed'

3.2 Lead claim wallet

Rà soát claim lead:

* Khi company claim lead, trừ ví đúng số tiền cần thu.
* Nếu ví không đủ và không có credit/deposit policy thì chặn.
* Nếu cho credit_limit thì phải báo rõ số dư âm/công nợ.
* Ghi wallet_transactions đầy đủ.

3.3 CTV payout approval

Hiện có payout request/ctv_payouts. Cần admin API:

* GET /api/admin/ctv-payouts
* POST /api/admin/ctv-payouts/:id/approve
* POST /api/admin/ctv-payouts/:id/mark-paid
* POST /api/admin/ctv-payouts/:id/reject

Mark paid cần:

* transaction_reference
* paid_at
* admin_id
* note

Không tự động chuyển tiền thật. Chỉ ghi nhận thủ công.

3.4 Trạng thái cần chuẩn

Company money:

* deposit pending/confirmed/waived
* wallet_balance
* credit_limit
* wallet_transactions

CTV payout:

* pending
* approved
* processing
* paid
* failed/rejected

Platform fee:

* pending
* invoiced
* paid

Test Phase 3:

* Admin nạp ví công ty thành công.
* Wallet transaction được ghi.
* Claim lead trừ ví.
* CTV payout pending có thể approve/mark paid.
* Audit log có đủ.

Commit gợi ý:
git commit -m "Add internal payment and payout controls"

==================================================
PHASE 4: BÁO CÁO THUẾ, ĐỐI SOÁT KẾ TOÁN
=======================================

Mục tiêu:
Báo cáo tài chính nội bộ sạch, không phơi ngôn ngữ 80/20 ra UI sản phẩm. Admin nội bộ vẫn có thể xem đối soát.

4.1 Sửa naming tax-report

Trong /api/admin/tax-report:
Không dùng label:

* ctv_receives_80%
* platform_keeps_20%
* total_platform_fees_20_percent
* total_ctv_payouts_80_percent

Đổi thành:

* total_company_charged
* total_ctv_payable
* total_platform_revenue
* total_company_debt
* total_paid_to_ctv
* total_pending_ctv_payout
* total_pending_platform_fees

4.2 Export CSV

CSV cần cột:

* Kỳ báo cáo
* Mã lead
* Ngày qualified
* Công ty
* Mã công ty
* MST công ty
* Campaign
* CTV
* Mã CTV
* Số tiền công ty phải trả
* Hoa hồng CTV phải trả
* Doanh thu nền tảng
* Trạng thái platform fee
* Trạng thái CTV payout
* Ghi chú
* Mã giao dịch nếu có

4.3 Báo cáo theo kỳ

Hỗ trợ query:

* period=YYYY-MM
* date_from
* date_to
* company_id
* ctv_id
* status

Nếu chưa làm hết filter, làm period trước.

4.4 Admin UI tài chính

AdminFinanceTab cần hiển thị:

* Tổng thu công ty
* Tổng phải trả CTV
* Doanh thu nền tảng
* Công nợ công ty
* CTV payout pending
* Export CSV

Không hiển thị kiểu “80/20” trong UI trừ khi trong ghi chú nội bộ dev, không đưa ra giao diện.

Test Phase 4:

* /admin/tax-report trả JSON không còn key 80%.
* /admin/tax-report/export CSV có BOM UTF-8 và cột rõ.
* AdminFinanceTab không hiện 80/20.
* npm run build pass.

Commit gợi ý:
git commit -m "Clean up internal finance and tax reporting"

==================================================
PHASE 5: ONESIGNAL NOTIFICATION
===============================

Chỉ làm sau khi logic lead/payment/CTV ổn.

Mục tiêu:
Bắn thông báo đúng người, đúng trạng thái.

5.1 Frontend OneSignal

Cài đặt nếu dùng web push:

* OneSignal SDK/init ở frontend.
* Service worker/public file nếu OneSignal yêu cầu.
* Xin quyền notification sau khi user login, không bật popup quá sớm.
* Gửi player/subscription id lên backend.

Không dùng secret trong VITE.

Env frontend:

* VITE_ONESIGNAL_APP_ID nếu cần public app id

5.2 Backend OneSignal

Env backend:

* ONESIGNAL_APP_ID
* ONESIGNAL_REST_API_KEY

Không in env ra log.
Không commit key.

DB cần thêm:

* companies.onesignal_player_id hoặc notification_subscriptions table
* ctv_accounts.onesignal_player_id hoặc notification_subscriptions table
* admin notification nếu cần

Đề xuất bảng riêng tốt hơn:
notification_subscriptions:

* id
* clerk_user_id
* role
* entity_id
* provider
* player_id
* status
* created_at
* updated_at

5.3 Các event cần bắn

Cho admin:

* Có company đăng ký mới.
* Có CTV đăng ký mới.
* Có lead mới.
* Có payout request mới.
* Có company cần cọc.

Cho company:

* Lead mới ứng tuyển public vào campaign của công ty.
* Lead CTV gửi vào campaign.
* Admin duyệt/từ chối campaign.
* Sắp hết quota hoặc cần cọc.

Cho CTV:

* Hồ sơ CTV được duyệt/từ chối.
* Lead được duyệt/qualified.
* Payout được duyệt/đã trả.
* Có campaign mới phù hợp khu vực.

5.4 API notification

Backend helper:
sendNotification({ role, entityId, title, message, url, data })

Ghi audit/log:
notification_logs:

* id
* target_role
* target_id
* title
* message
* provider
* provider_message_id
* status
* error
* created_at

Test Phase 5:

* Login user lưu subscription.
* Trigger lead mới bắn admin/company.
* Duyệt CTV bắn CTV.
* Payout paid bắn CTV.
* Không lỗi nếu OneSignal env thiếu, chỉ skip và log warning an toàn.

Commit gợi ý:
git commit -m "Add OneSignal notification foundation"

==================================================
PHASE 6: QA END TO END TRƯỚC DEPLOY VPS
=======================================

Chỉ làm sau từng phase hoặc trước deploy.

Checklist:

1. npm run build pass.
2. Backend start được local.
3. Public jobs load được.
4. Job detail load được.
5. Company login bằng Clerk thấy đúng company.
6. Company tạo campaign public+CTV được.
7. Public không thấy hoa hồng.
8. CTV dashboard thấy campaign CTV và chỉ thấy hoa hồng CTV.
9. CTV gửi lead được.
10. Company claim lead đúng điều kiện cọc/ví.
11. Admin thấy lead.
12. Admin đổi status lead được.
13. Tax report/export chạy được.
14. Không có secret in log.
15. git status sạch sau commit.

Không deploy VPS nếu chưa được yêu cầu riêng.

==================================================
THỨ TỰ THỰC HIỆN NGAY BÂY GIỜ
=============================

Chỉ bắt đầu Phase 0 và Phase 1 trước.

Không làm Phase 2-5 ngay trong cùng lượt.

Sau Phase 1 báo cáo cho user duyệt.
Khi user duyệt mới làm Phase 2.

Lệnh bắt đầu:

git status --short
git branch --show-current
git log -1 --oneline

Sau đó làm Phase 0 audit.
Nếu không có rủi ro, làm Phase 1.
Khi Phase 1 build pass thì commit local.
Không push.
Không deploy.
