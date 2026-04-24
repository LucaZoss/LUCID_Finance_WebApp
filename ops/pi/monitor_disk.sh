#!/bin/bash
# ==============================================================================
# LUCID Finance - SD Card Health Monitor
# ==============================================================================
# Monitor SD card usage and health
# Run weekly via cron to track disk health
# Usage: ./monitor_disk.sh

echo "==================================="
echo "SD Card Health Report"
echo "==================================="
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Disk usage
echo "Disk Usage:"
df -h / | tail -1 | awk '{print "  Total: " $2 "\n  Used:  " $3 " (" $5 ")\n  Free:  " $4}'
echo ""

# Inode usage (can run out even with free space)
echo "Inode Usage:"
df -i / | tail -1 | awk '{print "  Total: " $2 "\n  Used:  " $3 " (" $5 ")\n  Free:  " $4}'
echo ""

# Top 10 largest directories in home
echo "Top 10 Largest Directories:"
du -sh /home/luca/* 2>/dev/null | sort -rh | head -10 | sed 's/^/  /'
echo ""

# MySQL data size
echo "MySQL Data Size:"
if docker ps | grep -q lucid_finance_db; then
    MYSQL_SIZE=$(docker exec lucid_finance_db du -sh /var/lib/mysql 2>/dev/null | cut -f1)
    echo "  $MYSQL_SIZE"
else
    echo "  MySQL container not running"
fi
echo ""

# Backup directory size
echo "Backup Directory:"
if [ -d "$HOME/backups" ]; then
    BACKUP_COUNT=$(ls -1 "$HOME/backups"/lucid_backup_*.sql.gz 2>/dev/null | wc -l)
    BACKUP_SIZE=$(du -sh "$HOME/backups" 2>/dev/null | cut -f1)
    echo "  Size: $BACKUP_SIZE"
    echo "  Files: $BACKUP_COUNT backups"
else
    echo "  No backups directory"
fi
echo ""

# Log sizes (if Log2Ram is working, this should be small)
echo "Log Directory Size:"
if [ -d "/var/log" ]; then
    LOG_SIZE=$(sudo du -sh /var/log 2>/dev/null | cut -f1)
    echo "  $LOG_SIZE"
else
    echo "  Cannot access /var/log"
fi
echo ""

# Docker system usage
echo "Docker System Usage:"
if command -v docker &> /dev/null; then
    docker system df 2>/dev/null | sed 's/^/  /'
fi
echo ""

# Memory usage
echo "Memory Usage:"
free -h | grep -E "Mem|Swap" | sed 's/^/  /'
echo ""

# SD Card write stats (estimate wear)
if [ -f /sys/block/mmcblk0/stat ]; then
    echo "SD Card Write Stats:"
    SECTORS=$(cat /sys/block/mmcblk0/stat | awk '{print $7}')
    # Assuming 512 bytes per sector
    BYTES=$((SECTORS * 512))
    GB=$((BYTES / 1024 / 1024 / 1024))
    echo "  Total writes: $GB GB"
fi
echo ""

# System temperature
if command -v vcgencmd &> /dev/null; then
    echo "System Temperature:"
    TEMP=$(vcgencmd measure_temp | cut -d= -f2)
    echo "  $TEMP"
fi
echo ""

# System uptime
echo "System Uptime:"
uptime | sed 's/^/  /'
echo ""

# Service status
echo "Service Status:"
for service in lucid-backend cloudflared nginx docker; do
    if systemctl is-active --quiet $service 2>/dev/null; then
        echo "  $service: running"
    else
        echo "  $service: NOT RUNNING"
    fi
done
echo ""

echo "==================================="
echo "Report Complete"
echo "==================================="
