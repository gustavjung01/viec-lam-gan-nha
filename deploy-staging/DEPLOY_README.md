# Staging Deployment Package - Phase 3D

## Target VPS
- **IP**: 40.233.83.234 (Oracle Canada)
- **User**: ubuntu
- **OS**: Ubuntu 22.04
- **Web Server**: Nginx

## Constraints Applied
- ❌ NO git push
- ❌ NO git pull on VPS
- ❌ NOT using VPS Học Chung Khối 140.245.202.65
- ✅ Basic Auth protection enabled
- ✅ Deploy to Oracle Canada VPS: 40.233.83.234

## Package Contents

```
deploy-staging/
├── frontend/           # Built React app (dist)
├── backend/            # Node.js backend source
│   ├── server.js
│   ├── package.json
│   ├── package-lock.json
│   └── src/
├── nginx/              # Nginx configuration
│   └── viec-lam-gan-nha.conf
├── scripts/            # Database seed scripts
│   ├── seed-marketplace.js
│   └── check-counts.mjs
├── viec-lam-gan-nha.service  # Systemd service file
└── setup-vps.sh        # VPS setup script
```

## Deploy Steps

### Step 1: Upload to VPS

From local machine:
```bash
rsync -avz --delete deploy-staging/ ubuntu@40.233.83.234:/var/www/viec-lam-gan-nha/
```

### Step 2: Run Setup Script

SSH into VPS and run:
```bash
ssh ubuntu@40.233.83.234
bash /var/www/viec-lam-gan-nha/setup-vps.sh
```

### Step 3: Create Environment File

```bash
sudo nano /var/www/viec-lam-gan-nha/backend/.env
```

Add:
```
PORT=3001
NODE_ENV=production
DATABASE_PATH=/var/www/viec-lam-gan-nha/data/applications.db
FRONTEND_URL=http://40.233.83.234
```

### Step 4: Setup Basic Auth

```bash
# Install apache2-utils if needed
sudo apt-get install apache2-utils -y

# Create htpasswd file (user: staging)
sudo htpasswd -c /var/www/viec-lam-gan-nha/.htpasswd staging
# Enter password when prompted
```

### Step 5: Seed Database

```bash
cd /var/www/viec-lam-gan-nha/backend
node src/db/seed-marketplace.js
```

### Step 6: Start Services

```bash
# Start backend
sudo systemctl start viec-lam-gan-nha

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### Step 7: Verify Deployment

```bash
# Test health endpoint (no auth)
curl http://40.233.83.234/api/health

# Test API with auth
curl -u staging:password http://40.233.83.234/api/admin/campaigns

# Test CTV campaigns
curl -u staging:password "http://40.233.83.234/api/ctv/campaigns?ctv_id=ctv-001"
```

## API Test Commands

```bash
# 1. Get campaigns
curl -u staging:password http://40.233.83.234/api/admin/campaigns

# 2. CTV get active campaigns
curl -u staging:password "http://40.233.83.234/api/ctv/campaigns?ctv_id=ctv-001"

# 3. Company get leads
curl -u staging:password "http://40.233.83.234/api/company/leads?company_id=comp-001"

# 4. Tax report (20/80 split)
curl -u staging:password http://40.233.83.234/api/admin/tax-report

# 5. Audit logs
curl -u staging:password "http://40.233.83.234/api/admin/audit-logs?limit=5"
```

## Troubleshooting

### Backend not starting
```bash
sudo systemctl status viec-lam-gan-nha
sudo journalctl -u viec-lam-gan-nha -f
```

### Database issues
```bash
cd /var/www/viec-lam-gan-nha/backend
node src/db/seed-marketplace.js
```

### Nginx issues
```bash
sudo nginx -t
sudo systemctl status nginx
```

### Permission issues
```bash
sudo chown -R ubuntu:ubuntu /var/www/viec-lam-gan-nha
```

## Important Notes

1. **No Sensitive Data**: Do not enter real candidate data until auth/permissions are complete
2. **Staging Only**: This is internal staging, not production
3. **Basic Auth**: All routes except /api/health require authentication
4. **Role Switcher**: Frontend has dev role switcher for testing
5. **Database**: SQLite local file at `/var/www/viec-lam-gan-nha/data/applications.db`
