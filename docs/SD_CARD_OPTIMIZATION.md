# SD Card Optimization & MySQL Maintenance for Raspberry Pi

You've already installed Log2Ram and zRAM - excellent! Here are additional optimizations for your production server.

## Current Protection (Already Installed)

✅ **Log2Ram**: Moves `/var/log` to RAM, writes to SD card periodically
✅ **zRAM**: Compressed swap in RAM (reduces SD card swap usage)

## Additional MySQL Optimizations

### 1. MySQL Configuration for Reduced Writes

Your MySQL is running in Docker. Create a custom configuration to reduce SD card writes:

```bash
# SSH to your Pi
ssh luca@lucid-pi.local

# Create MySQL config directory
mkdir -p ~/LUCID_Finance_WebApp/mysql-config

# Create optimized MySQL config
cat > ~/LUCID_Finance_WebApp/mysql-config/optimized.cnf << 'EOF'
[mysqld]
# ====================
# SD Card Optimizations
# ====================

# Reduce binary logging (you don't need replication)
skip-log-bin

# Disable general query log (only use for debugging)
general_log = 0

# Keep slow query log but with higher threshold
slow_query_log = 1
long_query_time = 5

# InnoDB optimizations for SD card
innodb_flush_log_at_trx_commit = 2  # Flush every second instead of every transaction
innodb_flush_method = O_DIRECT      # Bypass OS cache
innodb_io_capacity = 200            # Lower for SD card (default is 200)
innodb_io_capacity_max = 400        # Max burst writes

# Buffer pool (adjust based on your Pi's RAM - this is for 4GB+ Pi)
innodb_buffer_pool_size = 256M      # Cache frequently used data in RAM

# Reduce write frequency
innodb_log_file_size = 64M
innodb_log_buffer_size = 16M

# Reduce checkpoint frequency
innodb_flush_neighbors = 0          # Good for SSDs/SD cards (random access)

# Connection limits (your app doesn't need many)
max_connections = 50

# Query cache (deprecated in MySQL 8.0, but useful if on 5.7)
# query_cache_type = 1
# query_cache_size = 32M

# Temp tables in RAM when possible
tmp_table_size = 32M
max_heap_table_size = 32M

# Reduce monitoring overhead
performance_schema = OFF
EOF
```

### 2. Update Docker Compose to Use Custom Config

```bash
# Edit docker-compose.yml
nano ~/LUCID_Finance_WebApp/docker-compose.yml
```

Add the volume mount for the custom config:

```yaml
services:
  db:
    image: mysql:8.0
    container_name: lucid_finance_db
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./mysql-config:/etc/mysql/conf.d  # Add this line
    command: --default-authentication-plugin=mysql_native_password

volumes:
  mysql_data:
```

### 3. Apply the Configuration

```bash
# Restart MySQL with new config
cd ~/LUCID_Finance_WebApp
docker compose down
docker compose up -d

# Wait for MySQL to start
sleep 10

# Verify configuration is loaded
docker exec lucid_finance_db mysql -uroot -p${DB_ROOT_PASSWORD} -e "SHOW VARIABLES LIKE 'innodb_flush_log_at_trx_commit';"
```

## Temporary Files in RAM (tmpfs)

MySQL and your app generate temporary files. Move them to RAM:

### 1. Configure tmpfs for MySQL Temp

```bash
# Edit fstab
sudo nano /etc/fstab

# Add this line (if not already present)
tmpfs /tmp tmpfs defaults,noatime,nosuid,size=512M 0 0
tmpfs /var/tmp tmpfs defaults,noatime,nosuid,size=256M 0 0
```

### 2. Mount tmpfs

```bash
sudo mount -a

# Verify
df -h | grep tmpfs
```

## Automated Database Backups with Rotation

### 1. Create Backup Script on Pi

```bash
ssh luca@lucid-pi.local

# Create backup script
cat > ~/backup_lucid.sh << 'EOF'
#!/bin/bash
# ==============================================================================
# LUCID Finance - Automated Database Backup with Rotation
# ==============================================================================

set -e

# Configuration
BACKUP_DIR="$HOME/backups"
DB_NAME="lucid_finance"
DB_USER="lucid_user"
DB_PASSWORD="lucid_pass_2025"  # Read from .env in production
RETENTION_DAYS=14  # Keep backups for 14 days
MAX_BACKUPS=30     # Keep maximum 30 backups

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
BACKUP_FILE="$BACKUP_DIR/lucid_backup_$(date +%Y%m%d_%H%M%S).sql"

# Create backup
echo "Creating backup: $BACKUP_FILE"
docker exec lucid_finance_db mysqldump \
    -u"$DB_USER" \
    -p"$DB_PASSWORD" \
    --single-transaction \
    --quick \
    --lock-tables=false \
    "$DB_NAME" > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Get file size
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup created: $BACKUP_FILE ($SIZE)"

# Delete old backups (older than RETENTION_DAYS)
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "lucid_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# Keep only MAX_BACKUPS most recent files
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/lucid_backup_*.sql.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    EXCESS=$((BACKUP_COUNT - MAX_BACKUPS))
    ls -1t "$BACKUP_DIR"/lucid_backup_*.sql.gz | tail -n "$EXCESS" | xargs rm -f
    echo "Removed $EXCESS old backups (kept $MAX_BACKUPS most recent)"
fi

# List current backups
echo "Current backups:"
ls -lh "$BACKUP_DIR"/lucid_backup_*.sql.gz | tail -5

echo "Backup completed successfully!"
EOF

# Make executable
chmod +x ~/backup_lucid.sh
```

### 2. Test the Backup Script

```bash
./backup_lucid.sh
```

### 3. Schedule Daily Backups with Cron

```bash
# Edit crontab
crontab -e

# Add this line (backup daily at 2 AM)
0 2 * * * /home/luca/backup_lucid.sh >> /home/luca/backup.log 2>&1
```

### 4. Weekly Backup to External Storage

If you have external storage (USB drive), add weekly backups:

```bash
# Add to crontab (every Sunday at 3 AM)
0 3 * * 0 rsync -av /home/luca/backups/ /mnt/usb/lucid_backups/
```

## Database Maintenance Tasks

### 1. Weekly Table Optimization

```bash
# Create maintenance script
cat > ~/maintenance_lucid.sh << 'EOF'
#!/bin/bash
# ==============================================================================
# LUCID Finance - Database Maintenance
# ==============================================================================

set -e

echo "Running database maintenance..."

# Optimize all tables (reduces fragmentation)
docker exec lucid_finance_db mysql -ulucid_user -plucid_pass_2025 lucid_finance -e "
    OPTIMIZE TABLE transactions;
    OPTIMIZE TABLE users;
    OPTIMIZE TABLE budget_plans;
    OPTIMIZE TABLE categories;
    OPTIMIZE TABLE categorization_rules;
    OPTIMIZE TABLE processed_files;
"

echo "Database optimization completed!"

# Show table sizes
docker exec lucid_finance_db mysql -ulucid_user -plucid_pass_2025 lucid_finance -e "
    SELECT
        table_name AS 'Table',
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
    FROM information_schema.TABLES
    WHERE table_schema = 'lucid_finance'
    ORDER BY (data_length + index_length) DESC;
"
EOF

chmod +x ~/maintenance_lucid.sh

# Schedule monthly (first Sunday of each month at 4 AM)
crontab -e
# Add: 0 4 1-7 * 0 /home/luca/maintenance_lucid.sh >> /home/luca/maintenance.log 2>&1
```

## Disk Health Monitoring

### 1. Create Monitoring Script

```bash
cat > ~/monitor_disk.sh << 'EOF'
#!/bin/bash
# ==============================================================================
# SD Card Health Monitor
# ==============================================================================

echo "=== SD Card Health Report ==="
echo "Date: $(date)"
echo ""

# Disk usage
echo "Disk Usage:"
df -h / | tail -1 | awk '{print "  Used: " $3 " / " $2 " (" $5 ")"}'
echo ""

# Inode usage (can run out even with free space)
echo "Inode Usage:"
df -i / | tail -1 | awk '{print "  Used: " $3 " / " $2 " (" $5 ")"}'
echo ""

# Top 10 largest directories
echo "Top 10 Largest Directories:"
du -h /home/luca 2>/dev/null | sort -rh | head -10
echo ""

# MySQL data size
echo "MySQL Data Size:"
docker exec lucid_finance_db du -sh /var/lib/mysql 2>/dev/null || echo "  MySQL not running"
echo ""

# Log sizes
echo "Log Sizes:"
sudo du -sh /var/log 2>/dev/null || echo "  Cannot access /var/log"
echo ""

# Write count (estimate SD card wear)
if [ -f /sys/block/mmcblk0/stat ]; then
    echo "SD Card Write Stats:"
    cat /sys/block/mmcblk0/stat | awk '{print "  Writes: " $7 " sectors"}'
fi
echo ""

# Temperature (high temps can indicate issues)
if command -v vcgencmd &> /dev/null; then
    echo "System Temperature:"
    vcgencmd measure_temp
fi

echo "==================================="
EOF

chmod +x ~/monitor_disk.sh
```

### 2. Run Weekly Health Check

```bash
# Add to crontab (every Monday at 6 AM)
crontab -e
# Add: 0 6 * * 1 /home/luca/monitor_disk.sh | mail -s "Pi Health Report" your@email.com
# Or just log it: 0 6 * * 1 /home/luca/monitor_disk.sh >> /home/luca/disk_health.log
```

## Emergency: SD Card Full

If your SD card fills up:

```bash
# 1. Check what's using space
sudo du -sh /* | sort -rh | head -10

# 2. Clean up old logs (if Log2Ram fails)
sudo journalctl --vacuum-time=7d

# 3. Clean up Docker
docker system prune -a --volumes

# 4. Remove old backups
rm ~/backups/lucid_backup_$(date -d '30 days ago' +%Y)*.sql.gz

# 5. Check MySQL binary logs (if enabled)
docker exec lucid_finance_db mysql -uroot -p -e "PURGE BINARY LOGS BEFORE NOW();"
```

## Quick Reference

### Check Current Disk Usage

```bash
# Overall disk usage
df -h

# MySQL data size
docker exec lucid_finance_db du -sh /var/lib/mysql

# Backup directory size
du -sh ~/backups

# Log size
sudo du -sh /var/log
```

### Manual Database Backup

```bash
# Quick backup
~/backup_lucid.sh

# Or manually
docker exec lucid_finance_db mysqldump -ulucid_user -plucid_pass_2025 lucid_finance | gzip > ~/manual_backup_$(date +%Y%m%d).sql.gz
```

### Restore from Backup

```bash
# Decompress and restore
gunzip -c ~/backups/lucid_backup_YYYYMMDD_HHMMSS.sql.gz | docker exec -i lucid_finance_db mysql -ulucid_user -plucid_pass_2025 lucid_finance
```

## Expected Disk Usage

For reference, here's typical usage:

| Component | Size | Notes |
|-----------|------|-------|
| MySQL Data | 50-200 MB | Depends on transaction history |
| Backups (14 days) | 200-500 MB | Compressed SQL dumps |
| Application Code | 50-100 MB | Frontend + backend |
| Docker Images | 500-800 MB | MySQL + system |
| Logs (Log2Ram) | 50 MB | In RAM, periodic writes |
| **Total** | ~1-2 GB | Leaves plenty of room on 32GB+ SD card |

## Best Practices

1. **Use a quality SD card**: Samsung EVO or SanDisk Extreme (not cheap no-name cards)
2. **Use 64GB+ card**: Gives you plenty of headroom
3. **Monitor regularly**: Run health checks monthly
4. **Keep backups external**: USB drive or cloud storage
5. **Consider SSD upgrade**: Use USB3 SSD boot for ultimate durability (Raspberry Pi 4 supports this)
6. **Update regularly**: Keep your Pi OS and Docker up to date

## If You Want Even More Durability

### Option 1: Boot from SSD (Recommended)

Raspberry Pi 4/5 can boot from USB SSD:

1. Get a USB 3.0 SSD (128GB+)
2. Clone your SD card to SSD
3. Boot from SSD (way faster + more durable)
4. ~$30-40 for massive improvement

### Option 2: Read-Only Root Filesystem

Advanced: Make root filesystem read-only, only /home writable. Complex but very durable.

### Option 3: Cloud Backup Integration

Sync backups to cloud storage:

```bash
# Install rclone
sudo apt install rclone

# Configure (Google Drive, Dropbox, etc)
rclone config

# Add to backup script
rclone copy ~/backups remote:lucid_backups
```

---

**Your current setup with Log2Ram + zRAM + these optimizations should give you years of reliable service!**
