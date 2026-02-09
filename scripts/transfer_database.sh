#!/bin/bash
# ==============================================================================
# LUCID Finance - Transfer Database to Raspberry Pi
# ==============================================================================
# Creates a backup locally and transfers it to the Pi
# Usage: ./scripts/transfer_database.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
PI_USER="luca"
PI_HOST="lucid-pi.local"
PI_DIR="/home/luca/LUCID_Finance_WebApp"
BACKUP_FILE="transfer_backup_$(date +%Y%m%d_%H%M%S).sql"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Transfer Database to Raspberry Pi${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Step 1: Create local backup
echo -e "${YELLOW}Step 1/3: Creating local backup...${NC}"
./scripts/backup_database.sh "${BACKUP_FILE}"
echo ""

# Step 2: Transfer to Pi
echo -e "${YELLOW}Step 2/3: Transferring to Pi...${NC}"
scp "${BACKUP_FILE}" ${PI_USER}@${PI_HOST}:${PI_DIR}/
echo -e "${GREEN}✓ Backup transferred to Pi${NC}"
echo ""

# Step 3: Restore on Pi
echo -e "${YELLOW}Step 3/3: Restoring database on Pi...${NC}"
ssh ${PI_USER}@${PI_HOST} << EOF
    cd ${PI_DIR}
    echo "Restoring backup on Raspberry Pi..."
    ./scripts/restore_database.sh ${BACKUP_FILE}
    echo "Cleaning up backup file..."
    rm -f ${BACKUP_FILE}
    echo "Done!"
EOF

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Database Transfer Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Your data has been transferred to the Raspberry Pi."
echo ""

# Clean up local backup
read -p "Delete local backup file? (y/n): " -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f "${BACKUP_FILE}"
    echo "Local backup deleted."
else
    echo "Local backup kept: ${BACKUP_FILE}"
fi
