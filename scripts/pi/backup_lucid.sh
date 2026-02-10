#!/bin/bash
# ==============================================================================
# LUCID Finance - Automated Database Backup with Rotation
# ==============================================================================
# This script should be run on the Raspberry Pi via cron
# Usage: ./backup_lucid.sh

set -e

# Configuration
BACKUP_DIR="$HOME/backups"
DB_NAME="lucid_finance"
DB_USER="lucid_user"
DB_CONTAINER="lucid_finance_db"
RETENTION_DAYS=14  # Keep backups for 14 days
MAX_BACKUPS=30     # Keep maximum 30 backups

# Load database password from .env
if [ -f "$HOME/LUCID_Finance_WebApp/.env" ]; then
    source <(grep DB_PASSWORD "$HOME/LUCID_Finance_WebApp/.env")
else
    echo "Error: .env file not found"
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
BACKUP_FILE="$BACKUP_DIR/lucid_backup_$(date +%Y%m%d_%H%M%S).sql"

# Create backup
echo "$(date '+%Y-%m-%d %H:%M:%S') - Creating backup: $BACKUP_FILE"
docker exec "$DB_CONTAINER" mysqldump \
    -u"$DB_USER" \
    -p"$DB_PASSWORD" \
    --single-transaction \
    --quick \
    --lock-tables=false \
    "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null

if [ $? -ne 0 ]; then
    echo "Error: Backup failed"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Compress backup
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Get file size
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "$(date '+%Y-%m-%d %H:%M:%S') - Backup created: $BACKUP_FILE ($SIZE)"

# Delete old backups (older than RETENTION_DAYS)
OLD_COUNT=$(find "$BACKUP_DIR" -name "lucid_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS | wc -l)
if [ "$OLD_COUNT" -gt 0 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Cleaning up $OLD_COUNT old backups..."
    find "$BACKUP_DIR" -name "lucid_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
fi

# Keep only MAX_BACKUPS most recent files
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/lucid_backup_*.sql.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    EXCESS=$((BACKUP_COUNT - MAX_BACKUPS))
    ls -1t "$BACKUP_DIR"/lucid_backup_*.sql.gz | tail -n "$EXCESS" | xargs rm -f
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Removed $EXCESS old backups (kept $MAX_BACKUPS most recent)"
fi

# Show current backup count
FINAL_COUNT=$(ls -1 "$BACKUP_DIR"/lucid_backup_*.sql.gz 2>/dev/null | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "$(date '+%Y-%m-%d %H:%M:%S') - Total backups: $FINAL_COUNT ($TOTAL_SIZE)"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Backup completed successfully!"
