# How Your CI/CD Workflow Works Now

## 🎯 Overview

Your GitHub Actions workflow now automatically handles PostgreSQL SSH tunnel setup during deployment. Here's what happens when you push to the `main` branch.

---

## 🔄 Deployment Flow

### Step 1: Build Docker Image
```
Push to main → GitHub Actions triggered → Build Docker image
```

**What happens:**
- Checks out your code
- Builds Docker image with Alpine Linux + SSH tools
- Pushes image to GitHub Container Registry (ghcr.io)
- Tags image with `latest` and commit SHA

**Duration:** ~3-5 minutes

---

### Step 2: Upload Files to Server
```
Upload docker-compose.yml and deploy.sh to deployment server
```

**What happens:**
- SSH into your deployment server
- Creates deployment directory if needed
- Copies `docker-compose.yml` and `deploy.sh`

**Duration:** ~10 seconds

---

### Step 3: Setup SSH Tunnel Configuration
```
Configure SSH tunnel for PostgreSQL access
```

**What happens on deployment server:**
1. Decodes `.env` file from base64 secret
2. Creates `~/.ssh/postgres_tunnel_key` from secret
3. Sets permissions to `600` (secure)
4. Appends tunnel configuration to `.env`:
   ```env
   USE_SSH_TUNNEL=true
   SSH_HOST=141.95.66.30
   SSH_USERNAME=ubuntu
   SSH_PRIVATE_KEY=/root/.ssh/tunnel_key
   SSH_PASSPHRASE=<your-passphrase>
   SSH_REMOTE_PORT=5432
   ```

**Duration:** ~5 seconds

---

### Step 4: Deploy Container
```
Run deploy.sh script with automatic rollback
```

**What `deploy.sh` does:**

1. **Pull new image**
   ```bash
   docker compose pull
   ```

2. **Backup current container**
   ```bash
   docker rename zigscan-api zigscan-api-old
   ```

3. **Start new container**
   ```bash
   docker compose up -d --force-recreate
   ```
   
   Inside the container, `start-production.sh` automatically:
   - Detects `USE_SSH_TUNNEL=true`
   - Establishes SSH tunnel: `localhost:5433 → 141.95.66.30:5432`
   - Starts the NestJS application
   - Application connects to PostgreSQL via tunnel

4. **Health check** (60 seconds max)
   ```bash
   curl http://localhost:8000/health
   ```

5. **Success?**
   - ✅ **YES**: Remove old backup container
   - ❌ **NO**: Automatic rollback to previous version

**Duration:** ~1-2 minutes

---

### Step 5: Verification
```
Show deployment status and recent logs
```

**What happens:**
- Shows running containers
- Displays last 20 lines of logs
- Confirms SSH tunnel is active

**Duration:** ~5 seconds

---

## 🏗️ Architecture in Production

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Container                        │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  start-production.sh                                   │ │
│  │  ├─ Setup SSH tunnel (localhost:5433 → 141.95.66.30) │ │
│  │  └─ Start NestJS app                                  │ │
│  │                                                         │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │         NestJS Application                      │  │ │
│  │  │  ┌─────────────┐    ┌────────────────────────┐ │  │ │
│  │  │  │   API       │    │  Database Connections  │ │  │ │
│  │  │  │  Routes     │───▶│  • Local: :5432       │ │  │ │
│  │  │  └─────────────┘    │  • Tunnel: :5433      │ │  │ │
│  │  │                      └────────────────────────┘ │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Port 8000
                           ▼
                    ┌─────────────┐
                    │   Internet  │
                    └─────────────┘

         SSH Tunnel Connection
                │
                ├─────▶ Local PostgreSQL (:5432)
                │       [Metadata, API keys, etc.]
                │
                └─────▶ Remote PostgreSQL via Tunnel (:5433)
                        [Blockchain data on 141.95.66.30]
```

---

## 🔒 Security Features

### 1. SSH Key Handling
- Keys stored as GitHub Secrets (encrypted)
- Mounted read-only into container
- Proper permissions (600) enforced
- Keys never committed to git

### 2. Environment Variables
- Base64 encoded in GitHub Secrets
- Decoded only on deployment server
- Never exposed in logs
- Container environment isolated

### 3. Network Security
- SSH tunnel encrypted (SSH protocol)
- No direct PostgreSQL port exposure
- Container uses host network (for tunnel)
- Automatic tunnel re-establishment on failure

---

## 📊 Monitoring Your Deployment

### GitHub Actions UI

1. Go to your repository
2. Click **"Actions"** tab
3. See deployment status:
   - 🟢 **Success**: Deployment completed
   - 🟡 **In Progress**: Currently deploying
   - 🔴 **Failed**: Deployment failed (check logs)

### View Logs

**During deployment:**
- GitHub Actions → Click on workflow run → Expand steps

**After deployment:**
```bash
# SSH into your server
ssh ubuntu@your-server

# View container logs
docker logs zigscan-api --tail 100 -f

# Check if tunnel is running
ps aux | grep ssh
lsof -i :5433

# Test API
curl http://localhost:8000/health
```

---

## 🚨 Automatic Rollback

If deployment fails, the system **automatically rolls back**:

1. **Health check fails** (after 60 seconds)
2. **Stop failed container**
3. **Restore previous container** from backup
4. **Restart old container**
5. **Notify you** in GitHub Actions

**Your API stays up!** Zero downtime on failed deployments.

---

## ✅ What You Need to Do

### One-Time Setup (Required)

1. **Add GitHub Secrets** (see `GITHUB-SECRETS-SETUP.md`)
   ```
   ✓ SSH_HOST
   ✓ SSH_USER
   ✓ SSH_PRIVATE_KEY
   ✓ SERVER_DEPLOY_PATH
   ✓ POSTGRES_SSH_KEY
   ✓ POSTGRES_SSH_HOST
   ✓ POSTGRES_SSH_USER
   ✓ POSTGRES_SSH_PASSPHRASE
   ✓ GHCR_USERNAME
   ✓ GHCR_TOKEN
   ✓ ENV_FILE_B64
   ```

2. **Setup deployment server**
   ```bash
   # SSH into server
   ssh ubuntu@your-server
   
   # Create deployment directory
   mkdir -p /home/ubuntu/zigscan-api
   
   # Install Docker (if not installed)
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker ubuntu
   
   # Logout and login again for docker group
   ```

3. **Test SSH access**
   ```bash
   # From your local machine
   ssh -i ~/.ssh/your_key ubuntu@your-server
   ssh -i ~/.ssh/tunnel_key ubuntu@141.95.66.30
   ```

### Regular Usage (Every Deployment)

**That's it! Just push code:**

```bash
git add .
git commit -m "Your changes"
git push origin main
```

GitHub Actions handles everything else automatically!

---

## 🎬 Example Deployment

**Developer pushes code:**
```bash
$ git push origin main
Enumerating objects: 5, done.
Counting objects: 100% (5/5), done.
Writing objects: 100% (3/3), 291 bytes | 291.00 KiB/s, done.
To github.com:cryptocomicsdevs/zigscanapi-mainnet-v2.git
   abc1234..def5678  main -> main
```

**GitHub Actions starts:**
```
✓ Checkout repository
✓ Build Docker image (3m 24s)
✓ Push to registry (1m 12s)
✓ Upload files to server (8s)
✓ Deploy container (1m 45s)
  ├─ Pull image
  ├─ Backup current container
  ├─ Start new container
  │  └─ SSH tunnel established ✓
  ├─ Health check passed ✓
  └─ Cleanup old container
✓ Deployment complete!
```

**Total time:** ~6-7 minutes

---

## 🐛 Troubleshooting

### Deployment Fails at "Deploy Container"

**Check:**
1. GitHub Actions logs for error message
2. Server logs: `docker logs zigscan-api`
3. SSH tunnel: `ssh ubuntu@server "ps aux | grep ssh"`

**Common causes:**
- SSH key passphrase incorrect
- PostgreSQL server unreachable
- Port 5433 already in use

### Health Check Fails

**Check:**
1. Application logs: `docker logs zigscan-api --tail 100`
2. Database connection: `docker exec zigscan-api psql -h localhost -p 5433 -U postgres`
3. SSH tunnel status: `docker exec zigscan-api ps aux | grep ssh`

### Rollback Triggered

**Don't panic!** This is by design. Your old version is still running.

**To fix:**
1. Check GitHub Actions error logs
2. Fix the issue in your code
3. Push again - it will retry

---

## 📞 Quick Commands

```bash
# View deployment status
ssh ubuntu@server "docker ps | grep zigscan-api"

# View logs
ssh ubuntu@server "docker logs zigscan-api -f"

# Restart container
ssh ubuntu@server "cd ~/zigscan-api && docker compose restart"

# Check tunnel
ssh ubuntu@server "docker exec zigscan-api lsof -i :5433"

# Manual rollback (if needed)
ssh ubuntu@server "cd ~/zigscan-api && docker compose down && docker rename zigscan-api-old zigscan-api && docker start zigscan-api"

# Test API
curl https://your-domain.com/health
```

---

## 🎉 Success!

Your CI/CD is now fully automated with PostgreSQL SSH tunnel support. Every push to `main` will:

- ✅ Build and test your code
- ✅ Deploy to production
- ✅ Setup SSH tunnel automatically
- ✅ Verify deployment health
- ✅ Rollback on failure
- ✅ Keep your API running

**No manual intervention needed!** 🚀
