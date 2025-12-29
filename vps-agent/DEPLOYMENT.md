# 🚀 Deployment Guide - WritGo.nl AI Agent VPS

## Quick Deploy (Recommended)

### Option 1: Docker Compose (Lokaal testen)

```bash
cd vps-agent

# 1. Configureer environment
cp .env.example .env
# Edit .env met je keys

# 2. Build sandbox image
docker build -t writgo-agent-sandbox -f Dockerfile.sandbox .

# 3. Start services
docker-compose up -d

# 4. Check logs
docker-compose logs -f agent

# 5. Test health
curl http://localhost:8000/health
```

### Option 2: Render VPS (Production)

**Stap 1: Render Web Service aanmaken**

1. Ga naar https://render.com/dashboard
2. Klik **New +** → **Web Service**
3. Connect je Git repository
4. Configureer:
   - **Name:** writgo-agent-vps
   - **Region:** Frankfurt (EU) of dichtbij
   - **Branch:** main (of je branch naam)
   - **Root Directory:** `vps-agent`
   - **Environment:** Docker
   - **Dockerfile Path:** `Dockerfile`
   - **Instance Type:** **Standard** (4GB RAM minimum!)

**Stap 2: Environment Variables instellen**

In Render dashboard, ga naar **Environment** tab en voeg toe:

```
ANTHROPIC_API_KEY=your-anthropic-api-key
WRITGO_API_URL=https://writgo.nl
WRITGO_WEBHOOK_SECRET=<same-as-in-writgo-env>
MAX_ITERATIONS=50
SANDBOX_TIMEOUT=300
DEFAULT_MODEL=claude-opus-4-20250514
MODEL_COMPLEX=claude-opus-4-20250514
MODEL_FAST=claude-haiku-3-20250307
MODEL_CODING=claude-sonnet-4-20250514
```

**Stap 3: Deploy**

1. Klik **Create Web Service**
2. Wait for build (5-10 minuten eerste keer)
3. Noteer de URL: `https://writgo-agent-vps.onrender.com`

**Stap 4: Configureer WritGo.nl**

In je WritGo.nl `.env.local`:

```bash
# VPS Configuration
VPS_ENABLED=true
VPS_API_URL=https://writgo-agent-vps.onrender.com
VPS_API_SECRET=<same-as-WRITGO_WEBHOOK_SECRET-above>
```

**Stap 5: Test**

```bash
# Test VPS health
curl https://writgo-agent-vps.onrender.com/health

# Should return:
# {"status":"healthy","version":"1.0.0","sandbox_ready":true}
```

### Option 3: Zelf-gehoste VPS (DigitalOcean, Hetzner, etc.)

**Requirements:**
- Ubuntu 22.04 LTS
- 4GB RAM minimum (8GB aanbevolen)
- 2+ vCPU cores
- Docker installed

**Setup:**

```bash
# 1. SSH naar je VPS
ssh root@your-vps-ip

# 2. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 3. Clone repository
git clone https://github.com/your-org/writgo-agent.git
cd writgo-agent/vps-agent

# 4. Configure environment
cp .env.example .env
nano .env  # Edit met je keys

# 5. Build images
docker build -t writgo-agent-sandbox -f Dockerfile.sandbox .
docker build -t writgo-agent-runtime -f Dockerfile .

# 6. Start met Docker Compose
docker-compose up -d

# 7. Setup Nginx reverse proxy (optioneel maar aanbevolen)
# ... (zie nginx configuratie hieronder)
```

## Nginx Reverse Proxy Setup

```nginx
# /etc/nginx/sites-available/writgo-agent
server {
    listen 80;
    server_name agent.writgo.nl;  # Of je subdomain

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable en restart:
```bash
ln -s /etc/nginx/sites-available/writgo-agent /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

Setup SSL met Certbot:
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d agent.writgo.nl
```

## Monitoring

### Logs bekijken

```bash
# Docker Compose
docker-compose logs -f agent

# Direct Docker
docker logs -f writgo-agent-runtime

# Log files
tail -f logs/agent.log
```

### Resource Monitoring

```bash
# Docker stats
docker stats

# System resources
htop

# Disk space
df -h
```

## Troubleshooting

### Agent crasht

**Check logs:**
```bash
docker-compose logs agent | tail -100
```

**Common issues:**
- Out of memory → Upgrade to 8GB RAM instance
- Docker socket permission denied → Check volume mount in docker-compose.yml
- API key errors → Verify ANTHROPIC_API_KEY is set

### Sandbox timeout

**Increase timeout:**
```bash
# In .env
SANDBOX_TIMEOUT=600  # 10 minutes
```

### Task stuck in "running" status

**Restart agent:**
```bash
docker-compose restart agent
```

**Reset task in DB:**
```sql
UPDATE agent_tasks
SET status = 'failed', error_message = 'Timeout - manually reset'
WHERE id = 'task-id-here';
```

## Security Checklist

- [ ] WRITGO_WEBHOOK_SECRET is strong (32+ characters)
- [ ] VPS_API_SECRET matches WritGo.nl
- [ ] Firewall allows only port 80/443
- [ ] SSL certificate installed (HTTPS)
- [ ] Regular security updates: `apt update && apt upgrade`
- [ ] Docker daemon secured
- [ ] Logs rotation configured

## Performance Tuning

### Voor meer concurrent tasks

Verhoog resources in `docker-compose.yml`:

```yaml
services:
  agent:
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
```

### Voor snellere responses

Use Haiku voor meer tasks:
```bash
# In .env
MODEL_ROUTING=true
DEFAULT_MODEL=claude-haiku-3-20250307  # Sneller en goedkoper
```

## Cost Optimization

### Render Pricing
- **Free:** 0.1 CPU, 512MB RAM (te weinig!)
- **Starter:** $7/month, 0.5 CPU, 512MB RAM (te weinig!)
- **Standard:** $25/month, 1 CPU, 2GB RAM (minimum!)
- **Pro:** $85/month, 2 CPU, 4GB RAM (aanbevolen voor productie)

### DigitalOcean Pricing
- **Basic Droplet:** $24/month, 2 vCPU, 4GB RAM
- **General Purpose:** $48/month, 2 vCPU, 8GB RAM (aanbevolen)

### API Costs
- Claude Opus: ~$0.015 per task (complex)
- Claude Sonnet: ~$0.003 per task (balanced)
- Claude Haiku: ~$0.0003 per task (simple)

**Tip:** Use model routing om kosten te besparen!

## Backup & Recovery

### Backup workspace

```bash
# Backup alle workspaces
tar -czf workspace-backup-$(date +%Y%m%d).tar.gz /app/workspace/*

# Upload naar S3 (optioneel)
aws s3 cp workspace-backup-*.tar.gz s3://your-bucket/backups/
```

### Disaster Recovery

```bash
# 1. Stop agent
docker-compose down

# 2. Backup data
docker run --rm -v agent-data:/data -v $(pwd):/backup alpine tar czf /backup/data-backup.tar.gz /data

# 3. Rebuild
docker-compose up -d --build

# 4. Restore data if needed
docker run --rm -v agent-data:/data -v $(pwd):/backup alpine tar xzf /backup/data-backup.tar.gz -C /
```

---

## Support

Voor vragen of problemen:
1. Check de logs eerst
2. Zie TROUBLESHOOTING sectie
3. Open een GitHub issue
4. Contact support: support@writgo.nl

---

**Built with:** Docker, FastAPI, Anthropic Claude, Playwright
**Inspired by:** Manus.im, Abacus Deep Agent
