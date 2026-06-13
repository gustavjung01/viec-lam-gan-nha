cd "F:\1_A_Disk_D\Web-Tuyen-Dung"

$KEY = Join-Path $env:USERPROFILE ".ssh\ssh-key-1-1-E1.key"
Test-Path $KEY

git status --short
git log -1 --oneline

npm install
npm run build

Compress-Archive -Force -Path "dist\*" -DestinationPath "vlgn-frontend-dist.zip"

Compress-Archive -Force `
  -Path "backend\server.js","backend\src","backend\package.json","backend\package-lock.json" `
  -DestinationPath "vlgn-backend.zip"

scp -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new "vlgn-frontend-dist.zip" ubuntu@40.233.83.234:/tmp/vlgn-frontend-dist.zip

scp -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new "vlgn-backend.zip" ubuntu@40.233.83.234:/tmp/vlgn-backend.zip

ssh -i $KEY -o IdentitiesOnly=yes ubuntu@40.233.83.234 "set -e
echo SSH_OK

echo '== Backup frontend =='
sudo mkdir -p /var/backups/vlgn
sudo tar -czf /var/backups/vlgn/frontend-before-`$(date +%Y%m%d-%H%M%S).tar.gz -C /var/www/viec-lam-gan-nha frontend || true

echo '== Deploy frontend =='
rm -rf /tmp/vlgn-frontend-new
mkdir -p /tmp/vlgn-frontend-new
unzip -oq /tmp/vlgn-frontend-dist.zip -d /tmp/vlgn-frontend-new
sudo rm -rf /var/www/viec-lam-gan-nha/frontend/*
sudo cp -r /tmp/vlgn-frontend-new/* /var/www/viec-lam-gan-nha/frontend/

echo '== Backup backend =='
sudo tar -czf /var/backups/vlgn/backend-before-`$(date +%Y%m%d-%H%M%S).tar.gz -C /var/www/viec-lam-gan-nha backend || true

echo '== Deploy backend =='
rm -rf /tmp/vlgn-backend-new
mkdir -p /tmp/vlgn-backend-new
unzip -oq /tmp/vlgn-backend.zip -d /tmp/vlgn-backend-new

cd /var/www/viec-lam-gan-nha/backend
sudo cp -f /tmp/vlgn-backend-new/backend/server.js ./server.js
sudo rm -rf ./src
sudo cp -r /tmp/vlgn-backend-new/backend/src ./src
sudo cp -f /tmp/vlgn-backend-new/backend/package.json ./package.json
if [ -f /tmp/vlgn-backend-new/backend/package-lock.json ]; then sudo cp -f /tmp/vlgn-backend-new/backend/package-lock.json ./package-lock.json; fi

echo '== Install backend dependencies =='
npm install --omit=dev

echo '== Restart backend =='
if systemctl list-unit-files | grep -q 'vieclamgannha-backend'; then
  sudo systemctl restart vieclamgannha-backend
  sudo systemctl status vieclamgannha-backend --no-pager -l | tail -40
else
  echo 'Không thấy service vieclamgannha-backend. Liệt kê service liên quan:'
  systemctl list-units --type=service | grep -Ei 'viec|vlgn|backend|node' || true
  exit 1
fi

echo '== Reload nginx =='
sudo nginx -t
sudo systemctl reload nginx

echo DEPLOY_DONE
"

curl.exe -I "https://vieclamgannha.me/" | Select-Object -First 20
curl.exe -I "https://api.vieclamgannha.me/api/health" | Select-Object -First 20
curl.exe -i -sS "https://api.vieclamgannha.me/api/account/me" -H "Authorization: Bearer test" | Select-Object -First 30