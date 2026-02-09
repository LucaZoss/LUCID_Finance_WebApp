# Production Deployment Guide - Complete Setup

This guide covers the complete production deployment of LUCID Finance to your Raspberry Pi with database migration and Cloudflare Tunnel setup for `lucid-finance.cc`.

## Overview

You will:
1. ✅ Deploy the application to your Raspberry Pi
2. ✅ Migrate your existing database data
3. ✅ Setup Cloudflare Tunnel for secure internet access
4. ✅ Configure production security settings
5. ✅ Setup automated backups

## Prerequisites

- Raspberry Pi configured with Docker, Node.js, Python, uv
- SSH access: `luca@lucid-pi.local`
- Domain: `lucid-finance.cc` (added to Cloudflare)
- Cloudflared installed on Pi
- Local database with data you want to migrate

---

## Phase 1: Initial Deployment

### Step 1: Update GitHub Repository URL

Before deploying, update the repository URL in the deployment script:

```bash
# On your Mac
cd LUCID_Finance_WebApp
nano deploy_to_pi.sh
```

Update line 16:
```bash
REPO_URL="https://github.com/YOUR_USERNAME/LUCID_Finance_WebApp.git"
```

Save and exit.

### Step 2: Run Deployment Script

The deployment script will ask if you want to transfer your database:

```bash
./deploy_to_pi.sh
```

When prompted:
```
Do you want to transfer your local database to the Pi?
Transfer database? (y/n): y
```

**Answer `y`** to migrate your data.

The script will:
- ✅ Connect to your Pi
- ✅ Clone/update code
- ✅ Install dependencies
- ✅ Build frontend
- ✅ Start database
- ✅ **Backup and transfer your local database**
- ✅ Setup backend service
- ✅ Configure nginx

### Step 3: Verify Deployment

Check that everything is running:

```bash
# Check backend status
ssh luca@lucid-pi.local 'sudo systemctl status lucid-backend'

# Check database
ssh luca@lucid-pi.local 'docker ps | grep mysql'

# Test API
ssh luca@lucid-pi.local 'curl http://localhost:8000/api/health'
```

### Step 4: Test Local Access

Get your Pi's IP:
```bash
ssh luca@lucid-pi.local 'hostname -I'
```

Open browser: `http://<pi-ip>` or `http://lucid-pi.local`

You should see your app with all your data!

---

## Phase 2: Cloudflare Tunnel Setup

### Step 1: Login to Cloudflare on Pi

```bash
ssh luca@lucid-pi.local

# Authenticate with Cloudflare
cloudflared tunnel login
```

This opens a browser - login and authorize.

### Step 2: Create Tunnel

```bash
# Create tunnel
cloudflared tunnel create lucid-finance

# Note the Tunnel ID displayed
# Example: Created tunnel lucid-finance with id a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Step 3: Configure DNS

```bash
# Route domain to tunnel
cloudflared tunnel route dns lucid-finance lucid-finance.cc

# Add www subdomain
cloudflared tunnel route dns lucid-finance www.lucid-finance.cc
```

### Step 4: Create Tunnel Configuration

```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Add (replace `<YOUR-TUNNEL-ID>` with your actual ID):

```yaml
tunnel: <YOUR-TUNNEL-ID>
credentials-file: /home/luca/.cloudflared/<YOUR-TUNNEL-ID>.json

ingress:
  - hostname: lucid-finance.cc
    service: http://localhost:80
    originRequest:
      noTLSVerify: true

  - hostname: www.lucid-finance.cc
    service: http://localhost:80
    originRequest:
      noTLSVerify: true

  - service: http_status:404
```

### Step 5: Test Tunnel

```bash
cloudflared tunnel run lucid-finance
```

Open `https://lucid-finance.cc` in your browser - should work!

Press `Ctrl+C` to stop.

### Step 6: Install as Service

```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
sudo systemctl status cloudflared
```

### Step 7: Configure Cloudflare Dashboard

1. Go to **SSL/TLS → Overview**
   - Set to "Flexible" or "Full"

2. Go to **Security → WAF**
   - Enable Web Application Firewall

3. Go to **Caching**
   - Add rule to bypass cache for `/api/*`

---

## Phase 3: Production Security

### Step 1: Update JWT Secret Key

**CRITICAL**: Change the default JWT secret before going live!

```bash
ssh luca@lucid-pi.local

cd ~/LUCID_Finance_WebApp

# Generate secure secret
openssl rand -hex 32
```

Copy the generated secret, then:

```bash
nano backend/api/auth.py
```

Replace line 14:
```python
SECRET_KEY = "your-secret-key-change-this-in-production-use-env-variable"
```

With:
```python
SECRET_KEY = "<paste-your-generated-secret>"
```

Or better yet, use environment variable:

```bash
nano .env
```

Add:
```bash
JWT_SECRET_KEY=<paste-your-generated-secret>
```

Then update `backend/api/auth.py`:
```python
import os
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback-secret-key")
```

Restart backend:
```bash
sudo systemctl restart lucid-backend
```

### Step 2: Update Database Passwords

Update your production database passwords:

```bash
nano ~/LUCID_Finance_WebApp/.env
```

Change:
```bash
DB_PASSWORD=your_secure_production_password
DB_ROOT_PASSWORD=your_secure_root_password
```

Restart database:
```bash
cd ~/LUCID_Finance_WebApp
docker compose down
docker compose up -d
```

Wait 5 seconds, then restore your data:
```bash
# If you have a backup
./scripts/restore_database.sh <your-backup-file>
```

Restart backend:
```bash
sudo systemctl restart lucid-backend
```

### Step 3: Create Production Admin User

If you transferred your database, you're done. Otherwise:

```bash
cd ~/LUCID_Finance_WebApp
uv run python scripts/create_admin.py
```

Follow prompts to create your admin user.

### Step 4: Update nginx for Domain

```bash
sudo nano /etc/nginx/sites-available/lucid-finance
```

Update server_name:
```nginx
server {
    listen 80;
    server_name lucid-finance.cc www.lucid-finance.cc localhost _;

    # ... rest of config
}
```

Restart nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## Phase 4: Automated Backups

### Setup Daily Backups

Create backup directory:
```bash
mkdir -p ~/backups
```

Create backup script:
```bash
nano ~/backup_lucid.sh
```

Add:
```bash
#!/bin/bash
cd /home/luca/LUCID_Finance_WebApp
./scripts/backup_database.sh ~/backups/lucid_backup_$(date +%Y%m%d).sql

# Keep only last 7 days
find ~/backups -name "lucid_backup_*.sql" -mtime +7 -delete
```

Make executable:
```bash
chmod +x ~/backup_lucid.sh
```

Schedule with cron:
```bash
crontab -e
```

Add:
```bash
# Daily backup at 2 AM
0 2 * * * /home/luca/backup_lucid.sh >> /home/luca/backup.log 2>&1
```

---

## Phase 5: Monitoring & Maintenance

### View Logs

```bash
# Backend logs
ssh luca@lucid-pi.local 'sudo journalctl -u lucid-backend -f'

# Cloudflare tunnel logs
ssh luca@lucid-pi.local 'sudo journalctl -u cloudflared -f'

# nginx logs
ssh luca@lucid-pi.local 'sudo tail -f /var/log/nginx/error.log'

# Database logs
ssh luca@lucid-pi.local 'docker logs -f lucid_finance_db'
```

### Health Checks

```bash
# API health
curl https://lucid-finance.cc/api/health

# Backend status
ssh luca@lucid-pi.local 'sudo systemctl status lucid-backend'

# Tunnel status
ssh luca@lucid-pi.local 'cloudflared tunnel info lucid-finance'

# Database status
ssh luca@lucid-pi.local 'docker ps | grep mysql'
```

### Update Application

When you have new changes:

```bash
# From your Mac

# 1. Push to GitHub
git add .
git commit -m "Your changes"
git push

# 2. Deploy to Pi (will ask about database transfer)
./deploy_to_pi.sh
```

---

## Phase 6: Testing Checklist

Before announcing your app is live, test:

- [ ] **Basic Access**
  - [ ] Can access `https://lucid-finance.cc`
  - [ ] Can access `https://www.lucid-finance.cc`
  - [ ] Both redirect properly

- [ ] **Authentication**
  - [ ] Can login with admin credentials
  - [ ] JWT tokens working correctly
  - [ ] Logout works

- [ ] **Data Integrity**
  - [ ] All transactions visible
  - [ ] All budgets visible
  - [ ] Dashboard shows correct data
  - [ ] Categories are editable

- [ ] **CRUD Operations**
  - [ ] Can create new transaction
  - [ ] Can edit transaction
  - [ ] Can delete transaction
  - [ ] Can create/edit budgets
  - [ ] Can manage categories

- [ ] **File Upload**
  - [ ] Can upload CSV files
  - [ ] Files are processed correctly
  - [ ] No duplicates created

- [ ] **Budget Helper**
  - [ ] Modal opens correctly
  - [ ] Calculations work
  - [ ] Can apply to budget

- [ ] **Performance**
  - [ ] Pages load within 2-3 seconds
  - [ ] No console errors
  - [ ] API responses are fast

- [ ] **Security**
  - [ ] HTTPS works (green lock icon)
  - [ ] Protected routes require login
  - [ ] JWT secret is changed
  - [ ] Database passwords are strong

---

## Troubleshooting

### Database Data Not Appearing

1. Check if restore completed:
```bash
ssh luca@lucid-pi.local
cd ~/LUCID_Finance_WebApp
docker exec -it lucid_finance_db mysql -ulucid_user -p
```

Enter password, then:
```sql
USE lucid_finance;
SELECT COUNT(*) FROM transactions;
SELECT COUNT(*) FROM budget_plans;
SELECT COUNT(*) FROM categories;
EXIT;
```

2. If counts are zero, restore again:
```bash
./scripts/transfer_database.sh
```

### Cloudflare 502 Error

1. Check backend is running:
```bash
ssh luca@lucid-pi.local 'sudo systemctl status lucid-backend'
```

2. Check tunnel is connected:
```bash
ssh luca@lucid-pi.local 'sudo systemctl status cloudflared'
```

3. Test local access:
```bash
ssh luca@lucid-pi.local 'curl http://localhost:80'
```

### Login Not Working

1. Check JWT secret was updated:
```bash
ssh luca@lucid-pi.local 'grep SECRET_KEY ~/LUCID_Finance_WebApp/backend/api/auth.py'
```

2. Restart backend:
```bash
ssh luca@lucid-pi.local 'sudo systemctl restart lucid-backend'
```

3. Clear browser cookies and try again

### Slow Performance

1. Check Pi resources:
```bash
ssh luca@lucid-pi.local 'htop'
```

2. Check database size:
```bash
ssh luca@lucid-pi.local 'docker exec lucid_finance_db du -sh /var/lib/mysql'
```

3. Consider adding database indexes if needed

---

## Maintenance Commands Reference

```bash
# Full restart
ssh luca@lucid-pi.local 'cd ~/LUCID_Finance_WebApp && docker compose restart && sudo systemctl restart lucid-backend && sudo systemctl restart cloudflared && sudo systemctl restart nginx'

# Update application
./deploy_to_pi.sh

# Backup database
./scripts/transfer_database.sh

# View all logs
ssh luca@lucid-pi.local 'sudo journalctl -u lucid-backend -u cloudflared -f'

# Check all services
ssh luca@lucid-pi.local 'sudo systemctl status lucid-backend cloudflared nginx'
```

---

## Success! 🎉

Your LUCID Finance app is now:
- ✅ Running in production on your Raspberry Pi
- ✅ Accessible worldwide at `https://lucid-finance.cc`
- ✅ Secured with Cloudflare and HTTPS
- ✅ Protected with authentication
- ✅ Automatically backed up daily
- ✅ All your data migrated successfully

**Next Steps:**
1. Share the URL with trusted users
2. Monitor logs for any issues
3. Schedule regular updates
4. Consider setting up monitoring/alerting
5. Enjoy your self-hosted finance app!

For detailed Cloudflare Tunnel configuration, see: [CLOUDFLARE_TUNNEL.md](CLOUDFLARE_TUNNEL.md)

For deployment details, see: [DEPLOY_PI.md](DEPLOY_PI.md)
