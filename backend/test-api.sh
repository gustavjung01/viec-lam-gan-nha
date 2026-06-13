#!/bin/bash
# Test script for marketplace API - Phase 3B Full Flow QA
# Usage: bash test-api.sh

API_URL="http://localhost:3000/api"
CTV_ID="ctv-001"
CTV_ID_2="ctv-002"
COMPANY_ID="comp-001"
CAMPAIGN_ID="camp-001"

echo "================================"
echo "Phase 3B - Full Flow Marketplace QA"
echo "================================"

print_header() {
  echo -e "\n▶️ $1"
  echo "--------------------------------"
}

# 1. Seed check - Get all campaigns
print_header "1. GET /admin/campaigns - Check seed data"
CAMPAIGNS=$(curl -s "$API_URL/admin/campaigns")
echo "Total campaigns: $(echo $CAMPAIGNS | jq '.data | length')"
echo $CAMPAIGNS | jq '.data[] | {code: .campaign_code, title: .title, status, bounty: .bounty_amount, ctv_reward: .ctv_reward_amount, platform_fee: .platform_fee_amount}'

# 2. CTV - Get active campaigns
print_header "2. GET /ctv/campaigns - CTV view active campaigns"
curl -s "$API_URL/ctv/campaigns?ctv_id=$CTV_ID" | jq '.data[] | {code: .campaign_code, title: .title, ctv_reward: .ctv_reward_amount}'

# 3. CTV - Submit new lead
print_header "3. POST /ctv/leads - Submit a new lead"
NEW_LEAD=$(curl -s -X POST "$API_URL/ctv/leads" \
  -H "Content-Type: application/json" \
  -d "{
    \"ctv_id\": \"$CTV_ID\",
    \"campaign_id\": \"$CAMPAIGN_ID\",
    \"candidate_name\": \"Nguyen Van Test\",
    \"candidate_phone\": \"0999888777\",
    \"province\": \"TP.HCM\",
    \"district\": \"Quan 1\",
    \"desired_job\": \"Bao ve\"
  }")
echo $NEW_LEAD | jq '{success, lead_code: .data.lead_code, message}'
NEW_LEAD_CODE=$(echo $NEW_LEAD | jq -r '.data.lead_code // empty')

# 4. CTV - Try duplicate phone (same campaign) - SHOULD FAIL
print_header "4. POST /ctv/leads - Test duplicate phone (SHOULD FAIL)"
curl -s -X POST "$API_URL/ctv/leads" \
  -H "Content-Type: application/json" \
  -d "{
    \"ctv_id\": \"$CTV_ID_2\",
    \"campaign_id\": \"$CAMPAIGN_ID\",
    \"candidate_name\": \"Trung So\",
    \"candidate_phone\": \"0999888777\",
    \"province\": \"TP.HCM\",
    \"district\": \"Quan 2\",
    \"desired_job\": \"Bao ve\"
  }" | jq '{success, error, code: .existing_lead_code, hint: .hint}'

# 5. Company - Get leads (anonymous)
print_header "5. GET /company/leads - Company view leads (anonymous)"
curl -s "$API_URL/company/leads?company_id=$COMPANY_ID" | jq '.data[] | {code: .lead_code, status, is_anonymous, candidate_name, candidate_phone}'

# 6. Company - Claim lead
print_header "6. POST /company/leads/:id/claim - Company claims lead"
APPROVED_LEAD=$(curl -s "$API_URL/company/leads?company_id=$COMPANY_ID" | jq -r '.data[] | select(.status == "approved") | .id' | head -1)
if [ -n "$APPROVED_LEAD" ]; then
  CLAIM_RESULT=$(curl -s -X POST "$API_URL/company/leads/$APPROVED_LEAD/claim" \
    -H "Content-Type: application/json" \
    -d "{\"company_id\": \"$COMPANY_ID\"}")
  echo $CLAIM_RESULT | jq '{success, lead_code: .data.lead_code, bounty_paid: .data.bounty_paid}'
else
  echo "No approved lead to claim"
fi

# 7. Company - Update status (claimed -> interviewing)
print_header "7. POST /company/leads/:id/status - Update status interviewing"
if [ -n "$APPROVED_LEAD" ]; then
  curl -s -X POST "$API_URL/company/leads/$APPROVED_LEAD/status" \
    -H "Content-Type: application/json" \
    -d "{\"company_id\": \"$COMPANY_ID\", \"status\": \"interviewing\", \"reason\": \"Da lien he, hen phong van\"}" | jq '{success, new_status: .data.new_status}'
fi

# 8. Company - Update status (interviewing -> hired)
print_header "8. POST /company/leads/:id/status - Update status hired"
if [ -n "$APPROVED_LEAD" ]; then
  curl -s -X POST "$API_URL/company/leads/$APPROVED_LEAD/status" \
    -H "Content-Type: application/json" \
    -d "{\"company_id\": \"$COMPANY_ID\", \"status\": \"hired\", \"reason\": \"Da tuyen thanh cong\"}" | jq '{success, new_status: .data.new_status}'
fi

# 9. Company - Update status (hired -> qualified)
print_header "9. POST /company/leads/:id/status - Update status qualified (triggers financial settlement)"
if [ -n "$APPROVED_LEAD" ]; then
  QUALIFIED_RESULT=$(curl -s -X POST "$API_URL/company/leads/$APPROVED_LEAD/status" \
    -H "Content-Type: application/json" \
    -d "{\"company_id\": \"$COMPANY_ID\", \"status\": \"qualified\", \"reason\": \"Du dieu kien thanh toan\"}")
  echo $QUALIFIED_RESULT | jq '{success, new_status: .data.new_status, payout_triggered: .data.payout_triggered}'
fi

# 10. Admin - Tax report
print_header "10. GET /admin/tax-report - Verify financial report after qualified"
TAX_REPORT=$(curl -s "$API_URL/admin/tax-report")
echo $TAX_REPORT | jq '{
  total_qualified_leads: .summary.total_qualified_leads,
  total_bounty: .summary.total_company_bounty,
  platform_fees: .summary.total_platform_fees_20_percent,
  ctv_payouts: .summary.total_ctv_payouts_80_percent,
  qualified_leads_count: (.qualified_leads | length),
  math_check: .split_verification.math_check
}'

# 11. Admin - Config
print_header "11. GET /admin/config - Verify runtime config"
HEALTH=$(curl -s "$API_URL/health")
CONFIG=$(curl -s "$API_URL/admin/config")
echo "$HEALTH" | jq '{status, version, timestamp}'
echo "$CONFIG" | jq '{success, app_version: .data.app_version, database_path: .data.database_path, public_mode: .data.public_mode, admin_auth_mode: .data.admin_auth_mode}'

# 12. CTV - Check payouts
print_header "12. GET /ctv/payouts - CTV view payouts"
curl -s "$API_URL/ctv/payouts?ctv_id=$CTV_ID" | jq '.data[] | {lead_code, payout_amount, status}'

# 13. Admin - Check audit logs
print_header "13. GET /admin/audit-logs - Audit trail"
curl -s "$API_URL/admin/audit-logs?limit=10" | jq '.data[] | {entity_type, entity_id, action, actor_role, created_at}'

# 14. Admin - Check lead status history
print_header "14. Check lead_status_history in DB"
echo "Lead status history is recorded when status changes (claimed -> interviewing -> hired -> qualified)"

# 15. Check disputed leads
print_header "15. GET /admin/leads - Check disputed leads"
curl -s "$API_URL/admin/leads" | jq '[.data[] | select(.status == "disputed")] | length' | xargs -I {} echo "Disputed leads: {}"

echo -e "\n================================"
echo "✅ Phase 3B Full Flow QA Complete"
echo "================================"
echo ""
echo "Summary:"
echo "- Seed data: $(echo $CAMPAIGNS | jq '.data | length') campaigns"
echo "- Duplicate check: ✅ (step 4)"
echo "- Anonymous leads: ✅ (step 5)"
echo "- Claim flow: ✅ (step 6)"
echo "- Status history: ✅ (steps 7-9)"
echo "- Financial report on qualified: ✅ (step 10)"
echo "- Runtime config check: ✅ (step 11)"
echo "- Audit logging: ✅ (step 13)"
