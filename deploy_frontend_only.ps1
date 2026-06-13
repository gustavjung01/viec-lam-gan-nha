# Deploy frontend only - safe script
# Only deploys frontend, does NOT touch backend

$KEY = "F:\1_A_Disk_D\khuong-binh\TK\Orcle\vps-40.233.83.234\ssh-key-1-1-E1.key"
$VPS = "ubuntu@40.233.83.234"

Write-Host "=== DEPLOY FRONTEND ONLY ==="

# Test SSH
Write-Host "[1/5] Testing SSH..."
ssh -i $KEY -o StrictHostKeyChecking=no $VPS "echo SSH_OK && whoami"
if ($LASTEXITCODE -ne 0) { throw "SSH failed" }

# Build
Write-Host "[2/5] Building frontend..."
npm install | Out-Null
npm run build
if (!(Test-Path "dist\index.html")) { throw "Build failed" }
Write-Host "Build OK"

# Package
Write-Host "[3/5] Packaging..."
Remove-Item -Force "frontend-dist.tar.gz" -ErrorAction SilentlyContinue
tar -czf "frontend-dist.tar.gz" -C "dist" .

# Upload
Write-Host "[4/5] Uploading..."
scp -i $KEY -o StrictHostKeyChecking=no "frontend-dist.tar.gz" "$($VPS):/tmp/frontend-dist.tar.gz"

# Deploy on VPS
$remoteScript = @'
set -Eeuo pipefail

FRONTEND_DIR="/var/www/viec-lam-gan-nha/frontend"
BACKUP_DIR="/var/backups/vlgn/$(date +%Y%m%d-%H%M%S)"

echo "Creating backup..."
sudo mkdir -p "$BACKUP_DIR"
sudo tar -czf "$BACKUP_DIR/frontend-before.tgz" -C /var/www/viec-lam-gan-nha frontend || true

echo "Deploying frontend..."
sudo rm -rf /tmp/vlgn-frontend-new
mkdir -p /tmp/vlgn-frontend-new
tar -xzf /tmp/frontend-dist.tar.gz -C /tmp/vlgn-frontend-new
sudo find "$FRONTEND_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
sudo cp -a /tmp/vlgn-frontend-new/. "$FRONTEND_DIR/"

echo "Reloading nginx..."
sudo nginx -t
sudo systemctl reload nginx

echo "FRONTEND_DEPLOY_DONE"
'@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path (Get-Location) "vlgn-deploy.sh"), $remoteScript.Replace("`r`n","`n"), $utf8NoBom)

Write-Host "[5/5] Running remote deploy..."
scp -i $KEY -o StrictHostKeyChecking=no "vlgn-deploy.sh" "$($VPS):/tmp/vlgn-deploy.sh"
ssh -i $KEY -o StrictHostKeyChecking=no $VPS "bash /tmp/vlgn-deploy.sh"

# Test
Write-Host "[TEST] Testing live..."
curl.exe -I "https://vieclamgannha.me/" | Select-Object -First 10

Write-Host "=== FRONTEND DEPLOY COMPLETE ==="
Write-Host "Backend NOT modified. Only frontend updated."
