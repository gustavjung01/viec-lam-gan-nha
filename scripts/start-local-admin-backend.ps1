<#
Loads backend/.env.local.admin into environment and starts the backend server.
Usage: run this script in PowerShell.
Terminal 1: .\scripts\start-local-admin-backend.ps1
#>
$envFile = Join-Path -Path $PSScriptRoot -ChildPath '..\backend\.env.local.admin'
if (-not (Test-Path $envFile)) {
    Write-Error "Env file not found: $envFile"
    exit 1
}

Get-Content $envFile | ForEach-Object {
    $_ = $_.Trim()
    if (-not $_ -or $_.StartsWith('#')) { return }
    $parts = $_ -split '=', 2
    if ($parts.Length -ne 2) { return }
    $key = $parts[0].Trim()
    $val = $parts[1]
    # Set in-process env so child node process inherits them
    Set-Item -Path Env:\$key -Value $val
}

Write-Output "Starting backend with local admin env (PORT=$($env:PORT))..."
Push-Location -Path (Join-Path -Path $PSScriptRoot -ChildPath '..')
# Start node server (runs in foreground)
node backend/server.js
Pop-Location
