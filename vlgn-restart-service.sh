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