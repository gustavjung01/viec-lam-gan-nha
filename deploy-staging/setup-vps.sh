#!/bin/bash
set -e

DEPLOY_DIR="/var/www/viec-lam-gan-nha"
SERVICE_FILE="/etc/systemd/system/viec-lam-gan-nha.service"
NGINX_CONF="/etc/nginx/sites-available/viec-lam-gan-nha"

echo "================================"
echo "Setup Viec Lam Gan Nha Staging"
echo "VPS: Oracle Canada 40.233.83.234"
echo "================================"

# Create directories
echo "Creating directories..."
sudo mkdir -p $DEPLOY_DIR/frontend
sudo mkdir -p $DEPLOY_DIR/backend
sudo mkdir -p $DEPLOY_DIR/data
sudo mkdir -p $DEPLOY_DIR/scripts
sudo mkdir -p $DEPLOY_DIR/nginx

# Set permissions
sudo chown -R ubuntu:ubuntu $DEPLOY_DIR

echo "✅ Directories created"

# Install backend dependencies
echo "Installing backend dependencies..."
cd $DEPLOY_DIR/backend
npm install --production

echo "✅ Backend dependencies installed"

# Setup systemd service
echo "Setting up systemd service..."
sudo cp $DEPLOY_DIR/viec-lam-gan-nha.service $SERVICE_FILE
sudo systemctl daemon-reload
sudo systemctl enable viec-lam-gan-nha

echo "✅ Systemd service configured"

# Setup Nginx
echo "Setting up Nginx..."
sudo cp $DEPLOY_DIR/nginx/viec-lam-gan-nha.conf $NGINX_CONF
sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/

# Remove default site if exists
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

echo "✅ Nginx configured"

echo ""
echo "================================"
echo "Next steps:"
echo "================================"
echo "1. Create .env file:"
echo "   sudo nano $DEPLOY_DIR/backend/.env"
echo ""
echo "   Add content:"
echo "   PORT=3001"
echo "   NODE_ENV=production"
echo "   DATABASE_PATH=$DEPLOY_DIR/data/applications.db"
echo "   FRONTEND_URL=http://40.233.83.234"
echo ""
echo "2. Setup Basic Auth:"
echo "   sudo apt-get install apache2-utils  # if not installed"
echo "   sudo htpasswd -c $DEPLOY_DIR/.htpasswd staging"
echo ""
echo "3. Seed database:"
echo "   cd $DEPLOY_DIR/backend && node src/db/seed-marketplace.js"
echo ""
echo "4. Start backend:"
echo "   sudo systemctl start viec-lam-gan-nha"
echo ""
echo "5. Test Nginx:"
echo "   sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "6. Test deployment:"
echo "   curl -u staging:password http://40.233.83.234/api/health"
echo ""
echo "================================"
echo "Done!"
echo "================================"
