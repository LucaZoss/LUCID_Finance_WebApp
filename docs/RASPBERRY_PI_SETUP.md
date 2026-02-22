# LUCID Finance - Raspberry Pi Setup & Optimizations

**Production environment on Raspberry Pi 4/5**

Complete setup guide and optimizations implemented for LUCID Finance on Raspberry Pi.

---

## Hardware Requirements

| Component | Specification | Notes |
|-----------|---------------|-------|
| **Raspberry Pi** | Pi 4 or Pi 5 | 4GB+ RAM recommended |
| **SD Card** | 64GB+ (Class 10/U3) | Samsung EVO or SanDisk Extreme |
| **Power Supply** | Official Pi Power Supply | 5V 3A minimum |
| **Network** | Ethernet or WiFi | Ethernet recommended for stability |
| **Optional** | USB 3.0 SSD (128GB+) | For better durability/performance |

---

## SD Card Optimizations (Already Implemented)

### 1. Log2Ram ✅

**What it does:** Moves `/var/log` to RAM, reduces SD card writes

**Installed:** Yes
**Configuration:** `/etc/log2ram.conf`

```bash
# Check status
sudo systemctl status log2ram

# View logs in RAM
ls -lh /var/log

# Force sync to disk
sudo systemctl reload log2ram
```

**Benefits:**
- Reduces SD card wear by ~80%
- Logs are synced to SD card periodically (hourly)
- Logs persist across reboots

---

### 2. zRAM ✅

**What it does:** Compressed swap in RAM (reduces SD card swap usage)

**Installed:** Yes

```bash
# Check zRAM status
zramctl

# Expected output:
# NAME       ALGORITHM DISKSIZE DATA COMPR TOTAL STREAMS MOUNTPOINT
# /dev/zram0 lz4            XG   XM    XM    XM       4 [SWAP]
```

**Benefits:**
- Faster swap performance
- No SD card writes for swap
- Compressed memory extends available RAM

---

### 3. tmpfs for Temporary Files ✅

**What it does:** `/tmp` and `/var/tmp` stored in RAM

**Configuration:** `/etc/fstab`

```bash
tmpfs /tmp tmpfs defaults,noatime,nosuid,size=512M 0 0
tmpfs /var/tmp tmpfs defaults,noatime,nosuid,size=256M 0 0
```

**Verify:**
```bash
df -h | grep tmpfs
```

**Benefits:**
- Fast temporary file access
- No SD card wear from temp files
- Auto-cleared on reboot

---

### 4. MySQL Optimizations ✅

**Custom Config:** `~/LUCID_Finance_WebApp/mysql-config/optimized.cnf`

**Key Settings:**
```ini
[mysqld]
# Disable binary logging (no replication needed)
skip-log-bin

# Flush log every second instead of every transaction
innodb_flush_log_at_trx_commit = 2

# Buffer pool (cache in RAM)
innodb_buffer_pool_size = 256M

# Lower I/O capacity for SD card
innodb_io_capacity = 200
innodb_io_capacity_max = 400

# Reduce monitoring overhead
performance_schema = OFF

# Connection limits
max_connections = 50
```

**Mounted in Docker:** `docker-compose.yml`

```yaml
volumes:
  - mysql_data:/var/lib/mysql
  - ./mysql-config:/etc/mysql/conf.d
```

**Verify:**
```bash
docker exec lucid_finance_db mysql -uroot -p -e "SHOW VARIABLES LIKE 'innodb_flush_log_at_trx_commit';"
# Should show: 2
```

---

## System Services

### Backend Service (systemd)

**File:** `/etc/systemd/system/lucid-backend.service`

```ini
[Unit]
Description=LUCID Finance Backend API
After=network.target docker.service

[Service]
Type=simple
User=luca
WorkingDirectory=/home/luca/LUCID_Finance_WebApp
ExecStartPre=/bin/sleep 5
ExecStart=/home/luca/.local/bin/uv run uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Management:**
```bash
sudo systemctl start lucid-backend
sudo systemctl stop lucid-backend
sudo systemctl restart lucid-backend
sudo systemctl status lucid-backend
sudo systemctl enable lucid-backend  # Auto-start on boot
```

---

### Cloudflare Tunnel Service

**Installed:** `/etc/systemd/system/cloudflared.service`

**Configuration:** `~/.cloudflared/config.yml`

```yaml
tunnel: <TUNNEL-ID>
credentials-file: /home/luca/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: lucid-finance.cc
    service: http://localhost:80
  - hostname: www.lucid-finance.cc
    service: http://localhost:80
  - service: http_status:404
```

**Management:**
```bash
sudo systemctl start cloudflared
sudo systemctl restart cloudflared
sudo systemctl status cloudflared

# View logs
sudo journalctl -u cloudflared -f
```

---

### Nginx

**Configuration:** `/etc/nginx/sites-available/lucid-finance`

```nginx
server {
    listen 80;
    server_name lucid-finance.cc www.lucid-finance.cc localhost _;

    # Frontend
    location / {
        root /home/luca/LUCID_Finance_WebApp/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**Management:**
```bash
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
sudo systemctl status nginx
```

---

## Automated Maintenance

### Daily Database Backup ✅

**Script:** `~/backup_lucid.sh`

**Scheduled:** Cron job at 2 AM daily

```bash
# View cron jobs
crontab -l

# Expected entry:
0 2 * * * /home/luca/backup_lucid.sh >> /home/luca/backup.log 2>&1
```

**Features:**
- Compressed SQL dumps (`.sql.gz`)
- Automatic rotation (14 days retention)
- Max 30 backups kept

**Manual backup:**
```bash
~/backup_lucid.sh
```

---

### Monthly Table Optimization

**Script:** `~/maintenance_lucid.sh`

**Scheduled:** First Sunday of month at 4 AM

```bash
# Cron entry:
0 4 1-7 * 0 /home/luca/maintenance_lucid.sh >> /home/luca/maintenance.log 2>&1
```

**What it does:**
- Optimizes MySQL tables (reduces fragmentation)
- Shows table sizes
- Logs results

---

### Weekly Health Monitoring

**Script:** `~/monitor_disk.sh`

**Checks:**
- Disk usage
- Inode usage
- MySQL data size
- Log sizes
- SD card write stats
- System temperature

**Run manually:**
```bash
~/monitor_disk.sh
```

---

## Performance Monitoring

### Resource Usage

```bash
# CPU and memory
htop

# Disk space
df -h

# MySQL data size
docker exec lucid_finance_db du -sh /var/lib/mysql

# Service status
systemctl is-active lucid-backend nginx cloudflared

# Temperature
vcgencmd measure_temp
```

### Expected Resource Usage

| Resource | Typical Usage | Notes |
|----------|---------------|-------|
| **CPU** | 5-15% idle, 30-50% active | Spikes during file uploads |
| **RAM** | 1.5-2.5 GB / 4 GB | MySQL uses ~300-500 MB |
| **Disk** | 1-2 GB total | Database ~50-200 MB |
| **Temperature** | 40-55°C | 60°C+ needs cooling review |

---

## Network Configuration

### Static IP (Optional but Recommended)

**Edit:** `/etc/dhcpcd.conf`

```bash
# Add at end:
interface eth0
static ip_address=192.168.0.100/24
static routers=192.168.0.1
static domain_name_servers=1.1.1.1 8.8.8.8
```

**Apply:**
```bash
sudo systemctl restart dhcpcd
```

---

### Firewall (ufw)

```bash
# Install (if not already)
sudo apt install ufw

# Allow SSH (important!)
sudo ufw allow 22/tcp

# Allow local web access
sudo ufw allow from 192.168.0.0/24 to any port 80

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

**Note:** Cloudflare Tunnel handles external access, so we only allow local access to port 80.

---

## Troubleshooting

### Pi Slow or Unresponsive

```bash
# Check CPU usage
top

# Check memory
free -h

# Check disk space
df -h

# Check temperature
vcgencmd measure_temp
# If >60°C, add cooling (heatsink, fan)
```

### SD Card Full

```bash
# Find large directories
sudo du -sh /* | sort -rh | head -10

# Clean up:
# 1. Old logs (if Log2Ram fails)
sudo journalctl --vacuum-time=7d

# 2. Docker cleanup
docker system prune -a

# 3. Old backups
rm ~/backups/lucid_backup_$(date -d '30 days ago' +%Y)*.sql.gz
```

### Services Not Starting on Boot

```bash
# Check service status
sudo systemctl status lucid-backend

# Enable auto-start
sudo systemctl enable lucid-backend
sudo systemctl enable nginx
sudo systemctl enable cloudflared

# Verify enabled
systemctl list-unit-files | grep enabled | grep lucid
```

---

## Upgrade Path: USB SSD Boot (Recommended)

For **ultimate performance and durability**, boot from USB SSD instead of SD card.

### Benefits
- **10x faster** read/write speeds
- **100x longer lifespan** than SD card
- **More reliable** for 24/7 operation
- **Costs ~$30-40** for 128GB SSD

### Quick Steps

1. Get USB 3.0 SSD (Samsung T7, SanDisk Extreme, etc.)
2. Clone SD card to SSD: `sudo dd if=/dev/mmcblk0 of=/dev/sda bs=4M status=progress`
3. Update bootloader: `sudo raspi-config` → Advanced → Boot Order → USB
4. Reboot from SSD
5. Keep SD card as backup!

---

## Quick Reference Commands

```bash
# Service management
sudo systemctl restart lucid-backend nginx cloudflared

# View logs
sudo journalctl -u lucid-backend -f

# Backup database
~/backup_lucid.sh

# Check disk space
df -h

# Check temperature
vcgencmd measure_temp

# Monitor resources
htop

# Test local access
curl http://localhost:80

# Health check
systemctl is-active lucid-backend nginx cloudflared && echo "✓ All services running"
```

---

## Security Best Practices

1. **Change default passwords** - Update MySQL root password, user passwords
2. **Keep system updated** - `sudo apt update && sudo apt upgrade` monthly
3. **Monitor logs** - Check `sudo journalctl -u lucid-backend` regularly
4. **Firewall enabled** - ufw active and configured
5. **SSH key authentication** - Disable password SSH (use keys)
6. **Regular backups** - Verify daily backups are working

---

## Maintenance Schedule

| Task | Frequency | Script/Command |
|------|-----------|----------------|
| Database backup | Daily (2 AM) | `~/backup_lucid.sh` |
| Table optimization | Monthly | `~/maintenance_lucid.sh` |
| Disk health check | Weekly | `~/monitor_disk.sh` |
| System updates | Monthly | `sudo apt update && apt upgrade` |
| Backup verification | Monthly | Test restore from backup |
| Review logs | Weekly | `sudo journalctl -u lucid-backend` |

---

**Your Raspberry Pi is optimized for 24/7 LUCID Finance operation!** 🚀

With Log2Ram, zRAM, optimized MySQL, and automated backups, your SD card should last years of continuous use.

---

**See Also:**
- [ARCHITECTURE.md](ARCHITECTURE.md) - Full system architecture
- [DATABASE.md](DATABASE.md) - Database management
- [QUICK_START_TECHNICAL.md](QUICK_START_TECHNICAL.md) - Common operations
