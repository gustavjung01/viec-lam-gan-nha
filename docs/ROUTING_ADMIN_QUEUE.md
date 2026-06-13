# Routing Rules & Admin Queue — Detailed

Mục tiêu: Mô tả chi tiết cách nhận diện nguồn lead, cách phân bổ lead cho CTV hoặc admin queue, và hành vi admin queue.

## Key principles
- Không bỏ CTV. Hệ thống vận hành song song hai luồng: CTV-sourced và Admin/platform-sourced.
- Lead từ CTV link/form phải được gắn `ctv_id` để đảm bảo commission.
- Lead từ public campaign (chưa có CTV) được đưa vào admin queue cho admin xử lý.

## Lead creation — nguồn và detection
1. CTV link/form detection
- Thông thường CTV link chứa token hoặc query param (ví dụ `?ctv_ref=XYZ` hoặc `?ctv_id=123`).
- Khi có `ctv_id` hoặc hợp lệ CTV token: mark `source_type = ctv`, set `ctv_id` = token owner, set `owner_type = ctv`, `assigned_admin_id = ctv_id`.
- Nên lưu `source_metadata` (raw query params, referrer, utm) để forensics.

2. Public form / campaign page
- Nếu request không có CTV context → `source_type = organic_web`, `ctv_id = NULL`.
- If campaign has an assigned CTV (campaign.ctv_owner_id) and business requires auto-assign -> optional behavior (but for revenue-first we allow admin to take if no CTV assigned).

3. Admin import/manual
- `source_type = admin` hoặc `manual` depending on origin.

## Assignment model (lead.owner_type, lead.assigned_admin_id)
- `owner_type` enum: `ctv` | `admin_pool` | `assigned_admin`.
- `assigned_admin_id`: nullable FK to users(admin).

Assignment rules:
- If `source_type = ctv` and `ctv_id` present: `owner_type = ctv`, `assigned_admin_id = ctv_id`.
- Else if campaign has `assigned_ctv` and lead came from CTV context -> assign to that CTV.
- Else (public lead): `owner_type = admin_pool`, `assigned_admin_id = NULL` (visible to admins).

## Admin distribution strategies
- Round-robin (recommended): maintain pointer/offset per queue; on assignment increment pointer.
- Random: pick random active admin from `active_admins` set.
- Priority: optionally prioritize admins with recent lower workload.

Fallbacks and edge cases
- If `active_admins` is empty: keep `assigned_admin_id = NULL` and set `owner_type = admin_pool`.
- If auto-assignment fails due to lock/race: fallback to leaving lead in `admin_pool` for manual claim.
- If lead assigned to admin but not claimed in X hours: requeue (optional) or send alert.

## UI & UX expectations
- Admin queue view shows `admin_pool` leads (filter by newest first, show campaign, location, phone, created_at, source_type).
- Claim button sets `assigned_admin_id` and `owner_type = assigned_admin`.
- When admin claims, add audit record (`claimed_by`, `claimed_at`).

## Data fields to set on lead creation (recommend)
- `source_type` (enum)
- `ctv_id` (nullable)
- `owner_type` (enum)
- `assigned_admin_id` (nullable)
- `source_metadata` (JSON)
- `assignment_history` (array/JSON) — log of assignments for audit

## Metrics / Monitoring
- Rate of public leads -> admin queue
- Time-to-claim for admin_pool leads
- % leads assigned to CTV vs admin
- Payouts generated vs leads with ctv_id

## Examples
1. Lead from CTV link: POST /api/leads?ctv_id=123 -> lead.source_type=ctv, ctv_id=123, owner_type=ctv, assigned_admin_id=123
2. Lead from public campaign: POST /api/leads (no ctv) -> lead.source_type=organic_web, ctv_id=NULL, owner_type=admin_pool, assigned_admin_id=NULL

## Notes
- Implementation detail: detection of CTV link should be robust (signed token better than user-provided id param).
- Keep routing logic in service layer to enable tests and feature-flag rollout.
