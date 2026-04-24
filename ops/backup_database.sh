#!/bin/bash
# ==============================================================================
# LUCID Finance - Database Backup Script
# ==============================================================================
# Creates a backup of the MySQL database
# Usage: ./scripts/backup_database.sh [output_file]

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Determine output file
if [ -n "$1" ]; then
    BACKUP_FILE="$1"
else
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
fi

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}LUCID Finance - Database Backup${NC}"
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

echo -e "${YELLOW}Creating backup...${NC}"
echo "Database: ${DB_NAME}"
echo "Output file: ${BACKUP_FILE}"
echo ""

# Create backup
docker exec lucid_finance_db mysqldump \
    -u${DB_USER} \
    -p${DB_PASSWORD} \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    ${DB_NAME} > "${BACKUP_FILE}"

# Check if backup was successful
if [ $? -eq 0 ] && [ -s "${BACKUP_FILE}" ]; then
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo -e "${GREEN}✓ Backup created successfully!${NC}"
    echo ""
    echo "File: ${BACKUP_FILE}"
    echo "Size: ${BACKUP_SIZE}"
    echo ""
    echo "To restore this backup:"
    echo "  ./scripts/restore_database.sh ${BACKUP_FILE}"
    echo ""
else
    echo -e "${RED}✗ Backup failed${NC}"
    rm -f "${BACKUP_FILE}"
    exit 1
fi
