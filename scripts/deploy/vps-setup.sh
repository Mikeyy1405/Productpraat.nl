#!/bin/bash
# =============================================================================
# Productpraat.nl VPS Deployment Script for TransIP
# =============================================================================
# This script sets up a fresh Ubuntu VPS for running the Productpraat.nl
# application with Playwright browser automation.
#
# Requirements:
# - Ubuntu 22.04 LTS or newer
# - Root access or sudo privileges
# - At least 2GB RAM (4GB recommended for Playwright)
# - At least 20GB disk space
#
# Usage:
#   chmod +x vps-setup.sh
#   sudo ./vps-setup.sh
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# =============================================================================
# Configuration
# =============================================================================

APP_USER="productpraat"
APP_DIR="/var/www/productpraat"
NODE_VERSION="20"
REPO_URL="https://github.com/Mikeyy1405/Productpraat.nl.git"

# =============================================================================
# Pre-flight checks
# =============================================================================

if [ "$EUID" -ne 0 ]; then
    error "Please run as root (use sudo)"
fi

log "Starting VPS setup for Productpraat.nl..."

# =============================================================================
# System Updates
# =============================================================================

log "Updating system packages..."
apt-get update -y
apt-get upgrade -y

# =============================================================================
# Install Dependencies
# =============================================================================

log "Installing base dependencies..."
apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    unzip \
    nginx \
    certbot \
    python3-certbot-nginx

# =============================================================================
# Install Node.js
# =============================================================================

log "Installing Node.js ${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

# Verify installation
node --version
npm --version

# =============================================================================
# Install Playwright Dependencies
# =============================================================================

log "Installing Playwright browser dependencies..."

# Playwright requires these system libraries
apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libxshmfence1 \
    fonts-liberation \
    libappindicator3-1 \
    libu2f-udev \
    libvulkan1 \
    xdg-utils

# Additional fonts for proper rendering
apt-get install -y \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    fonts-dejavu-core

# =============================================================================
# Create Application User
# =============================================================================

log "Creating application user..."

if id "$APP_USER" &>/dev/null; then
    warn "User $APP_USER already exists"
else
    useradd -m -s /bin/bash $APP_USER
    log "User $APP_USER created"
fi

# =============================================================================
# Setup Application Directory
# =============================================================================

log "Setting up application directory..."

mkdir -p $APP_DIR
chown -R $APP_USER:$APP_USER $APP_DIR

# =============================================================================
# Clone Repository
# =============================================================================

log "Cloning repository..."

if [ -d "$APP_DIR/.git" ]; then
    warn "Repository already exists, pulling latest changes..."
    cd $APP_DIR
    sudo -u $APP_USER git pull origin main
else
    sudo -u $APP_USER git clone $REPO_URL $APP_DIR
fi

cd $APP_DIR

# =============================================================================
# Install Node Dependencies
# =============================================================================

log "Installing Node.js dependencies..."
sudo -u $APP_USER npm install

# =============================================================================
# Install Playwright Browsers
# =============================================================================

log "Installing Playwright browsers (this may take a few minutes)..."
sudo -u $APP_USER npx playwright install chromium
sudo -u $APP_USER npx playwright install-deps chromium

# =============================================================================
# Create Environment File
# =============================================================================

log "Creating environment file template..."

if [ ! -f "$APP_DIR/.env" ]; then
    cp $APP_DIR/.env.example $APP_DIR/.env
    chown $APP_USER:$APP_USER $APP_DIR/.env
    chmod 600 $APP_DIR/.env
    warn "Created .env file - please edit with your credentials!"
else
    warn ".env file already exists, skipping..."
fi

# =============================================================================
# Create Systemd Service
# =============================================================================

log "Creating systemd service..."

cat > /etc/systemd/system/productpraat.service << 'EOF'
[Unit]
Description=Productpraat.nl Application
After=network.target

[Service]
Type=simple
User=productpraat
WorkingDirectory=/var/www/productpraat
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=10

# Environment
Environment=NODE_ENV=production
Environment=PORT=3000

# Playwright headless mode
Environment=PLAYWRIGHT_HEADLESS=true

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/productpraat

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=productpraat

[Install]
WantedBy=multi-user.target
EOF

# Create a separate service for the Playwright automation worker
cat > /etc/systemd/system/productpraat-playwright.service << 'EOF'
[Unit]
Description=Productpraat.nl Playwright Automation Worker
After=network.target productpraat.service

[Service]
Type=simple
User=productpraat
WorkingDirectory=/var/www/productpraat
ExecStart=/usr/bin/npm run playwright:worker
Restart=on-failure
RestartSec=30

# Environment
Environment=NODE_ENV=production
Environment=PLAYWRIGHT_HEADLESS=true

# Allow more memory for browser
MemoryMax=2G

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/productpraat

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=productpraat-playwright

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

# =============================================================================
# Configure Nginx
# =============================================================================

log "Configuring Nginx..."

cat > /etc/nginx/sites-available/productpraat << 'EOF'
server {
    listen 80;
    server_name productpraat.nl www.productpraat.nl;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to Node.js app
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Static files (if any)
    location /static {
        alias /var/www/productpraat/dist/static;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/productpraat /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t
systemctl reload nginx

# =============================================================================
# Setup Firewall
# =============================================================================

log "Configuring firewall..."

ufw --force enable
ufw allow ssh
ufw allow 'Nginx Full'

# =============================================================================
# Create Helper Scripts
# =============================================================================

log "Creating helper scripts..."

# Deploy script
cat > /usr/local/bin/productpraat-deploy << 'EOF'
#!/bin/bash
cd /var/www/productpraat
sudo -u productpraat git pull origin main
sudo -u productpraat npm install
sudo -u productpraat npm run build
systemctl restart productpraat
systemctl restart productpraat-playwright
echo "Deployment complete!"
EOF
chmod +x /usr/local/bin/productpraat-deploy

# Logs script
cat > /usr/local/bin/productpraat-logs << 'EOF'
#!/bin/bash
journalctl -u productpraat -u productpraat-playwright -f
EOF
chmod +x /usr/local/bin/productpraat-logs

# Status script
cat > /usr/local/bin/productpraat-status << 'EOF'
#!/bin/bash
echo "=== Productpraat.nl Service Status ==="
systemctl status productpraat --no-pager
echo ""
echo "=== Playwright Worker Status ==="
systemctl status productpraat-playwright --no-pager
echo ""
echo "=== Nginx Status ==="
systemctl status nginx --no-pager
EOF
chmod +x /usr/local/bin/productpraat-status

# =============================================================================
# Create Session Directory for Playwright
# =============================================================================

log "Creating Playwright session storage directory..."
mkdir -p $APP_DIR/.bol-session
chown -R $APP_USER:$APP_USER $APP_DIR/.bol-session
chmod 700 $APP_DIR/.bol-session

# =============================================================================
# Final Setup
# =============================================================================

log "Building application..."
cd $APP_DIR
sudo -u $APP_USER npm run build || warn "Build failed - may need configuration first"

# =============================================================================
# Print Summary
# =============================================================================

echo ""
echo "============================================================================="
echo -e "${GREEN}VPS Setup Complete!${NC}"
echo "============================================================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Edit the environment file with your credentials:"
echo "   nano /var/www/productpraat/.env"
echo ""
echo "2. Add your Bol.com Partner credentials:"
echo "   BOL_PARTNER_EMAIL=your_email@example.com"
echo "   BOL_PARTNER_PASSWORD=your_password"
echo ""
echo "3. Start the services:"
echo "   systemctl enable productpraat"
echo "   systemctl enable productpraat-playwright"
echo "   systemctl start productpraat"
echo "   systemctl start productpraat-playwright"
echo ""
echo "4. (Optional) Setup SSL with Let's Encrypt:"
echo "   certbot --nginx -d productpraat.nl -d www.productpraat.nl"
echo ""
echo "Useful commands:"
echo "  productpraat-deploy  - Pull latest code and restart"
echo "  productpraat-logs    - View live logs"
echo "  productpraat-status  - Check service status"
echo ""
echo "============================================================================="
