# Run Browser QA with Playwright
# IMPORTANT: Update password below before running

param(
    [string]$Password = "",  # Enter password here or pass as parameter
    [switch]$Headed = $true
)

if (-not $Password) {
    Write-Host "ERROR: Please provide password!" -ForegroundColor Red
    Write-Host "Usage: .\run-browser-qa.ps1 -Password 'YOUR_PASSWORD'" -ForegroundColor Yellow
    exit 1
}

# Set environment variables
$env:STAGING_URL = "http://40.233.83.234"
$env:BASIC_AUTH_USER = "staging"
$env:BASIC_AUTH_PASS = $Password

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Browser QA Test - Staging Environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "URL: $env:STAGING_URL" -ForegroundColor Green
Write-Host "User: $env:BASIC_AUTH_USER" -ForegroundColor Green
Write-Host "Password: [HIDDEN]" -ForegroundColor Gray
Write-Host ""

# Check if Playwright is installed
$playwrightExists = Get-Command npx -ErrorAction SilentlyContinue
if (-not $playwrightExists) {
    Write-Host "Installing Playwright..." -ForegroundColor Yellow
    npm init playwright@latest
}

# Run tests
Write-Host "Starting Playwright tests..." -ForegroundColor Green
if ($Headed) {
    npx playwright test e2e/browser-qa.spec.ts --headed
} else {
    npx playwright test e2e/browser-qa.spec.ts
}

# Clear password from memory
$env:BASIC_AUTH_PASS = ""
Write-Host ""
Write-Host "Test completed. Password cleared from memory." -ForegroundColor Green
