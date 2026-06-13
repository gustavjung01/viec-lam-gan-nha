# PR Spec — Revenue-first (Backend)

Mục tiêu: Triển khai thay đổi backend để hỗ trợ song song luồng CTV và Admin/platform, đảm bảo không làm thay đổi hành vi hiện tại với CTV nhưng cho phép admin xử lý lead public khi CTV chưa phủ.

## 1) Overview
- Không deploy migration/code trong bước này; chỉ soạn spec để dev implement sau khi phê duyệt.
- Các thay đổi tập trung vào: schema (đề xuất), API tạo lead, validation rules, routing/assignment, payout logic, admin queue behaviour và QA checklist.

## 2) Migrations (đề xuất — mô tả, không code)
- Bảng `leads` (hoặc `applications`/`candidate_submissions`):
  - Thêm column `source_type` (varchar/enum): values = ctv, organic_web, admin, manual, facebook, zalo. Default NULL hoặc 'organic_web' tùy use-case.
  - Đảm bảo `ctv_id` tồn tại và là nullable. Thêm constraint logic (enforced in application layer): khi `source_type = 'ctv'` thì `ctv_id IS NOT NULL`.
  - Thêm column `owner_type` (varchar): values = ctv | admin_pool | assigned_admin; và `assigned_admin_id` nullable.
  - Thêm index cho `ctv_id`, `assigned_admin_id`, `owner_type`, `source_type` để hỗ trợ routing/queries.
- Bảng `campaigns`:
  - Thêm/đảm bảo có column `visibility` (enum): public_candidate, ctv_private, internal, draft.
  - Nếu chưa có, thêm `bounty_amount`, `ctv_reward_amount` (nullable). Khi `visibility = ctv_private` enforce non-null application-side.
- Audit/metadata:
  - (Optional) Thêm `source_metadata` JSON column trong `leads` để lưu tracking info (ctv_ref, utm, referrer, raw_form) — hỗ trợ debug/forensics.

## 3) API changes
- Endpoint tạo lead (POST `/api/leads` hoặc hiện có):
  - Request fields: name, phone, email, campaign_id (opt), company_id (opt), source_type (optional), ctv_id (optional), source_metadata (opt).
  - Server behavior:
    - If request contains valid CTV token/ref (see routing doc) or `source_type = ctv` provided with `ctv_id` → set `source_type = ctv` and require `ctv_id`.
    - If request is public form (no CTV context) → set `source_type = organic_web`, `ctv_id = NULL`.
    - If admin creates lead via admin UI/import → allow `source_type = admin` or `manual`.
    - Set `owner_type` and `assigned_admin_id` per routing rules: ctv → owner_type=ctv, assigned_admin_id=ctv_id; public → owner_type=admin_pool, assigned_admin_id=NULL (or assign admin if system supports).
    - Validate campaign visibility: if `campaign.visibility == 'ctv_private'` then reject lead creation from public form unless request has proper CTV auth/context.
- Endpoint update lead/assignment (/api/leads/:id/assign): allow admin to claim or system to assign.

## 4) Validation rules
- If `source_type = ctv` → `ctv_id` required and must reference active CTV record.
- If `campaign.visibility = ctv_private` → only CTV-submitted leads accepted (or admin with explicit permission). Enforce in API.
- When changing campaign to `ctv_private` → on update validate presence of `bounty_amount` and `ctv_reward_amount` in request.
- For public_candidate campaigns → no requirement for bounty/ctv_reward.

## 5) Routing rules (tóm tắt)
- If lead from CTV link/form: assign to CTV (`owner_type=ctv`, `assigned_admin_id=ctv_id`).
- If lead from public campaign with no CTV: assign to admin queue (`owner_type=admin_pool`, `assigned_admin_id=NULL`).
- If multiple admins active: use random or round-robin assignment.
- If no assignment system present: leave `assigned_admin_id=NULL` (admin_pool) so admins can pick from queue.
- Chi tiết technical detection/params ở `docs/ROUTING_ADMIN_QUEUE.md`.

## 6) Payout / Commission rules
- Only generate payout/commission when `ctv_id IS NOT NULL` and lead qualifies per existing business rules.
- For `organic_web` or other non-ctv leads: do not create CTV payout records.
- Ensure payout calculation module checks `ctv_id` existence not only `source_type`.

## 7) Admin queue behaviour
- New lead with `owner_type=admin_pool` should surface in admin queue UI.
- Assignment policy:
  - If `assigned_admin_id` provided → assign to that admin.
  - Else if system configured with active_admins → perform round-robin or random among active_admins.
  - Else keep `assigned_admin_id = NULL` and `owner_type = admin_pool`.
- Claim flow: admin can claim leads (API: /api/leads/:id/claim) which sets `assigned_admin_id`.
- Visibility/permissions: only admins see admin_queue leads; CTVs cannot claim admin_pool leads unless assigned.

## 8) QA checklist (sang dev & QA)
- Unit tests:
  - Lead creation: ctv with ctv_id -> accepted.
  - Lead creation: public form -> source_type set to organic_web.
  - Reject public lead for `ctv_private` campaign.
  - Assignment logic: admin_pool creation, assigned_admin_id handling.
- Integration tests:
  - End-to-end create lead from CTV link with tracking params -> assigned to CTV.
  - End-to-end create lead from public form -> appears in admin queue and no payout created.
- Manual QA:
  - Admin UI: verify new leads surface in admin queue.
  - Payout pipeline: verify no payout created for `ctv_id = NULL` leads.
  - Migration dry-run (if migration created later): run on staging snapshot and verify indices/constraints.
- Monitoring/Observability:
  - Add alert if assigned_admin_id remains NULL for > X hours for public leads (indicating no admin activity).

## 9) Rollout plan (recommendation)
- Implement feature behind a feature flag `revenue_first_lead_routing`.
- Deploy to staging: run migrations in staging (dry-run), enable flag, run integration tests.
- Gradual production rollout: enable for subset of campaigns or accounts.

## 10) Backwards compatibility
- Existing leads remain unchanged. Default behavior for legacy campaigns remains until campaigns updated.
- Ensure API accepts requests without `source_type` by mapping to existing behavior (organic_web for public form).

*** End of spec ***
