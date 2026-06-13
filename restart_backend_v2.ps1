cd "F:\1_A_Disk_D\Web-Tuyen-Dung"

$KEY = "F:\1_A_Disk_D\khuong-binh\TK\Orcle\vps-40.233.83.234\ssh-key-1-1-E1.key"
if (!(Test-Path $KEY)) { throw "SSH key not found: $KEY" }

$remoteScript = @'
set -Eeuo pipefail

echo "== SSH OK =="
hostname
whoami

echo "== Restart backend service =="
sudo systemctl restart viec-lam-gan-nha.service

echo "== Backend status =="
sudo systemctl status viec-lam-gan-nha.service --no-pager -l | tail -50

echo "== Nginx test =="
sudo nginx -t

echo "== Reload nginx =="
sudo systemctl reload nginx

echo "== Recent backend logs =="
sudo journalctl -u viec-lam-gan-nha.service -n 80 --no-pager

echo "RESTART_DONE"
'@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path (Get-Location) "vlgn-restart-service.sh"), $remoteScript.Replace("`r`n","`n"), $utf8NoBom)

Write-Host "== Upload LF restart script =="
scp -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new "vlgn-restart-service.sh" ubuntu@40.233.83.234:/tmp/vlgn-restart-service.sh
if ($LASTEXITCODE -ne 0) { throw "Upload restart script failed" }

Write-Host "== Run restart script on VPS =="
ssh -i $KEY -o IdentitiesOnly=yes ubuntu@40.233.83.234 "bash /tmp/vlgn-restart-service.sh"
if ($LASTEXITCODE -ne 0) { throw "Remote restart failed" }

Write-Host "== Test live homepage =="
curl.exe -I "https://vieclamgannha.me/" | Select-Object -First 20

Write-Host "DONE"