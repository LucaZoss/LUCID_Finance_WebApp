#!/bin/bash
# ==============================================================================
# LUCID Finance - Database Maintenance
# ==============================================================================
# This script optimizes database tables to reduce fragmentation
# Run monthly via cron
# Usage: ./maintenance_lucid.sh

set -e

DB_NAME="lucid_finance"
DB_USER="lucid_user"
DB_CONTAINER="lucid_finance_db"

# Load database password from .env
if [ -f "$HOME/LUCID_Finance_WebApp/.env" ]; then
    source <(grep DB_PASSWORD "$HOME/LUCID_Finance_WebApp/.env")
else
    echo "Error: .env file not found"
    exit 1
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting database maintenance..."

# Optimize all tables (reduces fragmentation)
echo "$(date '+%Y-%m-%d %H:%M:%S') - Optimizing tables..."
docker exec "$DB_CONTAINER" mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
    OPTIMIZE TABLE transactions;
    OPTIMIZE TABLE users;
    OPTIMIZE TABLE budget_plans;
    OPTIMIZE TABLE categories;
    OPTIMIZE TABLE categorization_rules;
    OPTIMIZE TABLE processed_files;
" 2>/dev/null

echo "$(date '+%Y-%m-%d %H:%M:%S') - Database optimization completed!"

# Show table sizes
echo "$(date '+%Y-%m-%d %H:%M:%S') - Current table sizes:"
docker exec "$DB_CONTAINER" mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
    SELECT
        table_name AS 'Table',
        ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)',
        table_rows AS 'Rows'
    FROM information_schema.TABLES
    WHERE table_schema = '$DB_NAME'
    ORDER BY (data_length + index_length) DESC;
" 2>/dev/null

# Show total database size
TOTAL_SIZE=$(docker exec "$DB_CONTAINER" du -sh /var/lib/mysql 2>/dev/null | cut -f1)
echo "$(date '+%Y-%m-%d %H:%M:%S') - Total database size: $TOTAL_SIZE"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Maintenance completed successfully!"
