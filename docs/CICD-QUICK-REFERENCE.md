# 🚀 ZigScan API - Quick CI/CD Reference

## Available Startup Commands

```bash
# Development (local, with SSH tunnel)
npm run start:dev
# or
npm run start:tunnel

# Production (with SSH tunnel support)
npm run start:prod

# Simple start (no SSH tunnel)
npm run start:simple

# Direct start (built app)
npm start
```

## CI/CD Deployment Options

### 1. **PM2 (Process Manager)** - Recommended for VPS/Dedicated Server

```bash
# Deploy
npm run deploy:pm2

# Or manually
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Monitor
pm2 monit
pm2 logs zigscan-api

# Restart
pm2 restart zigscan-api
```

**Pros:**
- ✅ Simple process management
- ✅ Auto-restart on failure
- ✅ Built-in log management
- ✅ Low resource overhead

**Cons:**
- ❌ Single server only
- ❌ Manual scaling

---

### 2. **Docker** - Recommended for Containerized Environments

```bash
# Build
docker build -t zigscan-api:latest .

# Deploy
npm run deploy:docker

# Or manually
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop
docker-compose -f docker-compose.prod.yml down
```

**Pros:**
- ✅ Consistent environments
- ✅ Easy to scale
- ✅ Isolated dependencies

**Cons:**
- ❌ Higher resource usage
- ❌ More complex SSH tunnel setup

---

### 3. **GitHub Actions** - Automated CI/CD

Workflow file: `.github/workflows/deploy.yml`

**Required GitHub Secrets:**
```
DEPLOY_SSH_KEY          # SSH key for deployment server
DEPLOY_HOST             # Server IP/hostname
DEPLOY_USER             # SSH username
DEPLOY_PATH             # Deployment path
SSH_TUNNEL_KEY          # PostgreSQL tunnel SSH key
SSH_PASSPHRASE          # SSH key passphrase
APP_URL                 # App URL for health checks
```

**Trigger:**
```bash
git push origin main
```

**Pros:**
- ✅ Fully automated
- ✅ Built-in testing
- ✅ Rollback capability

**Cons:**
- ❌ Requires GitHub
- ❌ More setup initially

---

## Environment Configuration

### Development (.env)
```env
NODE_ENV=development
USE_SSH_TUNNEL=true
POSTGRES_BACKUP_HOST=localhost
POSTGRES_BACKUP_PORT=5433
SSH_HOST=141.95.66.30
SSH_PRIVATE_KEY=/home/ubuntu/.ssh/primary
```

### Production (.env.production)
```env
NODE_ENV=production
USE_SSH_TUNNEL=true
POSTGRES_BACKUP_HOST=localhost
POSTGRES_BACKUP_PORT=5433
SSH_HOST=141.95.66.30
SSH_PRIVATE_KEY=/path/to/production/key
```

### CI/CD (no tunnel needed if database is accessible)
```env
NODE_ENV=production
USE_SSH_TUNNEL=false
POSTGRES_BACKUP_HOST=database.internal
POSTGRES_BACKUP_PORT=5432
```

---

## SSH Tunnel Configuration

### When SSH Tunnel is NEEDED:
- Remote PostgreSQL server (141.95.66.30)
- Not on same network
- Requires secure connection

**Setup:**
```bash
# Copy SSH key
mkdir -p ~/.ssh
cp /path/to/key ~/.ssh/tunnel_key
chmod 600 ~/.ssh/tunnel_key

# Set environment
export SSH_PRIVATE_KEY=~/.ssh/tunnel_key
export SSH_PASSPHRASE="your-passphrase"
export USE_SSH_TUNNEL=true

# Start with tunnel
npm run start:prod
```

### When SSH Tunnel is NOT NEEDED:
- Database on same server (localhost)
- Database on same network
- Cloud-managed databases (with direct access)

**Setup:**
```bash
# Set environment
export USE_SSH_TUNNEL=false
export POSTGRES_BACKUP_HOST=localhost
export POSTGRES_BACKUP_PORT=5432

# Start without tunnel
npm run start:simple
```

---

## Common Deployment Scenarios

### Scenario 1: Deploy to AWS EC2/DigitalOcean

```bash
# SSH into server
ssh ubuntu@your-server.com

# Clone repository
git clone https://github.com/your-org/zigscanapi-mainnet-v2.git
cd zigscanapi-mainnet-v2

# Setup environment
cp .env.example .env
nano .env  # Edit with production values

# Setup SSH key for tunnel
mkdir -p ~/.ssh
# Copy your tunnel key here
chmod 600 ~/.ssh/tunnel_key

# Install dependencies
npm install --only=production

# Build
npm run build

# Deploy with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Scenario 2: Deploy with Docker

```bash
# On your server
git clone https://github.com/your-org/zigscanapi-mainnet-v2.git
cd zigscanapi-mainnet-v2

# Setup environment
cp .env.example .env.prod
nano .env.prod

# Setup SSH key
mkdir -p ./secrets
# Copy tunnel key
chmod 600 ./secrets/tunnel_key

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

### Scenario 3: CI/CD with GitHub Actions

```bash
# 1. Add secrets to GitHub repository
# 2. Push to main branch
git push origin main

# 3. Monitor deployment
# Go to: https://github.com/your-org/repo/actions

# 4. Verify deployment
curl https://your-api.com/health
```

---

## Troubleshooting Quick Fixes

### Issue: SSH Tunnel Won't Connect
```bash
# Check key permissions
chmod 600 ~/.ssh/tunnel_key

# Test manually
ssh -i ~/.ssh/tunnel_key ubuntu@141.95.66.30

# Check if tunnel is running
ps aux | grep ssh
lsof -i :5433
```

### Issue: Port Already in Use
```bash
# Kill process on port 5433
kill -9 $(lsof -ti:5433)

# Or kill all SSH tunnels
pkill -f "ssh.*5433"
```

### Issue: Application Won't Start
```bash
# Check logs
pm2 logs zigscan-api --lines 50
# or
docker-compose logs zigscan-api --tail=50

# Check database connectivity
psql -h localhost -p 5433 -U postgres -d zigchain_mainnet_backup

# Verify environment variables
pm2 env zigscan-api
```

### Issue: Build Fails
```bash
# Clear node_modules
rm -rf node_modules package-lock.json

# Reinstall
npm install --legacy-peer-deps

# Try build
npm run build
```

---

## Health Checks

```bash
# Basic health check
curl http://localhost:8000/health

# Detailed check
curl http://localhost:8000/api/stats

# Check with authentication
curl -H "X-API-Key: your-api-key" http://localhost:8000/api/transactions/latest
```

---

## Monitoring

### PM2 Dashboard
```bash
pm2 monit              # Terminal dashboard
pm2 list               # List all processes
pm2 logs zigscan-api   # View logs
pm2 restart zigscan-api # Restart app
```

### Docker Logs
```bash
docker-compose -f docker-compose.prod.yml logs -f
docker-compose -f docker-compose.prod.yml ps
```

### System Resources
```bash
# Check CPU/Memory
top
htop

# Check disk space
df -h

# Check open connections
netstat -tuln | grep 8000
```

---

## Quick Commands Cheat Sheet

```bash
# Start development
npm run start:dev

# Build production
npm run build

# Deploy with PM2
pm2 start ecosystem.config.js --env production

# Deploy with Docker
docker-compose -f docker-compose.prod.yml up -d

# View logs (PM2)
pm2 logs zigscan-api

# View logs (Docker)
docker-compose -f docker-compose.prod.yml logs -f

# Restart (PM2)
pm2 restart zigscan-api

# Restart (Docker)
docker-compose -f docker-compose.prod.yml restart

# Stop (PM2)
pm2 stop zigscan-api

# Stop (Docker)
docker-compose -f docker-compose.prod.yml down

# Health check
curl http://localhost:8000/health
```

---

## See Full Documentation

- **Full Deployment Guide**: `CICD-DEPLOYMENT.md`
- **API Documentation**: `docs/API.md`
- **Quick Reference**: `docs/QUICK_REFERENCE.md`
