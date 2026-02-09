# Deploy to Raspberry Pi - Quick Start

This guide covers deploying LUCID Finance WebApp to your Raspberry Pi.

## Prerequisites

Your Pi already has:
- ✅ Docker & Docker Compose
- ✅ Node.js
- ✅ Python + uv
- ✅ Log2Ram & zRAM
- ✅ Cloudflared
- ✅ SSH access at `luca@lucid-pi.local`

## Quick Deployment

### Option 1: Automated Deployment (Recommended)

From your Mac, run the deployment script:

```bash
cd LUCID_Finance_WebApp
./deploy_to_pi.sh
```

This script will:
1. Connect to your Pi via SSH
2. Clone/update the code
3. Install dependencies
4. Build the frontend
5. Setup database
6. Create systemd service
7. Configure nginx
8. Start everything

### Option 2: Manual Deployment

If you prefer manual control:

#### 1. Clone/Update Code on Pi

```bash
# SSH to Pi
ssh luca@lucid-pi.local

# Clone repository (first time)
cd ~
git clone https://github.com/yourusername/LUCID_Finance_WebApp.git
cd LUCID_Finance_WebApp

# OR pull updates (subsequent deployments)
cd ~/LUCID_Finance_WebApp
git pull
```

#### 2. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your production values
nano .env
```

**Important**: Update these values in `.env`:
```bash
DB_PASSWORD=your_secure_password_here
DB_ROOT_PASSWORD=your_secure_root_password_here
```

#### 3. Install Dependencies

```bash
# Backend
uv sync

# Frontend
cd frontend
npm install
npm run build
cd ..
```

#### 4. Start Database

```bash
docker compose up -d
sleep 5  # Wait for MySQL to initialize
```

#### 5. Initialize Categories

```bash
uv run python scripts/initialize_categories.py --force
```

#### 6. Create Admin User

```bash
uv run python scripts/create_admin.py
# Follow prompts to create your admin account
```

#### 7. Setup Backend Service

Create systemd service file:

```bash
sudo nano /etc/systemd/system/lucid-backend.service
```

Add this content:

```ini
[Unit]
Description=LUCID Finance Backend API
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=luca
WorkingDirectory=/home/luca/LUCID_Finance_WebApp
Environment="PATH=/home/luca/.cargo/bin:/home/luca/.local/bin:/usr/bin"
ExecStartPre=/bin/sleep 5
ExecStart=/home/luca/.cargo/bin/uv run uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable lucid-backend
sudo systemctl start lucid-backend
sudo systemctl status lucid-backend
```

#### 8. Setup nginx (if not already configured)

If nginx is not installed:

```bash
sudo apt install -y nginx
```

Create nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/lucid-finance
```

Add this content:

```nginx
server {
    listen 80;
    server_name _;

    # Frontend - serve static files
    location / {
        root /home/luca/LUCID_Finance_WebApp/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API - proxy to FastAPI
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://localhost:8000/api/health;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/lucid-finance /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Access Your Application

### Local Network

Find your Pi's IP address:

```bash
hostname -I
# Example: 192.168.1.100
```

Access via:
- **Application**: `http://192.168.1.100` or `http://lucid-pi.local`
- **API Docs**: `http://192.168.1.100/api/docs`

### Internet Access via Cloudflared

Since you have Cloudflared configured, you can create a tunnel for secure remote access:

```bash
# On your Pi
cloudflared tunnel create lucid-finance
cloudflared tunnel route dns lucid-finance lucid.yourdomain.com
```

Configure the tunnel:

```bash
nano ~/.cloudflared/config.yml
```

Add:

```yaml
tunnel: <your-tunnel-id>
credentials-file: /home/luca/.cloudflared/<your-tunnel-id>.json

ingress:
  - hostname: lucid.yourdomain.com
    service: http://localhost:80
  - service: http_status:404
```

Start the tunnel:

```bash
cloudflared tunnel run lucid-finance
```

Create systemd service for the tunnel:

```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

Now you can access your app from anywhere at `https://lucid.yourdomain.com`

## Updating the Application

### From Your Mac

```bash
# Push changes to GitHub
git push

# Deploy to Pi
./deploy_to_pi.sh
```

### On the Pi

```bash
ssh luca@lucid-pi.local

cd ~/LUCID_Finance_WebApp
git pull
uv sync
cd frontend && npm install && npm run build && cd ..
sudo systemctl restart lucid-backend
```

## Monitoring & Maintenance

### View Logs

```bash
# Backend logs
ssh luca@lucid-pi.local 'sudo journalctl -u lucid-backend -f'

# nginx logs
ssh luca@lucid-pi.local 'sudo tail -f /var/log/nginx/error.log'

# Database logs
ssh luca@lucid-pi.local 'docker logs -f lucid_finance_db'
```

### Check Service Status

```bash
# Backend service
ssh luca@lucid-pi.local 'sudo systemctl status lucid-backend'

# Database
ssh luca@lucid-pi.local 'docker ps'

# nginx
ssh luca@lucid-pi.local 'sudo systemctl status nginx'
```

### Restart Services

```bash
# Restart backend
ssh luca@lucid-pi.local 'sudo systemctl restart lucid-backend'

# Restart database
ssh luca@lucid-pi.local 'docker restart lucid_finance_db'

# Restart nginx
ssh luca@lucid-pi.local 'sudo systemctl restart nginx'
```

### Database Backup

```bash
# Create backup
ssh luca@lucid-pi.local 'docker exec lucid_finance_db mysqldump -ulucid_user -p lucid_finance > ~/backup_$(date +%Y%m%d).sql'

# Download backup to Mac
scp luca@lucid-pi.local:~/backup_*.sql ~/Desktop/
```

### Monitor Resources

```bash
# System resources
ssh luca@lucid-pi.local 'htop'

# Docker stats
ssh luca@lucid-pi.local 'docker stats'

# Disk usage
ssh luca@lucid-pi.local 'df -h'

# Memory usage
ssh luca@lucid-pi.local 'free -h'
```

## Troubleshooting

### Backend Not Starting

```bash
# Check logs
ssh luca@lucid-pi.local 'sudo journalctl -u lucid-backend -n 100'

# Test manually
ssh luca@lucid-pi.local
cd ~/LUCID_Finance_WebApp
uv run uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
```

### Database Connection Failed

```bash
# Check if MySQL is running
ssh luca@lucid-pi.local 'docker ps | grep mysql'

# Restart database
ssh luca@lucid-pi.local 'docker restart lucid_finance_db'

# Check logs
ssh luca@lucid-pi.local 'docker logs lucid_finance_db'
```

### Can't Access Frontend

```bash
# Check nginx
ssh luca@lucid-pi.local 'sudo nginx -t'
ssh luca@lucid-pi.local 'sudo systemctl status nginx'

# Check if files exist
ssh luca@lucid-pi.local 'ls -la ~/LUCID_Finance_WebApp/frontend/dist'
```

### API Returns 502 Bad Gateway

This means nginx can't reach the backend:

```bash
# Check if backend is running
ssh luca@lucid-pi.local 'sudo systemctl status lucid-backend'

# Check if port 8000 is listening
ssh luca@lucid-pi.local 'sudo netstat -tlnp | grep 8000'

# Test API directly
ssh luca@lucid-pi.local 'curl http://localhost:8000/api/health'
```

## Performance Optimization

Since you have Log2Ram and zRAM configured, your Pi is already optimized for SD card longevity and memory usage.

Additional tips:

1. **Monitor Memory**: Keep an eye on memory with `free -h`
2. **Database Tuning**: If needed, adjust MySQL memory settings in `docker-compose.yml`
3. **Frontend Optimization**: The built frontend is already optimized with Vite
4. **Backend Workers**: For heavy usage, consider adding `--workers 2` to uvicorn command

## Security Checklist

- [ ] Changed default Pi password
- [ ] Using strong database passwords in `.env`
- [ ] Created admin user with strong password
- [ ] SSH key authentication enabled (optional but recommended)
- [ ] Firewall configured if exposing to internet
- [ ] Regular OS updates: `sudo apt update && sudo apt upgrade`
- [ ] Database backups scheduled
- [ ] HTTPS enabled (via Cloudflared or Let's Encrypt)

## Quick Commands Reference

```bash
# Deploy from Mac
./deploy_to_pi.sh

# SSH to Pi
ssh luca@lucid-pi.local

# Restart everything
ssh luca@lucid-pi.local 'sudo systemctl restart lucid-backend && docker restart lucid_finance_db && sudo systemctl restart nginx'

# View all logs
ssh luca@lucid-pi.local 'sudo journalctl -u lucid-backend -f'

# Database backup
ssh luca@lucid-pi.local 'docker exec lucid_finance_db mysqldump -ulucid_user -p lucid_finance > ~/backup.sql'

# Update application
ssh luca@lucid-pi.local 'cd ~/LUCID_Finance_WebApp && git pull && uv sync && cd frontend && npm run build && cd .. && sudo systemctl restart lucid-backend'
```

---

**Your LUCID Finance app is now running on your Raspberry Pi!** 🎉
