# Deploy to Raspberry Pi

Step-by-step guide to host LUCID Finance on your Raspberry Pi.

## Prerequisites

- Raspberry Pi 4 (2GB+ RAM recommended)
- Raspberry Pi OS (64-bit recommended)
- SSH access to your Pi
- Static IP or DHCP reservation for Pi
- GitHub account (for code transfer)

---

## Step 1: Prepare Raspberry Pi

### 1.1 Update System
```bash
ssh pi@raspberrypi.local

sudo apt update
sudo apt upgrade -y
sudo reboot
```

### 1.2 Install Docker
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Enable Docker on boot
sudo systemctl enable docker

# Logout and login for group changes
exit
ssh pi@raspberrypi.local

# Verify
docker --version
docker ps
```

### 1.3 Install Python 3.12
```bash
sudo apt install -y python3 python3-pip python3-venv
python3 --version
```

### 1.4 Install uv (Python package manager)
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.cargo/env
uv --version
```

### 1.5 Install Node.js 18+
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

---

## Step 2: Deploy Application

### 2.1 Clone Repository
```bash
cd ~
git clone https://github.com/yourusername/LUCID_Finance_WebApp.git
cd LUCID_Finance_WebApp
```

**Alternative:** Use SCP if not using Git
```bash
# From your Mac
scp -r /path/to/LUCID_Finance_WebApp pi@raspberrypi.local:~/
```

### 2.2 Setup Environment
```bash
# Copy environment template
cp .env.example .env

# Edit with production values
nano .env
```

Update `.env`:
```bash
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=lucid_finance
DB_USER=lucid_user
DB_PASSWORD=your_secure_password_here

# API (optional)
API_HOST=0.0.0.0
API_PORT=8000
```

### 2.3 Start MySQL Database
```bash
# Start MySQL container
docker compose up -d

# Verify it's running
docker ps

# Wait for MySQL to initialize (first time)
sleep 10

# Test connection
docker exec -it lucid_finance_db mysql -ulucid_user -p
# Enter password, then: SHOW DATABASES; EXIT;
```

### 2.4 Install Backend Dependencies
```bash
# Install Python dependencies
uv sync

# Verify
uv run python -c "import fastapi; print('FastAPI installed')"
```

### 2.5 Build Frontend
```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

cd ..
```

Frontend will be built to `frontend/dist/`

---

## Step 3: Setup as System Services

### 3.1 Create Backend Service

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
User=pi
WorkingDirectory=/home/pi/LUCID_Finance_WebApp
Environment="PATH=/home/pi/.cargo/bin:/home/pi/.local/bin:/usr/bin"
ExecStartPre=/bin/sleep 5
ExecStart=/home/pi/.cargo/bin/uv run uvicorn src.api.main:app --host 0.0.0.0 --port 8000
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

Check logs:
```bash
sudo journalctl -u lucid-backend -f
```

---

## Step 4: Setup Web Server (nginx)

### 4.1 Install nginx
```bash
sudo apt install -y nginx
```

### 4.2 Configure nginx
```bash
sudo nano /etc/nginx/sites-available/lucid-finance
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name _;  # Or your Pi's IP/hostname

    # Frontend - serve static files
    location / {
        root /home/pi/LUCID_Finance_WebApp/frontend/dist;
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

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/lucid-finance /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## Step 5: Initial Data Load (Optional)

### 5.1 Upload CSV Files
```bash
# From your Mac, copy CSV files
scp /path/to/your/csvs/*.csv pi@raspberrypi.local:~/LUCID_Finance_WebApp/raw_data/
```

### 5.2 Process CSV Files
```bash
cd ~/LUCID_Finance_WebApp
uv run python -m src.data_pipeline.pipeline raw_data --output output
```

---

## Step 6: Access Your Application

### 6.1 Find Pi IP Address
```bash
hostname -I
# Example output: 192.168.1.100
```

### 6.2 Access from Browser
Open browser on any device in your network:
- **Application**: `http://192.168.1.100`
- **API Docs**: `http://192.168.1.100/api/docs`

### 6.3 Test Everything
```bash
# From your Mac or any device
curl http://192.168.1.100/api/health

# Should return: {"status":"healthy","timestamp":"..."}
```

---

## Step 7: Maintenance & Updates

### 7.1 Update Application
```bash
cd ~/LUCID_Finance_WebApp

# Pull latest changes
git pull

# Update backend dependencies
uv sync

# Rebuild frontend
cd frontend
npm install
npm run build
cd ..

# Restart services
sudo systemctl restart lucid-backend
sudo systemctl restart nginx
```

### 7.2 View Logs
```bash
# Backend logs
sudo journalctl -u lucid-backend -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Docker logs
docker logs -f lucid_finance_db
```

### 7.3 Backup Database
```bash
# Create backup
docker exec lucid_finance_db mysqldump -ulucid_user -p lucid_finance > backup_$(date +%Y%m%d).sql

# Restore backup
docker exec -i lucid_finance_db mysql -ulucid_user -p lucid_finance < backup_20260206.sql
```

### 7.4 Monitor Resources
```bash
# System resources
htop

# Docker stats
docker stats

# Disk usage
df -h
```

---

## Troubleshooting

### Backend won't start
```bash
# Check service status
sudo systemctl status lucid-backend

# Check logs
sudo journalctl -u lucid-backend -n 50

# Test manually
cd ~/LUCID_Finance_WebApp
uv run uvicorn src.api.main:app --host 0.0.0.0 --port 8000
```

### Database connection issues
```bash
# Check MySQL is running
docker ps | grep mysql

# Restart MySQL
docker restart lucid_finance_db

# Check connection
docker exec -it lucid_finance_db mysql -ulucid_user -p
```

### nginx issues
```bash
# Test configuration
sudo nginx -t

# Check logs
sudo tail -f /var/log/nginx/error.log

# Restart nginx
sudo systemctl restart nginx
```

### Can't access from network
```bash
# Check firewall (usually not enabled on Raspberry Pi OS)
sudo ufw status

# If enabled, allow HTTP
sudo ufw allow 80/tcp

# Check nginx is listening
sudo netstat -tlnp | grep :80
```

### Out of memory
```bash
# Check memory
free -h

# Restart services to free memory
sudo systemctl restart lucid-backend
docker restart lucid_finance_db
```

---

## Optional Enhancements

### Setup HTTPS with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Setup Dynamic DNS (if needed)
Use No-IP, DuckDNS, or similar service if you don't have a static IP

### Auto-restart on crash
Services already configured with `Restart=always`

### Schedule backups
```bash
# Add to crontab
crontab -e

# Add this line (daily backup at 2 AM)
0 2 * * * docker exec lucid_finance_db mysqldump -ulucid_user -pYOUR_PASSWORD lucid_finance > /home/pi/backups/lucid_$(date +\%Y\%m\%d).sql
```

---

## Performance Tips

1. **Use 64-bit OS** - Better performance on Pi 4
2. **Increase swap** - If you have < 4GB RAM
3. **Use SSD** - Boot from USB SSD instead of SD card
4. **Disable unnecessary services** - Free up RAM
5. **Monitor regularly** - Check `htop` and `docker stats`

---

## Network Access

### Local Network Only (Default)
- Access via `http://192.168.1.100`
- Only devices on your LAN can access

### Internet Access (Advanced)
1. Setup port forwarding on router (port 80 → Pi's IP)
2. Use Dynamic DNS service
3. **Security**: Add authentication, use HTTPS
4. Consider VPN instead for secure remote access

---

## Security Checklist

- [ ] Changed default Pi password
- [ ] Using strong MySQL password
- [ ] Firewall configured (if exposed to internet)
- [ ] Regular OS updates
- [ ] Database backups scheduled
- [ ] HTTPS enabled (if internet-facing)
- [ ] `.env` file has secure passwords

---

## Quick Reference

```bash
# Start/Stop/Restart services
sudo systemctl start lucid-backend
sudo systemctl stop lucid-backend
sudo systemctl restart lucid-backend

# View logs
sudo journalctl -u lucid-backend -f

# Database access
docker exec -it lucid_finance_db mysql -ulucid_user -p

# Update app
cd ~/LUCID_Finance_WebApp && git pull && uv sync
cd frontend && npm run build && cd ..
sudo systemctl restart lucid-backend

# Backup database
docker exec lucid_finance_db mysqldump -ulucid_user -p lucid_finance > backup.sql
```

---

**Your LUCID Finance app is now running on your Raspberry Pi!** 🎉

Access it at: `http://YOUR_PI_IP` (e.g., `http://192.168.1.100`)
