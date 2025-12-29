#!/bin/bash
# =============================================================================
# VPS Services Setup Script
# =============================================================================
# Sets up a TransIP VPS as a central automation server for all projects.
#
# Services installed:
# - Docker & Docker Compose
# - Playwright API (browser automation)
# - Redis (task queue)
# - Nginx (reverse proxy with SSL)
#
# Usage:
#   chmod +x setup-vps.sh
#   sudo ./setup-vps.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# =============================================================================
# Configuration
# =============================================================================

SERVICES_DIR="/opt/vps-services"
DOMAIN="${DOMAIN:-api.productpraat.nl}"
EMAIL="${EMAIL:-admin@productpraat.nl}"

# =============================================================================
# Pre-flight Checks
# =============================================================================

if [ "$EUID" -ne 0 ]; then
    error "Please run as root (use sudo)"
fi

log "Starting VPS Services setup..."

# =============================================================================
# System Updates
# =============================================================================

log "Updating system packages..."
apt-get update -y
apt-get upgrade -y

# =============================================================================
# Install Docker
# =============================================================================

log "Installing Docker..."

if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | bash
    systemctl enable docker
    systemctl start docker
    log "Docker installed"
else
    log "Docker already installed"
fi

# Install Docker Compose plugin
if ! docker compose version &> /dev/null; then
    apt-get install -y docker-compose-plugin
fi

# =============================================================================
# Create Services Directory
# =============================================================================

log "Setting up services directory..."

mkdir -p $SERVICES_DIR
cd $SERVICES_DIR

# =============================================================================
# Copy Service Files
# =============================================================================

log "Copying service configuration..."

# This script assumes you're running it from the vps-services directory
# or that the files are already in place

if [ ! -f "docker-compose.yml" ]; then
    warn "docker-compose.yml not found. Creating from template..."

    cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  playwright-api:
    build:
      context: ./playwright-api
      dockerfile: Dockerfile
    container_name: playwright-api
    restart: unless-stopped
    ports:
      - "127.0.0.1:3100:3100"
    environment:
      - NODE_ENV=production
      - PLAYWRIGHT_API_PORT=3100
      - PLAYWRIGHT_DATA_DIR=/var/lib/playwright-api
      - ADMIN_API_KEY=${PLAYWRIGHT_ADMIN_API_KEY}
    volumes:
      - playwright-data:/var/lib/playwright-api
      - playwright-cache:/home/playwright/.cache
    deploy:
      resources:
        limits:
          memory: 4G

  redis:
    image: redis:7-alpine
    container_name: vps-redis
    restart: unless-stopped
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

  nginx:
    image: nginx:alpine
    container_name: vps-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - certbot-data:/var/www/certbot:ro
      - certbot-conf:/etc/letsencrypt:ro
    depends_on:
      - playwright-api

  certbot:
    image: certbot/certbot
    container_name: vps-certbot
    volumes:
      - certbot-data:/var/www/certbot
      - certbot-conf:/etc/letsencrypt
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

volumes:
  playwright-data:
  playwright-cache:
  redis-data:
  certbot-data:
  certbot-conf:
EOF
fi

# =============================================================================
# Generate Admin API Key
# =============================================================================

if [ -z "$PLAYWRIGHT_ADMIN_API_KEY" ]; then
    PLAYWRIGHT_ADMIN_API_KEY=$(openssl rand -hex 32)
    echo "PLAYWRIGHT_ADMIN_API_KEY=$PLAYWRIGHT_ADMIN_API_KEY" >> .env
    log "Generated admin API key: $PLAYWRIGHT_ADMIN_API_KEY"
    warn "Save this key! It's required for admin operations."
fi

# =============================================================================
# Create Self-Signed SSL Certificate (for initial setup)
# =============================================================================

log "Creating SSL certificates..."

mkdir -p nginx/ssl

if [ ! -f "nginx/ssl/cert.pem" ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/CN=$DOMAIN"
    log "Created self-signed certificate for $DOMAIN"
fi

# =============================================================================
# Build and Start Services
# =============================================================================

log "Building Docker images..."
docker compose build

log "Starting services..."
docker compose up -d

# =============================================================================
# Wait for Services to Start
# =============================================================================

log "Waiting for services to start..."
sleep 10

# Check health
if curl -s http://localhost:3100/health | grep -q "ok"; then
    log "Playwright API is running"
else
    warn "Playwright API health check failed"
fi

# =============================================================================
# Setup Let's Encrypt (optional)
# =============================================================================

read -p "Setup Let's Encrypt SSL for $DOMAIN? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Setting up Let's Encrypt..."

    # Stop nginx temporarily
    docker compose stop nginx

    # Get certificate
    docker run -it --rm \
        -v certbot-conf:/etc/letsencrypt \
        -v certbot-data:/var/www/certbot \
        -p 80:80 \
        certbot/certbot certonly \
        --standalone \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN

    # Update nginx config to use Let's Encrypt certs
    sed -i "s|/etc/nginx/ssl/cert.pem|/etc/letsencrypt/live/$DOMAIN/fullchain.pem|g" nginx/conf.d/*.conf
    sed -i "s|/etc/nginx/ssl/key.pem|/etc/letsencrypt/live/$DOMAIN/privkey.pem|g" nginx/conf.d/*.conf

    # Restart nginx
    docker compose up -d nginx

    log "Let's Encrypt SSL configured"
fi

# =============================================================================
# Create Helper Commands
# =============================================================================

log "Creating helper commands..."

# Status command
cat > /usr/local/bin/vps-status << 'EOF'
#!/bin/bash
echo "=== VPS Services Status ==="
docker compose -f /opt/vps-services/docker-compose.yml ps
echo ""
echo "=== Playwright API Health ==="
curl -s http://localhost:3100/health | python3 -m json.tool 2>/dev/null || echo "Not responding"
EOF
chmod +x /usr/local/bin/vps-status

# Logs command
cat > /usr/local/bin/vps-logs << 'EOF'
#!/bin/bash
docker compose -f /opt/vps-services/docker-compose.yml logs -f ${1:-playwright-api}
EOF
chmod +x /usr/local/bin/vps-logs

# Restart command
cat > /usr/local/bin/vps-restart << 'EOF'
#!/bin/bash
docker compose -f /opt/vps-services/docker-compose.yml restart ${1:-}
EOF
chmod +x /usr/local/bin/vps-restart

# Update command
cat > /usr/local/bin/vps-update << 'EOF'
#!/bin/bash
cd /opt/vps-services
git pull origin main 2>/dev/null || echo "Not a git repo"
docker compose build
docker compose up -d
echo "Services updated!"
EOF
chmod +x /usr/local/bin/vps-update

# =============================================================================
# Setup Firewall
# =============================================================================

log "Configuring firewall..."

ufw --force enable
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny 3100/tcp  # Block direct access to API (use nginx)
ufw deny 6379/tcp  # Block direct access to Redis

# =============================================================================
# Print Summary
# =============================================================================

echo ""
echo "============================================================================="
echo -e "${GREEN}VPS Services Setup Complete!${NC}"
echo "============================================================================="
echo ""
echo "Services running:"
echo "  - Playwright API: http://localhost:3100 (internal)"
echo "  - Redis: localhost:6379 (internal)"
echo "  - Nginx: https://$DOMAIN"
echo ""
echo "Admin API Key:"
echo "  $PLAYWRIGHT_ADMIN_API_KEY"
echo ""
echo "Create a project API key:"
echo "  curl -X POST https://$DOMAIN/playwright/admin/api-keys \\"
echo "    -H 'Authorization: Bearer \$ADMIN_KEY' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"name\": \"My Project\", \"project\": \"myproject\"}'"
echo ""
echo "Helper commands:"
echo "  vps-status  - Show service status"
echo "  vps-logs    - View service logs"
echo "  vps-restart - Restart services"
echo "  vps-update  - Update and rebuild services"
echo ""
echo "============================================================================="
