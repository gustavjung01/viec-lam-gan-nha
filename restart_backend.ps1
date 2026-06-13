cd "F:\1_A_Disk_D\Web-Tuyen-Dung"

$KEY = Join-Path $env:USERPROFILE ".ssh\ssh-key-1-1-E1.key"
if (!(Test-Path $KEY)) { throw "SSH key not found: $KEY" }

ssh -i $KEY -o IdentitiesOnly=yes ubuntu@40.233.83.234 "set -e
echo SSH_OK

echo '== Restart correct backend service =='
sudo systemctl restart viec-lam-gan-nha.service

echo '== Backend status =='
sudo systemctl status viec-lam-gan-nha.service --no-pager -l | tail -50

echo '== Nginx test/reload =='
sudo nginx -t
sudo systemctl reload nginx

echo '== Recent backend logs =='
sudo journalctl -u viec-lam-gan-nha.service -n 80 --no-pager

echo RESTART_DONE
"

curl.exe -I "https://vieclamgannha.me/" | Select-Object -First 20

Write-Host "DONE"