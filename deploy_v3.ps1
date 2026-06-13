cd "F:\1_A_Disk_D\Web-Tuyen-Dung"

$KEY = "F:\1_A_Disk_D\khuong-binh\TK\Orcle\vps-40.233.83.234\ssh-key-1-1-E1.key"
Write-Host "KEY=$KEY"
if (!(Test-Path $KEY)) { throw "SSH key not found: $KEY" }

Write-Host "== SSH LOGIN TEST =="
ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new ubuntu@40.233.83.234 "echo SSH_OK && hostname && whoami && test -d /var/www/viec-lam-gan-nha/frontend && test -d /var/www/viec-lam-gan-nha/backend && echo PATH_OK"

if ($LASTEXITCODE -ne 0) { throw "SSH login/path check failed. Stop deploy." }

Write-Host "== LOCAL STATUS =="
git status --short
git log -1 --oneline

Write-Host "== BUILD FRONTEND =="
npm install
npm run build

if (!(Test-Path "dist\index.html")) { throw "Build failed: dist/index.html not found" }

Write-Host "== PACKAGE FILES =="
Remove-Item -Force "vlgn-frontend-dist.tgz","vlgn-backend.tgz","vlgn-deploy.sh" -ErrorAction SilentlyContinue

tar -czf "vlgn-frontend-dist.tgz" -C "dist" .

$backendItems = @("backend/server.js","backend/src","backend/package.json")
if (Test-Path "backend/package-lock.json") {
  $backendItems += "backend/package-lock.json"
}
tar -czf "vlgn-backend.tgz" $backendItems

$remoteScript = @'
set -Eeuo pipefail

FRONTEND_DIR="/var/www/viec-lam-gan-nha/frontend"
BACKEND_DIR="/var/www/viec-lam-gan-nha/backend"
BACKUP_DIR="/var/backups/vlgn/$(date +%Y%m%d-%H%M%S)"

echo "== REMOTE DEPLOY START =="
hostname
whoami

echo "== CHECK PATHS =="
test -d "$FRONTEND_DIR"
test -d "$BACKEND_DIR"

echo "== BACKUP =="
sudo mkdir -p "$BACKUP_DIR"
sudo tar -czf "$BACKUP_DIR/frontend-before.tgz" -C /var/www/viec-lam-gan-nha frontend || true
sudo tar -czf "$BACKUP_DIR/backend-before.tgz" -C /var/www/viec-lam-gan-nha backend || true

echo "== DEPLOY FRONTEND =="
sudo rm -rf /tmp/vlgn-frontend-new
mkdir -p /tmp/vlgn-frontend-new
tar -xzf /tmp/vlgn-frontend-dist.tgz -C /tmp/vlgn-frontend-new

sudo find "$FRONTEND_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
sudo cp -a /tmp/vlgn-frontend-new/. "$FRONTEND_DIR"/

echo "== DEPLOY BACKEND =="
sudo rm -rf /tmp/vlgn-backend-new
mkdir -p /tmp/vlgn-backend-new
tar -xzf /tmp/vlgn-backend.tgz -C /tmp/vlgn-backend-new

sudo cp -f /tmp/vlgn-backend-new/backend/server.js "$BACKEND_DIR/server.js"
sudo rm -rf "$BACKEND_DIR/src"
sudo cp -a /tmp/vlgn-backend-new/backend/src "$BACKEND_DIR/src"
sudo cp -f /tmp/vlgn-backend-new/backend/package.json "$BACKEND_DIR/package.json"

if [ -f /tmp/vlgn-backend-new/backend/package-lock.json ]; then
  sudo cp -f /tmp/vlgn-backend-new/backend/package-lock.json "$BACKEND_DIR/package-lock.json"
fi

sudo chown -R ubuntu:ubuntu "$BACKEND_DIR"

echo "== INSTALL BACKEND DEPS =="
cd "$BACKEND_DIR"
npm install --omit=dev

echo "== RESTART BACKEND =="
if systemctl list-unit-files | grep -q '^viec-lam-gan-nha\.service'; then
  sudo systemctl restart viec-lam-gan-nha.service
  sudo systemctl status viec-lam-gan-nha.service --no-pager -l | tail -40
else
  echo "Không thấy service viec-lam-gan-nha.service"
  systemctl list-units --type=service --all | grep -Ei 'viec|vlgn|backend|node' || true
  exit 1
fi

echo "== NGINX TEST/RELOAD =="
sudo nginx -t
sudo systemctl reload nginx

echo "DEPLOY_DONE"
'@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path (Get-Location) "vlgn-deploy.sh"), $remoteScript.Replace("`r`n","`n"), $utf8NoBom)

Write-Host "== UPLOAD TO VPS =="
scp -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new "vlgn-frontend-dist.tgz" ubuntu@40.233.83.234:/tmp/vlgn-frontend-dist.tgz
if ($LASTEXITCODE -ne 0) { throw "Upload frontend failed" }

scp -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new "vlgn-backend.tgz" ubuntu@40.233.83.234:/tmp/vlgn-backend.tgz
if ($LASTEXITCODE -ne 0) { throw "Upload backend failed" }

scp -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new "vlgn-deploy.sh" ubuntu@40.233.83.234:/tmp/vlgn-deploy.sh
if ($LASTEXITCODE -ne 0) { throw "Upload deploy script failed" }

Write-Host "== RUN REMOTE DEPLOY =="
ssh -i $KEY -o IdentitiesOnly=yes ubuntu@40.233.83.234 "bash /tmp/vlgn-deploy.sh"
if ($LASTEXITCODE -ne 0) { throw "Remote deploy failed" }

Write-Host "== TEST LIVE =="
curl.exe -I "https://vieclamgannha.me/" | Select-Object -First 20

Write-Host "DONE"