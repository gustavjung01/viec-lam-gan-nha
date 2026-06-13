# Test API Script for Windows PowerShell
# Phase 3B QA

$API_URL = "http://localhost:3001/api"
$CTV_ID = "ctv-001"
$CTV_ID_2 = "ctv-002"
$COMPANY_ID = "comp-001"
$CAMPAIGN_ID = "camp-001"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Phase 3B - API QA (PowerShell)" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

function Test-Step($name, $script) {
    Write-Host "`n▶️ $name" -ForegroundColor Yellow
    Write-Host "--------------------------------" -ForegroundColor Gray
    try {
        & $script
    } catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
    }
}

# Step 1: Get campaigns
Test-Step "1. GET /admin/campaigns - Check seed data" {
    $res = Invoke-RestMethod -Uri "$API_URL/admin/campaigns" -Method GET
    Write-Host "Total campaigns: $($res.data.Count)"
    $res.data | Select-Object -First 3 | ForEach-Object {
        Write-Host "  - $($_.campaign_code): $($_.title) [status=$($_.status), bounty=$($_.bounty_amount), ctv_reward=$($_.ctv_reward_amount)]"
    }
}

# Step 2: CTV get campaigns
Test-Step "2. GET /ctv/campaigns - CTV view active campaigns" {
    $res = Invoke-RestMethod -Uri "$API_URL/ctv/campaigns?ctv_id=$CTV_ID" -Method GET
    Write-Host "Active campaigns: $($res.data.Count)"
    $res.data | ForEach-Object {
        Write-Host "  - $($_.campaign_code): $($_.title) [reward=$($_.ctv_reward_amount)]"
    }
}

# Step 3: CTV submit lead
Test-Step "3. POST /ctv/leads - Submit a new lead" {
    $body = @{
        ctv_id = $CTV_ID
        campaign_id = $CAMPAIGN_ID
        candidate_name = "Nguyen Van Test PS"
        candidate_phone = "0999888666"
        province = "TP.HCM"
        district = "Quan 1"
        desired_job = "Bao ve"
    } | ConvertTo-Json

    $res = Invoke-RestMethod -Uri "$API_URL/ctv/leads" -Method POST -Body $body -ContentType "application/json"
    Write-Host "Success: $($res.success)"
    Write-Host "Lead code: $($res.data.lead_code)"
    $global:NEW_LEAD_CODE = $res.data.lead_code
}

# Step 4: Duplicate phone test
Test-Step "4. POST /ctv/leads - Test duplicate phone (SHOULD FAIL)" {
    $body = @{
        ctv_id = $CTV_ID_2
        campaign_id = $CAMPAIGN_ID
        candidate_name = "Trung So PS"
        candidate_phone = "0999888666"
        province = "TP.HCM"
        district = "Quan 2"
        desired_job = "Bao ve"
    } | ConvertTo-Json

    try {
        $res = Invoke-RestMethod -Uri "$API_URL/ctv/leads" -Method POST -Body $body -ContentType "application/json"
        Write-Host "❌ UNEXPECTED SUCCESS" -ForegroundColor Red
    } catch {
        $err = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "✅ BLOCKED as expected" -ForegroundColor Green
        Write-Host "  Error: $($err.error)"
        Write-Host "  Existing lead: $($err.existing_lead_code)"
    }
}

# Step 5: Company get leads
Test-Step "5. GET /company/leads - Company view leads (anonymous)" {
    $res = Invoke-RestMethod -Uri "$API_URL/company/leads?company_id=$COMPANY_ID" -Method GET
    Write-Host "Company leads: $($res.data.Count)"
    $res.data | Select-Object -First 3 | ForEach-Object {
        $anon = if ($_.is_anonymous) { "🚫 ANONYMOUS" } else { "✅ VISIBLE" }
        Write-Host "  - $($_.lead_code) [$($_.status)] $anon"
        Write-Host "    Name: '$($_.candidate_name)', Phone: '$($_.candidate_phone)'"
    }
}

# Step 6: Tax report
Test-Step "6. GET /admin/tax-report - Verify financial report after qualified" {
    $res = Invoke-RestMethod -Uri "$API_URL/admin/tax-report" -Method GET
    Write-Host "Total qualified leads: $($res.summary.total_qualified_leads)"
    Write-Host "Total bounty: $($res.summary.total_company_bounty)"
    Write-Host "Platform fees: $($res.summary.total_platform_fees_20_percent)"
    Write-Host "CTV payouts: $($res.summary.total_ctv_payouts_80_percent)"
    Write-Host "Qualified leads detail rows: $($res.qualified_leads.Count)"
    Write-Host "Math check: $($res.split_verification.math_check)"
}

# Step 7: Runtime config
Test-Step "7. GET /admin/config - Verify runtime config" {
    $health = Invoke-RestMethod -Uri "$API_URL/health" -Method GET
    $config = Invoke-RestMethod -Uri "$API_URL/admin/config" -Method GET
    Write-Host "Health status: $($health.status)"
    Write-Host "Health version: $($health.version)"
    Write-Host "App version: $($config.data.app_version)"
    Write-Host "Database path: $($config.data.database_path)"
    Write-Host "Public mode: $($config.data.public_mode)"
    Write-Host "Admin auth mode: $($config.data.admin_auth_mode)"
}

# Step 8: Audit logs
Test-Step "8. GET /admin/audit-logs - Audit trail" {
    $res = Invoke-RestMethod -Uri "$API_URL/admin/audit-logs?limit=5" -Method GET
    Write-Host "Audit logs: $($res.data.Count)"
    $res.data | ForEach-Object {
        Write-Host "  - $($_.entity_type) $($_.entity_id): $($_.action) by $($_.actor_role)"
    }
}

# Step 9: Disputed leads
Test-Step "9. GET /admin/leads - Check disputed leads" {
    $res = Invoke-RestMethod -Uri "$API_URL/admin/leads" -Method GET
    $disputed = $res.data | Where-Object { $_.status -eq "disputed" }
    Write-Host "Disputed leads: $($disputed.Count)"
    $disputed | ForEach-Object {
        Write-Host "  - $($_.lead_code): $($_.candidate_name) - SĐT: $($_.candidate_phone)"
    }
}

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "✅ API QA Complete" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
