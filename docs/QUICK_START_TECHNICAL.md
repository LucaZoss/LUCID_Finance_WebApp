# LUCID Finance - Quick Technical Actions

**For Developers & System Administrators**

Quick reference guide for common technical tasks. For detailed architecture, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Table of Contents

1. [Create a New User](#create-a-new-user)
2. [Deploy to Production (Pi)](#deploy-to-production-pi)
3. [Database Operations](#database-operations)
4. [Troubleshooting](#troubleshooting)
5. [Service Management](#service-management)

---

## Create a New User

### Option 1: Via API (Recommended)

```bash
# Login as admin
curl -X POST https://lucid-finance.cc/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-admin-password"}'

# Save the access_token from response

# Create new user
curl -X POST https://lucid-finance.cc/api/auth/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "username": "newuser",
    "password": "SecurePassword123!",
    "full_name": "John Doe",
    "is_admin": false
  }'
```

### Option 2: Via Admin UI

1. Login as admin at https://lucid-finance.cc
2. Navigate to Admin page (shield icon in sidebar)
3. Click "Add User"
4. Fill in details:
   - Username (unique)
   - Password (min 8 chars)
   - Full Name (optional)
   - Admin checkbox (for admin privileges)
5. Click "Create User"

### Option 3: Direct Database (Emergency Only)

```bash
# SSH to Pi
ssh luca@lucid-pi.local

# Run Python script
cd ~/LUCID_Finance_WebApp
.venv/bin/python << 'EOF'
from backend.data_pipeline.database_manager import DatabaseManager
from passlib.context import CryptContext

db = DatabaseManager()
session = db.get_session()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create user
hashed_password = pwd_context.hash("SecurePassword123!")

from backend.data_pipeline.models import User
user = User(
    username="newuser",
    full_name="John Doe",
    hashed_password=hashed_password,
    is_active=True,
    is_admin=False
)

session.add(user)
session.commit()
print(f"Created user: {user.username} (ID: {user.id})")
session.close()
EOF
```

---

## Deploy to Production (Pi)

### Full Deployment (Code + Frontend)

```bash
# On local machine - Build frontend
cd /Users/lucazosso/Desktop/Luca_Sandbox_Env/LUCID_Finance_WebApp
cd frontend
npm run build

# Commit and push changes
cd ..
git add .
git commit -m "Your commit message"
git push origin main

# SSH to Pi and pull changes
ssh luca@lucid-pi.local "cd ~/LUCID_Finance_WebApp && git pull origin main"

# Copy frontend dist to Pi
scp -r frontend/dist/* luca@lucid-pi.local:~/LUCID_Finance_WebApp/frontend/dist/

# Restart services on Pi
ssh luca@lucid-pi.local "sudo systemctl restart lucid-backend nginx"

# Verify services are running
ssh luca@lucid-pi.local "systemctl is-active lucid-backend nginx cloudflared"
```

### Backend-Only Update (Code Changes)

```bash
# Commit and push
git add backend/
git commit -m "Backend update"
git push origin main

# SSH to Pi
ssh luca@lucid-pi.local

# Pull and restart
cd ~/LUCID_Finance_WebApp
git pull origin main
sudo systemctl restart lucid-backend

# Check status
sudo journalctl -u lucid-backend -n 50 --no-pager
```

### Frontend-Only Update (UI Changes)

```bash
# Build frontend
cd frontend
npm run build

# Copy to Pi
scp -r dist/* luca@lucid-pi.local:~/LUCID_Finance_WebApp/frontend/dist/

# Restart nginx
ssh luca@lucid-pi.local "sudo systemctl restart nginx"
```

### Database Migration

```bash
# SSH to Pi
ssh luca@lucid-pi.local
cd ~/LUCID_Finance_WebApp

# Run migration script (if exists)
.venv/bin/python backend/migrate_add_subtype.py

# Restart backend
sudo systemctl restart lucid-backend
```

### Quick Deploy Script (One-Liner)

```bash
# Build, commit, push, deploy
cd /Users/lucazosso/Desktop/Luca_Sandbox_Env/LUCID_Finance_WebApp && \
cd frontend && npm run build && cd .. && \
git add . && git commit -m "Deploy $(date +%Y-%m-%d)" && git push origin main && \
ssh luca@lucid-pi.local "cd ~/LUCID_Finance_WebApp && git pull origin main" && \
scp -r frontend/dist/* luca@lucid-pi.local:~/LUCID_Finance_WebApp/frontend/dist/ && \
ssh luca@lucid-pi.local "sudo systemctl restart lucid-backend nginx"
```

---

## Database Operations

### Backup Database

```bash
# SSH to Pi
ssh luca@lucid-pi.local

# Run backup script (automated)
~/backup_lucid.sh

# Or manual backup
docker exec lucid_finance_db mysqldump \
  -ulucid_user -plucid_pass_2025 \
  --single-transaction \
  lucid_finance | gzip > ~/manual_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore Database

```bash
# SSH to Pi
ssh luca@lucid-pi.local

# Decompress and restore
gunzip -c ~/backups/lucid_backup_YYYYMMDD_HHMMSS.sql.gz | \
docker exec -i lucid_finance_db mysql -ulucid_user -plucid_pass_2025 lucid_finance
```

### Access MySQL Console

```bash
# SSH to Pi
ssh luca@lucid-pi.local

# Access MySQL
docker exec -it lucid_finance_db mysql -ulucid_user -plucid_pass_2025 lucid_finance

# Or as root
docker exec -it lucid_finance_db mysql -uroot -plucid_root_pass lucid_finance
```

### Common Database Queries

```sql
-- List all users
SELECT id, username, full_name, is_active, is_admin, created_at FROM users;

-- Count transactions by user
SELECT u.username, COUNT(t.id) as transaction_count
FROM users u
LEFT JOIN transactions t ON u.id = t.user_id
GROUP BY u.id, u.username;

-- Check database size
SELECT
    table_name AS 'Table',
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.TABLES
WHERE table_schema = 'lucid_finance'
ORDER BY (data_length + index_length) DESC;

-- Optimize tables (run monthly)
OPTIMIZE TABLE transactions;
OPTIMIZE TABLE users;
OPTIMIZE TABLE budget_plans;
OPTIMIZE TABLE categories;
OPTIMIZE TABLE categorization_rules;
OPTIMIZE TABLE processed_files;
```

### Reset Database (Development Only)

```bash
# ⚠️ WARNING: This will DELETE ALL DATA ⚠️

# SSH to Pi
ssh luca@lucid-pi.local
cd ~/LUCID_Finance_WebApp

# Stop backend
sudo systemctl stop lucid-backend

# Recreate database
docker exec lucid_finance_db mysql -uroot -plucid_root_pass -e "DROP DATABASE IF EXISTS lucid_finance;"
docker exec lucid_finance_db mysql -uroot -plucid_root_pass -e "CREATE DATABASE lucid_finance;"

# Re-run initialization
.venv/bin/python -c "from backend.data_pipeline.database_manager import DatabaseManager; DatabaseManager().create_all_tables()"

# Restart backend
sudo systemctl start lucid-backend
```

---

## Troubleshooting

### Backend Not Responding

```bash
# Check if backend is running
ssh luca@lucid-pi.local "systemctl status lucid-backend"

# View recent logs
ssh luca@lucid-pi.local "sudo journalctl -u lucid-backend -n 100 --no-pager"

# Restart backend
ssh luca@lucid-pi.local "sudo systemctl restart lucid-backend"

# If restart fails, check Python errors
ssh luca@lucid-pi.local
cd ~/LUCID_Finance_WebApp
.venv/bin/python -m backend.api.main
# Press Ctrl+C to exit, check error output
```

### Database Connection Error

```bash
# Check if MySQL is running
ssh luca@lucid-pi.local "docker ps | grep lucid_finance_db"

# Check MySQL logs
ssh luca@lucid-pi.local "docker logs -f lucid_finance_db"

# Restart MySQL
ssh luca@lucid-pi.local
cd ~/LUCID_Finance_WebApp
docker compose down
docker compose up -d

# Test connection
docker exec lucid_finance_db mysql -ulucid_user -plucid_pass_2025 -e "SELECT 1;"
```

### Cloudflare Tunnel Down (502 Error)

```bash
# Check tunnel status
ssh luca@lucid-pi.local "sudo systemctl status cloudflared"

# View tunnel logs
ssh luca@lucid-pi.local "sudo journalctl -u cloudflared -n 50 --no-pager"

# Restart tunnel
ssh luca@lucid-pi.local "sudo systemctl restart cloudflared"

# Test local access (should work even if tunnel is down)
ssh luca@lucid-pi.local "curl http://localhost:80"
```

### Nginx Not Serving Frontend

```bash
# Check nginx status
ssh luca@lucid-pi.local "sudo systemctl status nginx"

# Test nginx config
ssh luca@lucid-pi.local "sudo nginx -t"

# View error logs
ssh luca@lucid-pi.local "sudo tail -50 /var/log/nginx/error.log"

# Restart nginx
ssh luca@lucid-pi.local "sudo systemctl restart nginx"

# Check if dist files exist
ssh luca@lucid-pi.local "ls -lh ~/LUCID_Finance_WebApp/frontend/dist/"
```

### "Module not found" Error

```bash
# SSH to Pi
ssh luca@lucid-pi.local
cd ~/LUCID_Finance_WebApp

# Reinstall Python dependencies
uv sync

# Restart backend
sudo systemctl restart lucid-backend
```

### Database Out of Sync

```bash
# Check what migration is needed
ssh luca@lucid-pi.local
cd ~/LUCID_Finance_WebApp

# Compare local models with DB schema
.venv/bin/python -c "
from backend.data_pipeline.models import Base
from backend.data_pipeline.database_manager import DatabaseManager
db = DatabaseManager()
# Will show warnings if schema doesn't match
"

# If needed, run migration
.venv/bin/python backend/migrate_add_subtype.py
```

---

## Service Management

### Start/Stop/Restart Services

```bash
# Backend
sudo systemctl start lucid-backend
sudo systemctl stop lucid-backend
sudo systemctl restart lucid-backend
sudo systemctl status lucid-backend

# Nginx
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl restart nginx
sudo systemctl status nginx

# Cloudflare Tunnel
sudo systemctl start cloudflared
sudo systemctl stop cloudflared
sudo systemctl restart cloudflared
sudo systemctl status cloudflared

# MySQL (Docker)
docker stop lucid_finance_db
docker start lucid_finance_db
docker restart lucid_finance_db
```

### View Service Logs

```bash
# Backend (follow live)
sudo journalctl -u lucid-backend -f

# Backend (last 100 lines)
sudo journalctl -u lucid-backend -n 100 --no-pager

# Nginx access log
sudo tail -f /var/log/nginx/access.log

# Nginx error log
sudo tail -f /var/log/nginx/error.log

# Cloudflare tunnel
sudo journalctl -u cloudflared -f

# MySQL
docker logs -f lucid_finance_db
```

### Enable/Disable Services on Boot

```bash
# Enable (start automatically on boot)
sudo systemctl enable lucid-backend
sudo systemctl enable nginx
sudo systemctl enable cloudflared

# Disable (don't start on boot)
sudo systemctl disable lucid-backend
```

---

## Development Workflow

### Local Development Setup

```bash
# Clone repository
git clone https://github.com/LucaZoss/LUCID_Finance_WebApp.git
cd LUCID_Finance_WebApp

# Backend setup
uv venv
uv sync

# Frontend setup
cd frontend
npm install

# Start MySQL (Docker)
docker compose up -d

# Start backend (terminal 1)
uv run uvicorn backend.api.main:app --reload --host 0.0.0.0 --port 8000

# Start frontend dev server (terminal 2)
cd frontend
npm run dev
# Access at http://localhost:5173
```

### Run Tests (If Implemented)

```bash
# Backend tests
pytest backend/tests/

# Frontend tests
cd frontend
npm run test
```

### Code Quality

```bash
# Python linting
ruff check backend/

# Python formatting
black backend/

# TypeScript type checking
cd frontend
npx tsc --noEmit
```

---

## Quick Reference Cheat Sheet

### Most Common Commands

```bash
# Deploy everything
ssh luca@lucid-pi.local "cd ~/LUCID_Finance_WebApp && git pull origin main && sudo systemctl restart lucid-backend nginx"

# View backend logs
ssh luca@lucid-pi.local "sudo journalctl -u lucid-backend -f"

# Backup database
ssh luca@lucid-pi.local "~/backup_lucid.sh"

# Restart all services
ssh luca@lucid-pi.local "sudo systemctl restart lucid-backend nginx cloudflared"

# Check service status
ssh luca@lucid-pi.local "systemctl is-active lucid-backend nginx cloudflared"
```

### SSH Shortcuts (Add to ~/.ssh/config)

```
Host lucid-pi
    HostName lucid-pi.local
    User luca
    IdentityFile ~/.ssh/id_rsa
    ServerAliveInterval 60
```

Then use: `ssh lucid-pi` instead of `ssh luca@lucid-pi.local`

---

## Emergency Procedures

### Pi Not Responding

1. **Physical Access:** Connect monitor + keyboard to Pi
2. **Check Network:** `ping lucid-pi.local`
3. **Reboot Pi:** `ssh luca@lucid-pi.local "sudo reboot"` or power cycle
4. **Check SD Card:** Boot from backup SD card if primary fails

### Complete System Recovery

```bash
# 1. Restore from backup
ssh luca@lucid-pi.local
gunzip -c ~/backups/lucid_backup_LATEST.sql.gz | \
docker exec -i lucid_finance_db mysql -ulucid_user -plucid_pass_2025 lucid_finance

# 2. Restart all services
sudo systemctl restart lucid-backend nginx cloudflared

# 3. Verify access
curl https://lucid-finance.cc/api/health
```

### Rollback to Previous Version

```bash
# SSH to Pi
ssh luca@lucid-pi.local
cd ~/LUCID_Finance_WebApp

# View recent commits
git log --oneline -10

# Rollback to previous commit
git checkout <commit-hash>

# Restart services
sudo systemctl restart lucid-backend nginx

# If needed, restore previous database backup
```

---

## Performance Monitoring

### Check Resource Usage

```bash
# SSH to Pi
ssh luca@lucid-pi.local

# CPU and memory
htop

# Disk usage
df -h

# Database size
docker exec lucid_finance_db du -sh /var/lib/mysql

# Log size (should be minimal with Log2Ram)
sudo du -sh /var/log

# Top processes
ps aux --sort=-%mem | head -10
```

### Health Check Script

```bash
# Create health check script
cat > ~/health_check.sh << 'EOF'
#!/bin/bash
echo "=== LUCID Finance Health Check ==="
echo "Date: $(date)"
echo ""
echo "Services:"
systemctl is-active lucid-backend && echo "✓ Backend: Running" || echo "✗ Backend: Down"
systemctl is-active nginx && echo "✓ Nginx: Running" || echo "✗ Nginx: Down"
systemctl is-active cloudflared && echo "✓ Tunnel: Running" || echo "✗ Tunnel: Down"
docker ps | grep lucid_finance_db > /dev/null && echo "✓ MySQL: Running" || echo "✗ MySQL: Down"
echo ""
echo "Disk: $(df -h / | tail -1 | awk '{print $5 " used"}')"
echo "Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo "Uptime: $(uptime -p)"
EOF

chmod +x ~/health_check.sh
```

---

**Need Help?** Check [ARCHITECTURE.md](ARCHITECTURE.md) for system details or [DATABASE.md](DATABASE.md) for database management.
