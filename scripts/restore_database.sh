#!/bin/bash
# ==============================================================================
# LUCID Finance - Database Restore Script
# ==============================================================================
# Restores a MySQL database backup
# Usage: ./scripts/restore_database.sh <backup_file>

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if backup file is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: No backup file specified${NC}"
    echo "Usage: $0 <backup_file>"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo -e "${RED}Error: Backup file '${BACKUP_FILE}' not found${NC}"
    exit 1
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}LUCID Finance - Database Restore${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Check if database container is running
if ! docker ps | grep -q lucid_finance_db; then
    echo -e "${RED}Error: Database container 'lucid_finance_db' is not running${NC}"
    echo "Start it with: docker compose up -d"
    exit 1
fi

echo -e "${YELLOW}⚠️  WARNING: This will replace all data in the database!${NC}"
echo "Database: ${DB_NAME}"
echo "Backup file: ${BACKUP_FILE}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

echo -e "${YELLOW}Restoring backup...${NC}"

# Restore backup
docker exec -i lucid_finance_db mysql \
    -u${DB_USER} \
    -p${DB_PASSWORD} \
    ${DB_NAME} < "${BACKUP_FILE}"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Database restored successfully!${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}✗ Restore failed${NC}"
    exit 1
fi
