# Quick Deployment Reference

## 🚀 Quick Commands

### Check Deployment Status
```bash
# On server
cd /opt/zigscan-api
docker ps --filter "name=zigscan-api"
docker logs zigscan-api --tail 50
curl http://localhost:8000/api/v2/health
```

### Manual Deploy
```bash
cd /opt/zigscan-api
export IMAGE_NAME="ghcr.io/cryptocomicsdevs/zigscanapi-mainnet-v2:latest"
./deploy.sh
```

### Rollback to Previous Version
```bash
# Automatic rollback (if deployment fails)
# The script does this automatically!

# Manual rollback
docker stop zigscan-api
docker rm zigscan-api
docker rename zigscan-api-old zigscan-api
docker start zigscan-api
```

### Rollback to Specific Version
```bash
# Find available versions
docker images | grep zigscan-api

# Deploy specific SHA
export IMAGE_NAME="ghcr.io/cryptocomicsdevs/zigscanapi-mainnet-v2:sha-abc1234"
./deploy.sh
```

### View Logs
```bash
# Live logs
docker logs -f zigscan-api

# Last 100 lines
docker logs zigscan-api --tail 100

# Search logs
docker logs zigscan-api 2>&1 | grep ERROR
```

### Container Management
```bash
# Restart container
docker restart zigscan-api

# Stop container
docker stop zigscan-api

# Start container
docker start zigscan-api

# Remove container
docker stop zigscan-api && docker rm zigscan-api
```

### Cleanup
```bash
# Remove old images
docker image prune -f

# Remove unused containers
docker container prune -f

# Full cleanup (careful!)
docker system prune -a -f
```

## 🔧 Troubleshooting

### Container Won't Start
```bash
# Check logs
docker logs zigscan-api --tail 200

# Check environment
docker exec zigscan-api env | grep POSTGRES

# Test database connection
docker exec zigscan-api wget -O- http://localhost:8000/api/v2/health
```

### Health Check Failing
```bash
# Check health status
docker inspect zigscan-api | grep -A 10 Health

# Manual health check
curl -v http://localhost:8000/api/v2/health

# From inside container
docker exec zigscan-api wget -O- http://localhost:8000/api/v2/health
```

### Port Conflict
```bash
# Check what's using port 8000
netstat -tlnp | grep 8000
lsof -i :8000

# Kill process using port
kill -9 $(lsof -ti:8000)
```

### Disk Space Issues
```bash
# Check disk usage
df -h
docker system df

# Clean up
docker system prune -a --volumes -f
```

## 📊 Monitoring

### Resource Usage
```bash
# Real-time stats
docker stats zigscan-api

# One-time stats
docker stats zigscan-api --no-stream
```

### Container Info
```bash
# Full container details
docker inspect zigscan-api

# Just health status
docker inspect zigscan-api --format='{{.State.Health.Status}}'

# Port bindings
docker port zigscan-api
```

## 🎯 Common Scenarios

### Deploy New Version
1. Push to `main` branch
2. Wait for GitHub Actions
3. Check logs on server
4. Verify health endpoint

### Emergency Stop
```bash
docker stop zigscan-api
```

### Emergency Rollback
```bash
docker stop zigscan-api
docker rm zigscan-api
docker rename zigscan-api-old zigscan-api
docker start zigscan-api
```

### Update Environment Variables
```bash
cd /opt/zigscan-api
nano .env  # Edit variables
docker restart zigscan-api  # Apply changes
```

### View All Containers (Including Stopped)
```bash
docker ps -a | grep zigscan
```

## 📝 Important Files

- `/opt/zigscan-api/.env` - Environment variables
- `/opt/zigscan-api/docker-compose.yml` - Container config
- `/opt/zigscan-api/deploy.sh` - Deployment script
- `ghcr.io/cryptocomicsdevs/zigscanapi-mainnet-v2` - Docker registry

## 🔐 Security

### Update Secrets
```bash
# On your local machine
cd /path/to/zigscanapi-mainnet-v2
nano .env  # Update values
base64 --wrap=0 .env > env.b64
# Copy env.b64 content to GitHub Secret: ENV_FILE_B64
```

### Issue API Keys
```bash
# Use an allow-listed account (API_KEY_ISSUER_EMAILS) to create keys
curl -X POST https://zigscan.example.com/api/v2/api-keys \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin","label":"my-cli"}'
```

## ⚡ Performance

### Check Build Cache
```bash
# View cached layers
docker buildx du

# Clear build cache
docker buildx prune -f
```

### Optimize Image Size
```bash
# Check image size
docker images | grep zigscan-api

# Remove unused layers
docker image prune -a -f
```
