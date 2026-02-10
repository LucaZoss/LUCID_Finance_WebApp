#!/bin/bash
# ==============================================================================
# Install SD Card Optimizations on Raspberry Pi
# ==============================================================================
# Run this script on your Raspberry Pi to apply all SD card optimizations
# Usage: ./install_sd_optimizations.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}SD Card Optimization Setup${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""

# Check if running on Pi
if [ ! -f /home/luca/LUCID_Finance_WebApp/.env ]; then
    echo -e "${YELLOW}Error: This script must be run on the Raspberry Pi${NC}"
    exit 1
fi

cd /home/luca/LUCID_Finance_WebApp

# 1. Setup tmpfs for temporary files
echo -e "${YELLOW}Setting up tmpfs for temporary files...${NC}"
if ! grep -q "tmpfs /tmp tmpfs" /etc/fstab; then
    echo "tmpfs /tmp tmpfs defaults,noatime,nosuid,size=512M 0 0" | sudo tee -a /etc/fstab
    echo "tmpfs /var/tmp tmpfs defaults,noatime,nosuid,size=256M 0 0" | sudo tee -a /etc/fstab
    sudo mount -a
    echo -e "${GREEN}✓ tmpfs configured${NC}"
else
    echo -e "${GREEN}✓ tmpfs already configured${NC}"
fi
echo ""

# 2. Restart MySQL with optimized config
echo -e "${YELLOW}Applying MySQL optimizations...${NC}"
docker compose down
sleep 3
docker compose up -d
echo -e "${GREEN}✓ MySQL restarted with optimizations${NC}"
echo ""

# Wait for MySQL to be ready
echo "Waiting for MySQL to start..."
sleep 10

# Verify MySQL config
echo -e "${YELLOW}Verifying MySQL configuration...${NC}"
source <(grep DB_PASSWORD .env)
FLUSH_VALUE=$(docker exec lucid_finance_db mysql -uroot -p${DB_ROOT_PASSWORD} -e "SHOW VARIABLES LIKE 'innodb_flush_log_at_trx_commit';" 2>/dev/null | grep innodb | awk '{print $2}')
if [ "$FLUSH_VALUE" = "2" ]; then
    echo -e "${GREEN}✓ MySQL optimizations applied successfully${NC}"
else
    echo -e "${YELLOW}⚠ MySQL config may not be loaded. Check manually.${NC}"
fi
echo ""

# 3. Make scripts executable
echo -e "${YELLOW}Setting up maintenance scripts...${NC}"
chmod +x ~/LUCID_Finance_WebApp/scripts/pi/*.sh
echo -e "${GREEN}✓ Scripts made executable${NC}"
echo ""

# 4. Create backup directory
echo -e "${YELLOW}Creating backup directory...${NC}"
mkdir -p ~/backups
echo -e "${GREEN}✓ Backup directory created${NC}"
echo ""

# 5. Test backup
echo -e "${YELLOW}Testing backup script...${NC}"
if ~/LUCID_Finance_WebApp/scripts/pi/backup_lucid.sh; then
    echo -e "${GREEN}✓ Backup test successful${NC}"
else
    echo -e "${YELLOW}⚠ Backup test failed${NC}"
fi
echo ""

# 6. Setup cron jobs
echo -e "${YELLOW}Setting up automated tasks (cron)...${NC}"

# Check if cron jobs already exist
if ! crontab -l 2>/dev/null | grep -q "backup_lucid.sh"; then
    # Add cron jobs
    (crontab -l 2>/dev/null; echo "# LUCID Finance - Daily backup at 2 AM") | crontab -
    (crontab -l; echo "0 2 * * * /home/luca/LUCID_Finance_WebApp/scripts/pi/backup_lucid.sh >> /home/luca/backup.log 2>&1") | crontab -
    (crontab -l; echo "") | crontab -
    (crontab -l; echo "# LUCID Finance - Weekly health check (Monday 6 AM)") | crontab -
    (crontab -l; echo "0 6 * * 1 /home/luca/LUCID_Finance_WebApp/scripts/pi/monitor_disk.sh >> /home/luca/disk_health.log") | crontab -
    (crontab -l; echo "") | crontab -
    (crontab -l; echo "# LUCID Finance - Monthly maintenance (first Sunday 4 AM)") | crontab -
    (crontab -l; echo "0 4 1-7 * 0 /home/luca/LUCID_Finance_WebApp/scripts/pi/maintenance_lucid.sh >> /home/luca/maintenance.log 2>&1") | crontab -
    echo -e "${GREEN}✓ Cron jobs installed${NC}"
else
    echo -e "${GREEN}✓ Cron jobs already configured${NC}"
fi
echo ""

# 7. Show current cron jobs
echo -e "${YELLOW}Current scheduled tasks:${NC}"
crontab -l | grep -A1 "LUCID Finance" | sed 's/^/  /'
echo ""

# 8. Show disk status
echo -e "${YELLOW}Current disk usage:${NC}"
df -h / | tail -1 | awk '{print "  Total: " $2 "\n  Used:  " $3 " (" $5 ")\n  Free:  " $4}'
echo ""

# 9. Restart backend to ensure everything is working
echo -e "${YELLOW}Restarting backend service...${NC}"
sudo systemctl restart lucid-backend
sleep 3
if sudo systemctl is-active --quiet lucid-backend; then
    echo -e "${GREEN}✓ Backend service running${NC}"
else
    echo -e "${YELLOW}⚠ Backend service not running. Check logs: sudo journalctl -u lucid-backend -n 50${NC}"
fi
echo ""

echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}==================================${NC}"
echo ""
echo "Optimizations applied:"
echo "  ✓ tmpfs for /tmp and /var/tmp (reduces writes)"
echo "  ✓ MySQL configured for SD card longevity"
echo "  ✓ Daily automated backups (2 AM)"
echo "  ✓ Weekly disk health monitoring (Monday 6 AM)"
echo "  ✓ Monthly database maintenance (first Sunday 4 AM)"
echo ""
echo "Manual commands:"
echo "  Create backup:   ~/LUCID_Finance_WebApp/scripts/pi/backup_lucid.sh"
echo "  Run maintenance: ~/LUCID_Finance_WebApp/scripts/pi/maintenance_lucid.sh"
echo "  Check disk:      ~/LUCID_Finance_WebApp/scripts/pi/monitor_disk.sh"
echo ""
echo "Log files:"
echo "  Backups:     ~/backup.log"
echo "  Maintenance: ~/maintenance.log"
echo "  Disk health: ~/disk_health.log"
echo ""
