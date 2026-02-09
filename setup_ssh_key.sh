#!/bin/bash
# ==============================================================================
# Setup SSH Key Authentication for Raspberry Pi
# ==============================================================================
# This script sets up passwordless SSH access to your Pi
# Usage: ./setup_ssh_key.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PI_USER="luca"
PI_HOST="lucid-pi.local"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Setup SSH Key Authentication${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Check if SSH key already exists
if [ ! -f ~/.ssh/id_ed25519 ]; then
    echo -e "${YELLOW}Generating SSH key...${NC}"
    ssh-keygen -t ed25519 -C "$(whoami)@$(hostname)" -f ~/.ssh/id_ed25519 -N ""
    echo -e "${GREEN}✓ SSH key generated${NC}"
else
    echo "SSH key already exists"
fi
echo ""

# Copy key to Pi
echo -e "${YELLOW}Copying SSH key to Pi...${NC}"
echo "You'll need to enter your Pi password one last time:"
ssh-copy-id -i ~/.ssh/id_ed25519.pub ${PI_USER}@${PI_HOST}

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "You can now SSH to your Pi without a password:"
echo "  ssh ${PI_USER}@${PI_HOST}"
echo ""
echo "Test it now:"
ssh ${PI_USER}@${PI_HOST} "echo 'SSH key authentication working!'"
echo ""
