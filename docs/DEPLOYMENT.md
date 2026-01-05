# Deployment Guide

## Overview

ZigScan API uses an automated CI/CD pipeline with **zero-downtime deployment** and **automatic rollback** on failure.

## 🏗️ Deployment Architecture

```
GitHub Push → CI/CD Build → Container Registry → Blue-Green Deploy → Health Check → Success/Rollback
```

### Key Features

✅ **Zero-downtime deployment** - Old container runs until new one is healthy
✅ **Automatic rollback** - Failed deployments revert to previous version
✅ **Health checks** - Docker verifies container is working before switching
✅ **Image versioning** - Each build tagged with SHA for easy rollback
✅ **Build caching** - Faster builds using registry cache

## Prerequisites on Server

- Docker Engine 20.10+
- Docker Compose v2+
- SSH access with deployment permissions
- `wget` installed in container (for health checks)

## How It Works

### 1. CI/CD Pipeline (GitHub Actions)

**Trigger**: Push to `main` branch or manual workflow dispatch

**Steps**:
1. Checkout code
2. Build Docker image
3. Push to GitHub Container Registry (GHCR) with `:latest` and `:sha-<commit>` tags
4. SSH to server
5. Upload `docker-compose.yml` and `deploy.sh`
6. Run deployment script

### 2. Blue-Green Deployment Script

**The `deploy.sh` script performs**:

```bash
1. Pull new Docker image
2. Rename current container to "zigscan-api-old" (backup)
3. Start new container as "zigscan-api"
4. Wait for health check (max 60 seconds)
5. If healthy:
   - Remove old backup container
   - Clean up old images
   - Success ✓
6. If unhealthy:
   - Stop new container
   - Restore old container
   - Rollback complete ✓
```

### 3. Health Checks

Docker automatically checks: `http://localhost:8000/api/v2/health`

- **Interval**: Every 10 seconds
- **Timeout**: 5 seconds per check
- **Retries**: 3 attempts
- **Start period**: 30 seconds grace period

## Configuration

### GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `SSH_HOST` | Server IP or hostname |
| `SSH_USER` | SSH username |
| `SSH_PRIVATE_KEY` | SSH private key (PEM format) |
| `SERVER_DEPLOY_PATH` | Deployment directory (e.g., `/opt/zigscan-api`) |
| `ENV_FILE_B64` | Base64-encoded `.env` file |
| `GHCR_USERNAME` | GitHub username for container registry |
| `GHCR_TOKEN` | GitHub PAT with `read:packages` scope |

### Server Environment File

Create `.env` on server with these variables:

```bash
# API Configuration
ZIGSCAN_API_HOST=0.0.0.0
ZIGSCAN_API_PORT=8000
ZIGSCAN_REQUIRE_AUTH=true
API_KEY_ISSUER_EMAILS=admin@zigscan.org

# Database
POSTGRES_HOST=your-postgres-host
POSTGRES_PORT=5432
POSTGRES_USER=zigscan
POSTGRES_PASSWORD=secure-password
POSTGRES_DB=zigscan_production

# ClickHouse
ZIGSCAN_CLICKHOUSE_URL=https://...
ZIGSCAN_CLICKHOUSE_USERNAME=...
ZIGSCAN_CLICKHOUSE_PASSWORD=...
ZIGSCAN_CLICKHOUSE_DATABASE=zigchain_mainnet_database

# Blockchain APIs
ZIGSCAN_API=https://zigchain-mainnet-api.wickhub.cc
ZIGSCAN_RPC=https://zigchain-mainnet-rpc-sanatry-01.wickhub.cc

# External APIs
COINGECKO_API_KEY=...
COINGECKO_ZIG_ID=zignaly
```

**Encode for GitHub Secrets**:
```bash
base64 --wrap=0 .env > env.b64
# Copy content of env.b64 to ENV_FILE_B64 secret
```

## Deployment Process

### Automated (via CI/CD)

1. **Push to main branch**:
   ```bash
   git push origin main
   ```

2. **Monitor deployment**:
   - Go to GitHub Actions tab
   - Watch "Deploy ZigScan API" workflow
   - Check logs for each step

3. **Verify deployment**:
   ```bash
   # On server
   docker ps
   docker logs zigscan-api --tail 50
   curl http://localhost:8000/api/v2/health
   ```

### Manual Deployment

If needed, deploy manually on server:

```bash
cd /opt/zigscan-api

# Pull latest image
export IMAGE_NAME="ghcr.io/cryptocomicsdevs/zigscanapi-mainnet-v2:latest"
docker compose pull

# Run deployment script
chmod +x deploy.sh
./deploy.sh
```

## Rollback

### Automatic Rollback

The deployment script automatically rolls back if health checks fail.

### Manual Rollback to Specific Version

```bash
cd /opt/zigscan-api

# List available images
docker images | grep zigscan-api

# Set specific version
export IMAGE_NAME="ghcr.io/cryptocomicsdevs/zigscanapi-mainnet-v2:sha-abc1234"

# Deploy
docker compose pull
./deploy.sh
```

### Emergency Rollback

If deployment script fails:

```bash
# Check if backup exists
docker ps -a | grep zigscan-api-old

# Restore backup
docker stop zigscan-api
docker rm zigscan-api
docker rename zigscan-api-old zigscan-api
docker start zigscan-api

# Verify
docker logs zigscan-api --tail 50
curl http://localhost:8000/api/v2/health
```

## Monitoring

### Check Container Status

```bash
# Container status
docker ps --filter "name=zigscan-api"

# Container health
docker inspect zigscan-api | grep -A 10 Health

# Resource usage
docker stats zigscan-api --no-stream
```

### View Logs

```bash
# Live logs
docker logs -f zigscan-api

# Last 100 lines
docker logs zigscan-api --tail 100

# Logs with timestamps
docker logs zigscan-api --timestamps --tail 50
```

### Health Check Endpoint

```bash
# From server
curl http://localhost:8000/api/v2/health

# From outside (if exposed)
curl https://your-domain.com/api/v2/health
```

## Troubleshooting

### Deployment Fails

**Issue**: New container fails health check

**Solution**:
1. Check logs: `docker logs zigscan-api --tail 100`
2. Common issues:
   - Database connection failed (check `POSTGRES_*` env vars)
   - ClickHouse connection failed (check `ZIGSCAN_CLICKHOUSE_*` env vars)
   - Port already in use (check if old container is running)
   - Missing environment variables

**Rollback is automatic**, but if needed manually:
```bash
docker logs zigscan-api --tail 200  # Get error details
./deploy.sh  # Try again after fixing
```

### Container Keeps Restarting

```bash
# Check restart count
docker ps -a | grep zigscan-api

# Check logs
docker logs zigscan-api --tail 200

# Common issues:
# 1. Database not accessible
# 2. Invalid API keys
# 3. Port conflict
# 4. Memory limit exceeded
```

### No Response from API

```bash
# Check if container is running
docker ps | grep zigscan-api

# Check port binding
docker port zigscan-api

# Check if port is listening
netstat -tlnp | grep 8000

# Test from inside container
docker exec zigscan-api wget -O- http://localhost:8000/api/v2/health
```

### Old Images Filling Disk

```bash
# Check disk usage
df -h
docker system df

# Clean up old images
docker image prune -a -f

# Remove unused containers
docker container prune -f

# Full cleanup (careful!)
docker system prune -a --volumes -f
```

## Performance Optimization

### Resource Limits

Adjust in `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '1'
      memory: 512M
```

### Build Cache

The workflow uses registry cache for faster builds:

```yaml
cache-from: type=registry,ref=...:buildcache
cache-to: type=registry,ref=...:buildcache,mode=max
```

This reduces build time from ~5min to ~1min on subsequent deployments.

## Security Best Practices

1. **SSH Keys**: Use dedicated deploy keys with limited permissions
2. **Secrets**: Store all sensitive data in GitHub Secrets, never in code
3. **Network**: Use `127.0.0.1:8000` binding (localhost only), expose via reverse proxy
4. **Images**: Use specific versions for production, not just `:latest`
5. **Logs**: Regularly rotate and archive logs

## Next Steps

- Set up reverse proxy (Nginx/Caddy) for HTTPS
- Configure monitoring (Prometheus/Grafana)
- Set up log aggregation (ELK/Loki)
- Configure automated backups
- Set up alerts for deployment failures

#### 5. Verify Deployment

```bash
# Check containers are running
docker ps

# Check API logs
docker logs -f zigscan-api

# Check PostgreSQL logs
docker logs -f zigscan-postgres

# Test API endpoint
curl http://localhost:8000/api/v2/tvl

# Check database
docker exec -it zigscan-postgres psql -U zigscan -d zigscan_production -c "SELECT COUNT(*) FROM tvl_snapshots;"
```

#### 6. Monitor TVL Captures

The service captures TVL data every hour automatically:

```bash
# Watch logs for capture events
docker logs -f zigscan-api | grep TVL

# Expected output every hour:
# [TvlService] Captured TVL snapshot: OroSwap=... ZIG, Valdora=... ZIG
# [TvlService] Persisted TVL snapshot at 2025-10-24T...
```

### Option 2: External PostgreSQL Database

If using a managed PostgreSQL service (AWS RDS, DigitalOcean, etc.):

#### 1. Create PostgreSQL Database

Create a database on your cloud provider:
- PostgreSQL 14+
- At least 1GB RAM
- 10GB storage (grows with data)

#### 2. Update Server `.env`

```bash
POSTGRES_HOST=your-db-host.aws.com
POSTGRES_PORT=5432
POSTGRES_USER=zigscan
POSTGRES_PASSWORD=<your-password>
POSTGRES_DB=zigscan_production
POSTGRES_SSL=true  # Enable for remote connections
TYPEORM_SYNC=false
TYPEORM_LOGGING=false
NODE_ENV=production
```

#### 3. Update `docker-compose.yml`

Remove the PostgreSQL service (only keep API):

```yaml
services:
  zigscan-api:
    image: ${IMAGE_NAME:-zigscan-api:local}
    build:
      context: ..
      dockerfile: Dockerfile
    container_name: zigscan-api
    restart: unless-stopped
    env_file:
      - ../.env
    ports:
      - "${APP_PORT:-8000}:8000"

# Remove postgres service, volumes, and networks
```

#### 4. Deploy and Run Migrations

```bash
cd deploy
docker compose up -d --build

# Run migrations
docker exec -it zigscan-api npm run migration:run
```

## CI/CD Integration

Update your GitHub Actions workflow to include database migrations:

### Update `.github/workflows/deploy.yml`

Add migration step after container restart:

```yaml
# ... existing steps ...

- name: Restart Container
  run: |
    docker compose down
    docker compose pull
    docker compose up -d

- name: Run Database Migrations
  run: |
    sleep 10  # Wait for container to be ready
    docker exec zigscan-api npm run migration:run || echo "Migrations already applied"

- name: Verify Deployment
  run: |
    docker ps
    curl -f http://localhost:8000/api/v2/health || exit 1
```

## Data Backup Strategy

### Automated Backups with Cron

Create backup script on server:

```bash
#!/bin/bash
# /opt/zigscan-api/backup.sh

BACKUP_DIR="/opt/zigscan-api/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/zigscan_$DATE.sql"

mkdir -p $BACKUP_DIR

# Backup database
docker exec zigscan-postgres pg_dump -U zigscan zigscan_production > $BACKUP_FILE

# Compress
gzip $BACKUP_FILE

# Keep only last 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

Add to crontab:
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/zigscan-api/backup.sh >> /opt/zigscan-api/backup.log 2>&1
```

### Manual Backup

```bash
# Backup
docker exec zigscan-postgres pg_dump -U zigscan zigscan_production > backup.sql

# Restore
docker exec -i zigscan-postgres psql -U zigscan zigscan_production < backup.sql
```

## Monitoring

### Check TVL Data

```bash
# Latest snapshot
docker exec zigscan-postgres psql -U zigscan -d zigscan_production -c \
  "SELECT * FROM tvl_snapshots ORDER BY timestamp DESC LIMIT 1;"

# Count snapshots
docker exec zigscan-postgres psql -U zigscan -d zigscan_production -c \
  "SELECT COUNT(*) FROM tvl_snapshots;"

# Check hourly captures
docker exec zigscan-postgres psql -U zigscan -d zigscan_production -c \
  "SELECT timestamp, \"totalTvl\" FROM tvl_snapshots ORDER BY timestamp DESC LIMIT 24;"
```

### View Logs

```bash
# API logs
docker logs -f zigscan-api

# PostgreSQL logs
docker logs -f zigscan-postgres

# Filter TVL captures
docker logs zigscan-api 2>&1 | grep "TVL snapshot"
```

## Scaling Considerations

### For High Traffic

1. **Use external managed PostgreSQL** (AWS RDS, DigitalOcean Managed DB)
2. **Enable connection pooling** (already configured in TypeORM)
3. **Add read replicas** for API queries
4. **Increase container resources**:

```yaml
services:
  zigscan-api:
    # ... existing config ...
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          memory: 1G
```

### For Multiple Regions

Use PostgreSQL replication:
- Primary database for writes (TVL captures)
- Read replicas in other regions for API queries

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs zigscan-api
docker logs zigscan-postgres

# Check network
docker network inspect zigscan-network

# Restart containers
docker compose restart
```

### Database Connection Issues

```bash
# Test connection from API container
docker exec -it zigscan-api sh
apk add postgresql-client
psql -h postgres -U zigscan -d zigscan_production

# Check PostgreSQL is listening
docker exec zigscan-postgres pg_isready -U zigscan
```

### Migration Errors

```bash
# Revert last migration
docker exec zigscan-api npm run migration:revert

# Re-run migrations
docker exec zigscan-api npm run migration:run

# Check migration status
docker exec zigscan-postgres psql -U zigscan -d zigscan_production -c "SELECT * FROM migrations;"
```

### No TVL Data Being Captured

```bash
# Check service logs
docker logs zigscan-api 2>&1 | grep TvlService

# Manually trigger capture (for testing)
docker exec zigscan-api node -e "
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
(async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  const tvlService = app.get('TvlService');
  await tvlService.captureSnapshotSafe();
  await app.close();
})();
"
```

## Security Checklist

- [ ] Changed default PostgreSQL password
- [ ] Database not exposed to public internet (use internal networking)
- [ ] `.env` file has proper permissions (600)
- [ ] Backups are encrypted and stored securely
- [ ] SSL enabled for remote database connections
- [ ] API keys rotated regularly
- [ ] Container images scanned for vulnerabilities

## Rollback Procedure

If deployment fails:

```bash
# Stop new containers
docker compose down

# Restore previous image
docker compose pull  # or use specific tag
docker compose up -d

# Restore database from backup
docker exec -i zigscan-postgres psql -U zigscan zigscan_production < backup.sql
```

## Support

For issues:
1. Check logs first: `docker logs zigscan-api`
2. Verify environment variables are set correctly
3. Test database connectivity
4. Check GitHub Actions workflow logs
