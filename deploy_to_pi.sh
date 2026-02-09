#!/bin/bash
# ==============================================================================
# LUCID Finance - Deploy to Raspberry Pi
# ==============================================================================
# This script deploys the application to your Raspberry Pi
# Usage: ./deploy_to_pi.sh

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PI_USER="luca"
PI_HOST="lucid-pi.local"
PI_DIR="/home/luca/LUCID_Finance_WebApp"
REPO_URL="https://github.com/LucaZoss/LUCID_Finance_WebApp.git"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}LUCID Finance - Deploy to Raspberry Pi${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Check if user wants to transfer database
echo -e "${YELLOW}Do you want to transfer your local database to the Pi?${NC}"
echo "This will backup your local database and restore it on the Pi."
read -p "Transfer database? (y/n): " -r
echo ""
TRANSFER_DB=false
if [[ $REPLY =~ ^[Yy]$ ]]; then
    TRANSFER_DB=true
fi

# Test SSH connection
echo -e "${YELLOW}Testing SSH connection to ${PI_USER}@${PI_HOST}...${NC}"
if ! ssh -o ConnectTimeout=5 ${PI_USER}@${PI_HOST} "echo 'Connection successful'" > /dev/null 2>&1; then
    echo -e "${RED}Failed to connect to ${PI_HOST}${NC}"
    echo "Please ensure:"
    echo "  1. Your Pi is powered on and connected to the network"
    echo "  2. SSH is enabled on your Pi"
    echo "  3. You can access it at ${PI_HOST}"
    exit 1
fi
echo -e "${GREEN}✓ SSH connection successful${NC}"
echo ""

# Check if app directory exists
echo -e "${YELLOW}Checking if application exists on Pi...${NC}"
if ssh ${PI_USER}@${PI_HOST} "[ -d ${PI_DIR} ]"; then
    echo -e "${YELLOW}Application directory exists. Updating...${NC}"

    # Pull latest changes
    echo -e "${YELLOW}Pulling latest changes from Git...${NC}"
    ssh ${PI_USER}@${PI_HOST} "cd ${PI_DIR} && git pull"

else
    echo -e "${YELLOW}Application not found. Cloning repository...${NC}"

    # Clone repository
    ssh ${PI_USER}@${PI_HOST} "git clone ${REPO_URL} ${PI_DIR}"
fi
echo -e "${GREEN}✓ Code updated${NC}"
echo ""

# Setup environment file
echo -e "${YELLOW}Setting up environment file...${NC}"

# Check if local .env exists
if [ -f .env ]; then
    echo "Local .env file found."
    read -p "Transfer your local .env file to Pi? (y/n): " -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Transferring .env file..."
        scp .env ${PI_USER}@${PI_HOST}:${PI_DIR}/
        echo -e "${GREEN}✓ .env file transferred${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  IMPORTANT: Review production settings on Pi:${NC}"
        echo "   - Database passwords should be strong"
        echo "   - JWT secret should be changed for production"
        echo "   Run: ssh ${PI_USER}@${PI_HOST} 'nano ${PI_DIR}/.env'"
        echo ""
    else
        echo "Creating .env from template on Pi..."
        ssh ${PI_USER}@${PI_HOST} "cd ${PI_DIR} && cp .env.example .env"
        echo -e "${YELLOW}⚠️  IMPORTANT: You MUST edit .env on Pi with production settings!${NC}"
        echo "   Run: ssh ${PI_USER}@${PI_HOST} 'nano ${PI_DIR}/.env'"
        echo ""
        read -p "Press Enter to continue after you've noted this..."
    fi
else
    echo "No local .env file found. Creating from template on Pi..."
    ssh ${PI_USER}@${PI_HOST} "cd ${PI_DIR} && cp .env.example .env"
    echo -e "${YELLOW}⚠️  IMPORTANT: You MUST edit .env on Pi with production settings!${NC}"
    echo "   Run: ssh ${PI_USER}@${PI_HOST} 'nano ${PI_DIR}/.env'"
    echo ""
    read -p "Press Enter to continue after you've noted this..."
fi

echo -e "${GREEN}✓ Environment file ready${NC}"
echo ""

# Install backend dependencies
echo -e "${YELLOW}Installing backend dependencies...${NC}"
ssh ${PI_USER}@${PI_HOST} "cd ${PI_DIR} && source \$HOME/.cargo/env && uv sync"
echo -e "${GREEN}✓ Backend dependencies installed${NC}"
echo ""

# Build frontend
echo -e "${YELLOW}Building frontend...${NC}"
ssh ${PI_USER}@${PI_HOST} "cd ${PI_DIR}/frontend && npm install && npm run build"
echo -e "${GREEN}✓ Frontend built${NC}"
echo ""

# Start/restart Docker containers
echo -e "${YELLOW}Starting MySQL database...${NC}"
ssh ${PI_USER}@${PI_HOST} "cd ${PI_DIR} && docker compose up -d"
echo "Waiting for MySQL to be ready..."
sleep 5
echo -e "${GREEN}✓ Database running${NC}"
echo ""

# Transfer database if requested
if [ "$TRANSFER_DB" = true ]; then
    echo -e "${YELLOW}Transferring database...${NC}"
    echo "Creating local backup..."

    # Create temporary backup
    TEMP_BACKUP="temp_deploy_backup_$(date +%Y%m%d_%H%M%S).sql"
    ./scripts/backup_database.sh "${TEMP_BACKUP}"

    echo "Transferring backup to Pi..."
    scp "${TEMP_BACKUP}" ${PI_USER}@${PI_HOST}:${PI_DIR}/

    echo "Restoring database on Pi..."
    ssh ${PI_USER}@${PI_HOST} << EOF
        cd ${PI_DIR}
        docker exec -i lucid_finance_db mysql -u\${DB_USER:-lucid_user} -p\${DB_PASSWORD:-lucid_pass_2025} \${DB_NAME:-lucid_finance} < ${TEMP_BACKUP}
        rm -f ${TEMP_BACKUP}
EOF

    # Clean up local backup
    rm -f "${TEMP_BACKUP}"
    echo -e "${GREEN}✓ Database transferred${NC}"
    echo ""
else
    # Initialize categories if not transferring database
    echo -e "${YELLOW}Initializing categories...${NC}"
    ssh ${PI_USER}@${PI_HOST} "cd ${PI_DIR} && source \$HOME/.cargo/env && uv run python scripts/initialize_categories.py --force"
    echo -e "${GREEN}✓ Categories initialized${NC}"
    echo ""
fi

# Setup systemd service
echo -e "${YELLOW}Setting up backend service...${NC}"
ssh ${PI_USER}@${PI_HOST} "sudo tee /etc/systemd/system/lucid-backend.service > /dev/null" << 'EOF'
[Unit]
Description=LUCID Finance Backend API
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=luca
WorkingDirectory=/home/luca/LUCID_Finance_WebApp
Environment="PATH=/home/luca/.cargo/bin:/home/luca/.local/bin:/usr/bin"
ExecStartPre=/bin/sleep 5
ExecStart=/home/luca/.cargo/bin/uv run uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

ssh ${PI_USER}@${PI_HOST} "sudo systemctl daemon-reload"
ssh ${PI_USER}@${PI_HOST} "sudo systemctl enable lucid-backend"
ssh ${PI_USER}@${PI_HOST} "sudo systemctl restart lucid-backend"
echo -e "${GREEN}✓ Backend service configured and started${NC}"
echo ""

# Check if nginx is installed
echo -e "${YELLOW}Checking nginx...${NC}"
if ssh ${PI_USER}@${PI_HOST} "command -v nginx > /dev/null"; then
    echo "nginx is installed"

    # Setup nginx configuration
    echo -e "${YELLOW}Configuring nginx...${NC}"
    ssh ${PI_USER}@${PI_HOST} "sudo tee /etc/nginx/sites-available/lucid-finance > /dev/null" << 'EOF'
server {
    listen 80;
    server_name _;

    # Frontend - serve static files
    location / {
        root /home/luca/LUCID_Finance_WebApp/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API - proxy to FastAPI
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://localhost:8000/api/health;
    }
}
EOF

    # Enable site
    ssh ${PI_USER}@${PI_HOST} "sudo ln -sf /etc/nginx/sites-available/lucid-finance /etc/nginx/sites-enabled/lucid-finance"
    ssh ${PI_USER}@${PI_HOST} "sudo rm -f /etc/nginx/sites-enabled/default"

    # Test and restart nginx
    if ssh ${PI_USER}@${PI_HOST} "sudo nginx -t" > /dev/null 2>&1; then
        ssh ${PI_USER}@${PI_HOST} "sudo systemctl restart nginx"
        ssh ${PI_USER}@${PI_HOST} "sudo systemctl enable nginx"
        echo -e "${GREEN}✓ nginx configured and restarted${NC}"
    else
        echo -e "${RED}nginx configuration test failed${NC}"
    fi
else
    echo -e "${YELLOW}nginx not installed. Skipping web server setup.${NC}"
    echo "Install with: sudo apt install nginx"
fi
echo ""

# Get Pi IP address
echo -e "${YELLOW}Getting Pi IP address...${NC}"
PI_IP=$(ssh ${PI_USER}@${PI_HOST} "hostname -I | awk '{print \$1}'")
echo -e "${GREEN}✓ Pi IP: ${PI_IP}${NC}"
echo ""

# Check service status
echo -e "${YELLOW}Checking service status...${NC}"
ssh ${PI_USER}@${PI_HOST} "sudo systemctl is-active lucid-backend" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backend service is running${NC}"
else
    echo -e "${RED}⚠ Backend service is not running${NC}"
    echo "Check logs with: ssh ${PI_USER}@${PI_HOST} 'sudo journalctl -u lucid-backend -n 50'"
fi
echo ""

# Test health endpoint
echo -e "${YELLOW}Testing API health endpoint...${NC}"
sleep 3
if ssh ${PI_USER}@${PI_HOST} "curl -s http://localhost:8000/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API is responding${NC}"
else
    echo -e "${YELLOW}⚠ API not responding yet (may need a moment to start)${NC}"
fi
echo ""

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "Access your application at:"
echo -e "  ${GREEN}http://${PI_IP}${NC}"
echo -e "  ${GREEN}http://lucid-pi.local${NC}"
echo ""
echo -e "API documentation:"
echo -e "  ${GREEN}http://${PI_IP}/api/docs${NC}"
echo ""
echo -e "Useful commands:"
echo -e "  View backend logs:  ${YELLOW}ssh ${PI_USER}@${PI_HOST} 'sudo journalctl -u lucid-backend -f'${NC}"
echo -e "  Restart backend:    ${YELLOW}ssh ${PI_USER}@${PI_HOST} 'sudo systemctl restart lucid-backend'${NC}"
echo -e "  Check status:       ${YELLOW}ssh ${PI_USER}@${PI_HOST} 'sudo systemctl status lucid-backend'${NC}"
echo -e "  Database access:    ${YELLOW}ssh ${PI_USER}@${PI_HOST} 'docker exec -it lucid_finance_db mysql -ulucid_user -p'${NC}"
echo ""
