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