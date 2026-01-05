# CI/CD Deployment Guide for ZigScan API

This guide explains how to deploy the ZigScan API in production with SSH tunnel support for remote PostgreSQL access.

## 📋 Prerequisites

- Node.js 18+ or Docker
- SSH access to deployment server
- SSH private key for PostgreSQL tunnel
- PM2 (for non-Docker deployments) or Docker + Docker Compose

## 🚀 Deployment Options

### Option 1: Direct Deployment with PM2 (Recommended for Single Server)

#### 1. Setup Environment Variables

Create a `.env` file on your deployment server:

```bash
# Application Settings
NODE_ENV=production
ZIGSCAN_REQUIRE_AUTH=true
API_KEY_ISSUER_EMAILS=admin@zigscan.org
ZIGSCAN_API=https://zigchain-mainnet-api.wickhub.cc
ZIGSCAN_RPC=https://zigchain-mainnet-rpc-sanatry-01.wickhub.cc

# Local PostgreSQL (for metadata)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=saad_test_db
POSTGRES_SSL=false

# Remote PostgreSQL via SSH Tunnel (for blockchain data)
POSTGRES_BACKUP_HOST=localhost
POSTGRES_BACKUP_PORT=5433
POSTGRES_BACKUP_USER=postgres
POSTGRES_BACKUP_PASSWORD=your_backup_password
POSTGRES_BACKUP_DB=zigchain_mainnet_backup
POSTGRES_BACKUP_SSL=false

# SSH Tunnel Configuration
USE_SSH_TUNNEL=true
SSH_HOST=141.95.66.30
SSH_USERNAME=ubuntu
SSH_PRIVATE_KEY=/home/ubuntu/.ssh/tunnel_key
SSH_PASSPHRASE=your_ssh_passphrase
SSH_REMOTE_PORT=5432
```

#### 2. Setup SSH Key

Copy your SSH private key to the server:

```bash
# On deployment server
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Copy key (do this securely - use scp or paste with proper permissions)
nano ~/.ssh/tunnel_key
chmod 600 ~/.ssh/tunnel_key
```

#### 3. Install Dependencies

```bash
npm install --only=production --legacy-peer-deps
```

#### 4. Deploy with PM2

```bash
# Install PM2 globally if not already installed
npm install -g pm2

# Start the application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration to restart on reboot
pm2 save
pm2 startup
```

#### 5. Monitor Application

```bash
# View logs
pm2 logs zigscan-api

# Monitor status
pm2 monit

# Restart if needed
pm2 restart zigscan-api
```

---

### Option 2: Docker Deployment

#### 1. Setup Environment File

Create `.env.prod`:

```bash
# Copy from .env template above
cp .env .env.prod
# Edit with production values
nano .env.prod
```

#### 2. Setup SSH Key

```bash
mkdir -p ./secrets
# Copy SSH private key
cp /path/to/your/key ./secrets/tunnel_key
chmod 600 ./secrets/tunnel_key
```

#### 3. Update docker-compose.prod.yml

Ensure the `SSH_PRIVATE_KEY_PATH` points to your key:

```yaml
environment:
  SSH_PRIVATE_KEY_PATH: /root/.ssh/id_rsa
volumes:
  - ./secrets/tunnel_key:/root/.ssh/id_rsa:ro
```

#### 4. Build and Deploy

```bash
# Build image
docker build -t zigscan-api:latest .

# Start container
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop container
docker-compose -f docker-compose.prod.yml down
```

---

### Option 3: GitHub Actions CI/CD

#### 1. Setup GitHub Secrets

Go to your repository → Settings → Secrets and add:

```
DEPLOY_SSH_KEY          # SSH key to access deployment server
DEPLOY_HOST             # Deployment server IP/hostname
DEPLOY_USER             # SSH username for deployment
DEPLOY_PATH             # Path on server (e.g., /home/ubuntu/zigscan-api)
SSH_TUNNEL_KEY          # SSH private key for PostgreSQL tunnel
SSH_PASSPHRASE          # Passphrase for tunnel SSH key
APP_URL                 # Application URL for health checks
```

Plus all environment variables from your `.env` file.

#### 2. Push to Main Branch

The workflow in `.github/workflows/deploy.yml` will automatically:
- Build the application
- Run tests
- Deploy to production server
- Setup SSH tunnel
- Restart application
- Perform health checks

```bash
git push origin main
```

---

## 🔧 Manual Deployment Script

For quick manual deployments:

```bash
#!/bin/bash
# deploy.sh - Manual deployment script

set -e

# Configuration
SERVER="ubuntu@your-server.com"
APP_PATH="/home/ubuntu/zigscan-api"

echo "🚀 Deploying ZigScan API..."

# Copy files
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'logs' \
  --exclude 'secrets' \
  ./ $SERVER:$APP_PATH/

# SSH and restart
ssh $SERVER << 'ENDSSH'
  cd /home/ubuntu/zigscan-api
  
  # Install dependencies
  npm install --only=production --legacy-peer-deps
  
  # Restart with PM2
  pm2 restart zigscan-api || pm2 start ecosystem.config.js --env production
  
  # Save PM2 state
  pm2 save
ENDSSH

# Health check
sleep 10
curl -f https://your-api-url.com/health

echo "✅ Deployment complete!"
```

Make it executable:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 🔍 Troubleshooting

### SSH Tunnel Not Connecting

1. **Check SSH key permissions:**
   ```bash
   chmod 600 ~/.ssh/tunnel_key
   ls -la ~/.ssh/tunnel_key
   ```

2. **Test SSH connection manually:**
   ```bash
   ssh -i ~/.ssh/tunnel_key ubuntu@141.95.66.30
   ```

3. **Check if tunnel is running:**
   ```bash
   ps aux | grep ssh
   lsof -i :5433
   ```

4. **View tunnel logs:**
   ```bash
   # With PM2
   pm2 logs zigscan-api --lines 100
   
   # With Docker
   docker-compose -f docker-compose.prod.yml logs zigscan-api
   ```

### Application Won't Start

1. **Check environment variables:**
   ```bash
   pm2 env zigscan-api
   ```

2. **Check PostgreSQL connectivity:**
   ```bash
   # Test local PostgreSQL
   psql -h localhost -p 5432 -U postgres -d saad_test_db
   
   # Test tunnel PostgreSQL
   psql -h localhost -p 5433 -U postgres -d zigchain_mainnet_backup
   ```

3. **Check application logs:**
   ```bash
   tail -f logs/pm2-error.log
   ```

### Port Already in Use

```bash
# Find process using port 5433
lsof -ti:5433

# Kill it
kill -9 $(lsof -ti:5433)

# Restart application
pm2 restart zigscan-api
```

---

## 🔐 Security Best Practices

1. **Never commit secrets:**
   ```bash
   # Add to .gitignore
   echo ".env*" >> .gitignore
   echo "secrets/" >> .gitignore
   echo "*.key" >> .gitignore
   ```

2. **Use environment-specific configs:**
   - `.env.development` for local development
   - `.env.production` for production
   - Use GitHub Secrets for CI/CD

3. **Rotate SSH keys regularly:**
   - Update tunnel SSH key
   - Update deployment SSH key
   - Update in all environments

4. **Limit SSH access:**
   ```bash
   # In ~/.ssh/config
   Host postgresql-tunnel
       HostName 141.95.66.30
       User ubuntu
       IdentityFile ~/.ssh/tunnel_key
       ServerAliveInterval 60
       ServerAliveCountMax 3
   ```

---

## 📊 Monitoring

### Health Check Endpoint

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "uptime": 12345
}
```

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Web dashboard
pm2 plus
```

### Docker Health Check

```bash
docker-compose -f docker-compose.prod.yml ps
docker inspect zigscan-api-prod | grep -A 10 Health
```

---

## 🔄 Rolling Back

### PM2 Deployment

```bash
# Stop current version
pm2 stop zigscan-api

# Checkout previous version
git checkout previous-commit-hash

# Reinstall dependencies
npm install --only=production

# Restart
pm2 restart zigscan-api
```

### Docker Deployment

```bash
# Stop current container
docker-compose -f docker-compose.prod.yml down

# Load previous image
docker load < zigscan-api-backup.tar.gz

# Start container
docker-compose -f docker-compose.prod.yml up -d
```

---

## 📞 Support

For issues or questions:
- Check logs: `pm2 logs zigscan-api` or `docker-compose logs`
- Verify environment variables
- Test SSH tunnel manually
- Check PostgreSQL connectivity
