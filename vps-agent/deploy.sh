#!/bin/bash
# ProductPraat.nl VPS Agent Deployment Script
# Run this on your VPS (DigitalOcean, Hetzner, etc.)

set -e

echo "🚀 ProductPraat.nl VPS Agent Deployment"
echo "========================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo ./deploy.sh)${NC}"
    exit 1
fi

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Installing Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Check for Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}Installing Docker Compose...${NC}"
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Create directories
echo -e "${GREEN}Creating directories...${NC}"
mkdir -p /opt/productpraat-agent
mkdir -p /opt/productpraat-agent/logs
mkdir -p /opt/productpraat-agent/workspace
mkdir -p /opt/productpraat-agent/config

# Copy files
echo -e "${GREEN}Copying files...${NC}"
cp -r . /opt/productpraat-agent/

cd /opt/productpraat-agent

# Check for .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from template...${NC}"
    cp .env.example .env
    echo ""
    echo -e "${RED}⚠️  IMPORTANT: Edit /opt/productpraat-agent/.env with your credentials:${NC}"
    echo ""
    echo "   nano /opt/productpraat-agent/.env"
    echo ""
    echo "   Required settings:"
    echo "   - ANTHROPIC_API_KEY"
    echo "   - BOL_CLIENT_ID"
    echo "   - BOL_CLIENT_SECRET"
    echo "   - BOL_SITE_CODE"
    echo ""
    read -p "Press Enter after editing .env to continue..."
fi

# Build sandbox image
echo -e "${GREEN}Building sandbox image...${NC}"
docker build -t productpraat-agent-sandbox:latest -f Dockerfile.sandbox .

# Build and start services
echo -e "${GREEN}Starting services...${NC}"
docker-compose up -d --build

# Show status
echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Services:"
docker-compose ps
echo ""
echo "Logs: docker-compose logs -f"
echo "Stop: docker-compose down"
echo ""
echo "API endpoint: http://localhost:8000"
echo ""

# Create systemd service for auto-start
cat > /etc/systemd/system/productpraat-agent.service << 'EOF'
[Unit]
Description=ProductPraat AI Agent
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/productpraat-agent
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable productpraat-agent

echo -e "${GREEN}✅ Auto-start service installed${NC}"
echo "The agent will start automatically on reboot."
