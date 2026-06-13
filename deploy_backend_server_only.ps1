# Deploy backend server.js only - SAFE script
# ONLY copies server.js, does NOT touch src/, data/, .env, or DB
# Does NOT run npm install
# Does NOT delete anything

$KEY = "F:\1_A_Disk_D\khuong-binh\TK\Orcle\vps-40.233.83.234\ssh-key-1-1-E1.key"
$VPS = "ubuntu@40.233.83.234"
$BACKEND_DIR = "/var/www/viec-lam-gan-nha/backend"

Write-Host "=== DEPLOY BACKEND SERVER.JS ONLY ==="
Write-Host "WARNING: This script only deploys server.js"
Write-Host "It does NOT deploy backend/src/"
Write-Host "It does NOT modify data/, .env, or DB"
Write-Host ""

# Verify local file
Write-Host "[1/6] Verifying local server.js..."
if (!(Test-Path ".\backend\server.js")) { throw "Local server.js not found" }
$localLines = (Get-Content ".\backend\server.js").Count
Write-Host "Local server.js: $localLines lines"
if ($localLines -lt 600) { throw "server.js seems incomplete, abort" }

# Test SSH
Write-Host "[2/6] Testing SSH..."
ssh -i $KEY -o StrictHostKeyChecking=no $VPS "echo SSH_OK && whoami"
if ($LASTEXITCODE -ne 0) { throw "SSH failed" }

# Check live server.js
Write-Host "[3/6] Checking live server.js..."
$liveInfo = ssh -i $KEY -o StrictHostKeyChecking=no $VPS "wc -l $BACKEND_DIR/server.js && sha256sum $BACKEND_DIR/server.js"
Write-Host "Live: $liveInfo"

# Upload
Write-Host "[4/6] Uploading local server.js to /tmp..."
scp -i $KEY -o StrictHostKeyChecking=no ".\backend\server.js" "$VPS:/tmp/server.js.new"

# Deploy with backup on VPS
$deployCmd = @'
set -Eeuo pipefail
BACKEND_DIR="/var/www/viec-lam-gan-nha/backend"
BACKUP_DIR="/var/backups/vlgn/$(date +%Y%m%d-%H%M%S)"

echo "=== DEPLOY BACKEND SERVER.JS ==="
echo "1. Backup current server.js"
sudo mkdir -p "$BACKUP_DIR"
sudo cp "$BACKEND_DIR/server.js" "$BACKUP_DIR/server.js.bak"
echo "   Backup at: $BACKUP_DIR/server.js.bak"

echo "2. Replace server.js"
sudo mv /tmp/server.js.new "$BACKEND_DIR/server.js"
sudo chmod 644 "$BACKEND_DIR/server.js"

echo "3. Syntax check on VPS"
cd "$BACKEND_DIR"
node --check server.js
if (($?)); then
  echo "   [OK] Syntax check passed"
else
  echo "   [FAIL] Syntax check failed, reverting..."
  sudo mv "$BACKUP_DIR/server.js.bak" "$BACKEND_DIR/server.js"
  exit 1
fi

echo "4. Restart backend service..."
if systemctl list-unit-files | grep -q '^viec-lam-gan-nha\.service'; then
  sudo systemctl restart viec-lam-gan-nha.service
  sleep 2
  sudo systemctl status viec-lam-gan-nha.service --no-pager | head -20
else
  echo "   [WARN] Service not found, trying pm2 or node directly"
  pm2 restart server 2>/dev/null || pkill -f "node.*server" 2>/dev/null; sleep 1; nohup node server.js &>/dev/null &
fi

echo "5. Health check..."
sleep 3
curl -s "http://localhost:3001/api/health" | head -5 || echo "   Health check failed"

echo ""
echo "=== DEPLOY COMPLETE ==="
echo "Only server.js was updated"
echo "backend/src/ unchanged"
echo "data/ unchanged"
echo "No DB modifications"
'@

Write-Host "[5/6] Running deploy on VPS..."
ssh -i $KEY -o StrictHostKeyChecking=no $VPS "bash -c `"$deployCmd`""
if ($LASTEXITCODE -ne 0) { throw "Deploy failed" }

# Final verification
Write-Host "[6/6] Final verification..."
ssh -i $KEY -o StrictHostKeyChecking=no $VPS "echo 'Live server.js:' && wc -l $BACKEND_DIR/server.js && echo 'Service status:' && systemctl status viec-lam-gan-nha.service --no-pager | head -10"

Write-Host ""
Write-Host "=== BACKEND SERVER.JS DEPLOY COMPLETE ==="
Write-Host "Files modified: backend/server.js ONLY"
Write-Host "Files unchanged: backend/src/, backend/data/, .env, applications.db"