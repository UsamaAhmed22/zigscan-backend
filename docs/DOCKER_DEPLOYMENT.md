# Docker Deployment Guide

## Overview

The simplified CI/CD workflow builds a Docker image and pushes it to Docker Hub with automatic tagging. No server deployment or SSH tunnels are included in the workflow.

## How It Works

### Triggers
- **Push to `main` branch**: Builds and tags as `latest`
- **Push to `development` branch**: Builds and tags as `development`
- **Manual trigger**: Via GitHub Actions UI

### Automatic Tags Generated

The workflow creates multiple tags for flexibility:

1. **`latest`** - Only for main branch (production)
2. **Branch name** - e.g., `development`, `main`
3. **Git SHA** - e.g., `main-abc1234`, `development-xyz5678`
4. **Semantic version** - If you tag releases (e.g., `v1.2.3`, `1.2`)

### Example Tags

When you push to `development` branch with commit `abc1234`:
```
yourname/zigscan-api:development
yourname/zigscan-api:development-abc1234
```

When you push to `main` branch:
```
yourname/zigscan-api:latest
yourname/zigscan-api:main
yourname/zigscan-api:main-xyz5678
```

## Setup Instructions

### 1. Create Docker Hub Account

1. Go to [hub.docker.com](https://hub.docker.com/)
2. Sign up or login
3. Note your username (e.g., `saadbeenco`)

### 2. Create Docker Hub Access Token

1. Login to Docker Hub
2. Go to **Account Settings** → **Security** → **Access Tokens**
3. Click **New Access Token**
4. Name it: `GitHub Actions - ZigScan API`
5. Permissions: **Read & Write**
6. Click **Generate**
7. **Copy the token** (you won't see it again!)

### 3. Add GitHub Secrets

Go to your GitHub repository:
1. Navigate to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add these secrets:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username | `saadbeenco` |
| `DOCKERHUB_TOKEN` | Your Docker Hub access token | `dckr_pat_abc123...` |

### 4. Push Code to Trigger Build

```bash
# Commit your changes
git add .
git commit -m "Update deployment workflow"

# Push to development branch
git push origin development

# Or push to main branch (production)
git push origin main
```

### 5. Monitor Build

1. Go to **Actions** tab in GitHub
2. Watch the **Build and Push Docker Image** workflow
3. Check for green checkmark ✅

## Pulling the Docker Image

### Pull Latest (Production)

```bash
docker pull yourusername/zigscan-api:latest
```

### Pull Specific Branch

```bash
# Development branch
docker pull yourusername/zigscan-api:development

# Specific commit
docker pull yourusername/zigscan-api:development-abc1234
```

## Running the Docker Container

### Basic Run

```bash
docker run -d \
  --name zigscan-api \
  -p 3000:3000 \
  --env-file .env \
  yourusername/zigscan-api:latest
```

### With Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  api:
    image: yourusername/zigscan-api:latest
    container_name: zigscan-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    networks:
      - zigscan-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  zigscan-network:
    driver: bridge
```

Run it:

```bash
docker-compose up -d
```

### With External Database

If using external PostgreSQL/Redis:

```yaml
version: '3.8'

services:
  api:
    image: yourusername/zigscan-api:latest
    container_name: zigscan-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - POSTGRES_HOST=your-db-host
      - POSTGRES_PORT=5432
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=zigscan_db
      - REDIS_HOST=your-redis-host
      - REDIS_PORT=6379
      # Add all other required env vars
    networks:
      - zigscan-network

networks:
  zigscan-network:
    driver: bridge
```

## Manual Deployment to Server

### Option 1: Pull on Server

SSH into your server and pull the latest image:

```bash
# Pull latest image
docker pull yourusername/zigscan-api:latest

# Stop old container
docker stop zigscan-api
docker rm zigscan-api

# Run new container
docker run -d \
  --name zigscan-api \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /path/to/.env \
  yourusername/zigscan-api:latest

# Check logs
docker logs -f zigscan-api
```

### Option 2: Deploy Script

Create `deploy.sh` on your server:

```bash
#!/bin/bash
set -e

IMAGE_NAME="yourusername/zigscan-api:latest"
CONTAINER_NAME="zigscan-api"

echo "🚀 Pulling latest image..."
docker pull $IMAGE_NAME

echo "🛑 Stopping old container..."
docker stop $CONTAINER_NAME || true
docker rm $CONTAINER_NAME || true

echo "🔄 Starting new container..."
docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /opt/zigscan/.env \
  $IMAGE_NAME

echo "✅ Deployment complete!"
docker ps | grep $CONTAINER_NAME

echo "📋 Checking logs..."
docker logs --tail 50 $CONTAINER_NAME
```

Make it executable and run:

```bash
chmod +x deploy.sh
./deploy.sh
```

### Option 3: Watchtower (Auto-Update)

Use Watchtower to automatically pull and update containers:

```yaml
version: '3.8'

services:
  api:
    image: yourusername/zigscan-api:latest
    container_name: zigscan-api
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    labels:
      - "com.centurylinklabs.watchtower.enable=true"

  watchtower:
    image: containrrr/watchtower
    container_name: watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_POLL_INTERVAL=300  # Check every 5 minutes
      - WATCHTOWER_LABEL_ENABLE=true
    command: --interval 300
```

Watchtower will automatically:
- Check Docker Hub every 5 minutes
- Pull new images when available
- Restart containers with new images
- Clean up old images

## Image Tags Strategy

### Development Workflow

```bash
# Developer pushes to development branch
git push origin development

# CI builds and tags:
# - yourusername/zigscan-api:development
# - yourusername/zigscan-api:development-abc1234

# Test on staging server
docker pull yourusername/zigscan-api:development
docker-compose up -d
```

### Production Release

```bash
# Merge to main after testing
git checkout main
git merge development
git push origin main

# CI builds and tags:
# - yourusername/zigscan-api:latest
# - yourusername/zigscan-api:main
# - yourusername/zigscan-api:main-xyz5678

# Deploy to production
docker pull yourusername/zigscan-api:latest
docker-compose up -d
```

### Rollback to Previous Version

```bash
# List available images
docker images yourusername/zigscan-api

# Rollback to specific SHA
docker pull yourusername/zigscan-api:main-previous-sha
docker run -d --name zigscan-api \
  -p 3000:3000 \
  --env-file .env \
  yourusername/zigscan-api:main-previous-sha
```

## Workflow File Explained

### Location
`.github/workflows/deploy.yml`

### Key Features

1. **Multi-branch support**: Triggers on `main` and `development`
2. **Multiple tags**: Automatic tagging with branch, SHA, semver
3. **Build cache**: Speeds up builds using registry cache
4. **Docker Buildx**: Modern multi-platform builds
5. **Metadata action**: Smart tag generation

### Customization

#### Change Docker Hub Repository Name

In `.github/workflows/deploy.yml`, change:
```yaml
images: ${{ secrets.DOCKERHUB_USERNAME }}/zigscan-api
```

To:
```yaml
images: ${{ secrets.DOCKERHUB_USERNAME }}/your-app-name
```

#### Add More Branches

```yaml
on:
  push:
    branches:
      - main
      - development
      - staging  # Add this
```

#### Change Tag Strategy

```yaml
tags: |
  type=raw,value=latest,enable={{is_default_branch}}
  type=ref,event=branch
  type=sha,prefix={{branch}}-
  type=ref,event=tag  # Add this for git tags
  type=raw,value=stable  # Add this for stable tag
```

## Troubleshooting

### Build Fails

**Check Dockerfile:**
```bash
# Test locally
docker build -t test-image .
```

**Check GitHub Actions logs:**
- Go to Actions tab
- Click on failed workflow
- Expand steps to see errors

### Docker Hub Authentication Fails

**Verify secrets are set correctly:**
1. GitHub → Settings → Secrets → Actions
2. Check `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`
3. Regenerate Docker Hub token if needed

### Image Not Pulling

**Check image name:**
```bash
# List your Docker Hub images
docker search yourusername/zigscan-api

# Try with explicit tag
docker pull yourusername/zigscan-api:latest
```

**Check Docker Hub:**
- Login to hub.docker.com
- Verify repository exists and is public
- Check if images are listed

### Container Won't Start

**Check logs:**
```bash
docker logs zigscan-api
```

**Check environment variables:**
```bash
docker exec zigscan-api env | grep POSTGRES
```

**Check health:**
```bash
docker inspect zigscan-api | grep -A 10 Health
```

## Best Practices

### 1. Use Specific Tags in Production

❌ Bad:
```yaml
image: yourusername/zigscan-api:latest
```

✅ Good:
```yaml
image: yourusername/zigscan-api:main-abc1234
```

### 2. Test Before Production

```bash
# Test development image first
docker pull yourusername/zigscan-api:development
docker run --name test-api -p 3001:3000 --env-file .env.test yourusername/zigscan-api:development

# If successful, promote to production
git checkout main
git merge development
git push
```

### 3. Monitor Image Size

```bash
# Check image size
docker images yourusername/zigscan-api

# If too large, optimize Dockerfile
# - Use multi-stage builds
# - Remove dev dependencies
# - Use alpine base images
```

### 4. Security Scanning

Add to workflow:
```yaml
- name: Run Trivy vulnerability scanner
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ secrets.DOCKERHUB_USERNAME }}/zigscan-api:latest
    format: 'sarif'
    output: 'trivy-results.sarif'
```

## Environment Variables

Make sure your `.env` file on the server has:

```bash
NODE_ENV=production
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Database
POSTGRES_HOST=db-host
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=zigscan_db

# Redis
REDIS_HOST=redis-host
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRATION=24h

# SMTP (SendGrid)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM="ZIGScan <noreply@yourdomain.com>"

# API Keys
API_KEY_ISSUER_EMAILS=admin@zigscan.org
```

## Summary

✅ **Workflow**: Push code → GitHub Actions → Build Docker image → Push to Docker Hub  
✅ **No SSH**: No server deployment included  
✅ **No Tunnels**: No SSH tunnel configuration  
✅ **Flexible**: Pull and run images manually on any server  
✅ **Multi-tag**: Automatic tagging for easy rollback  
✅ **Simple**: Just 2 secrets needed (username + token)  

🚀 **Ready to deploy!** Push your code and watch the magic happen!
