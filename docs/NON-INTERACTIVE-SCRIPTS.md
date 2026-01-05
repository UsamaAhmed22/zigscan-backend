# Non-Interactive Scripts Configuration

All scripts in this project are configured to run **without user interaction**, making them suitable for CI/CD pipelines and automated deployments.

## ✅ Non-Interactive Scripts

### 1. `docker-entrypoint.sh` ✓
**Purpose**: Container startup and SSH tunnel setup

**Behavior**: 
- ✅ No prompts
- ✅ Runs automatically in Docker
- ✅ Checks environment variables
- ✅ Handles errors gracefully
- ✅ Supports both with/without SSH passphrase

**Usage**:
```bash
# Runs automatically when container starts
docker run zigscan-api
```

---

### 2. `start-production.sh` ✓
**Purpose**: Production startup with SSH tunnel (for PM2 deployments)

**Behavior**:
- ✅ No prompts
- ✅ Auto-detects environment
- ✅ Sets up SSH tunnel if enabled
- ✅ Starts application automatically

**Usage**:
```bash
# Direct execution
./start-production.sh

# With PM2
pm2 start ecosystem.config.js
```

---

### 3. `start-with-tunnel.sh` ✓
**Purpose**: Development startup with SSH tunnel

**Behavior**:
- ✅ No prompts
- ✅ Establishes tunnel
- ✅ Starts dev server
- ✅ Cleans up on exit

**Usage**:
```bash
./start-with-tunnel.sh
# or
npm run start:tunnel
```

---

### 4. `start-simple.sh` ✓
**Purpose**: Simple startup without SSH tunnel

**Behavior**:
- ✅ No prompts
- ✅ Minimal configuration checks
- ✅ Starts application directly

**Usage**:
```bash
./start-simple.sh
# or
npm run start:simple
```

---

### 5. `validate-docker.sh` ✓
**Purpose**: Validate Docker setup

**Behavior**:
- ✅ No prompts by default
- ✅ Validates configuration
- ✅ Optional build with `--build` flag
- ✅ Auto-builds in CI/CD environment

**Usage**:
```bash
# Validate only (no prompts)
./validate-docker.sh

# Validate and build (no prompts)
./validate-docker.sh --build

# In CI/CD (auto-detected, no prompts)
CI=true ./validate-docker.sh
```

---

### 6. `deploy/deploy.sh` ✓
**Purpose**: Production deployment script

**Behavior**:
- ✅ No prompts
- ✅ Automated health checks
- ✅ Automatic rollback on failure
- ✅ Graceful cleanup

**Usage**:
```bash
cd deploy
./deploy.sh
```

---

## 🔧 Environment Variable Control

All scripts use environment variables for configuration. No interactive input required:

```bash
# Core settings
NODE_ENV=production
USE_SSH_TUNNEL=true

# SSH Tunnel settings
SSH_HOST=141.95.66.30
SSH_USERNAME=ubuntu
SSH_PRIVATE_KEY=/path/to/key
SSH_PASSPHRASE=your-passphrase  # Optional
POSTGRES_BACKUP_PORT=5433

# Application settings
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
# ... etc
```

---

## 🤖 CI/CD Compatibility

All scripts are designed for automated environments:

### GitHub Actions
```yaml
- name: Deploy
  run: |
    ./deploy.sh
  env:
    NODE_ENV: production
    USE_SSH_TUNNEL: true
```

### Jenkins
```groovy
sh '''
    export NODE_ENV=production
    ./start-production.sh
'''
```

### GitLab CI
```yaml
deploy:
  script:
    - ./deploy.sh
  variables:
    NODE_ENV: production
```

### Direct Docker
```bash
docker run -e USE_SSH_TUNNEL=true zigscan-api
# No interaction needed
```

---

## 🔐 SSH Passphrase Handling

All scripts handle SSH key passphrases automatically through environment variables:

### Option 1: Unencrypted Key (Recommended for CI/CD)
```bash
# No passphrase needed
SSH_PRIVATE_KEY=/path/to/unencrypted/key
```

### Option 2: Encrypted Key with Passphrase
```bash
# Passphrase provided via env var
SSH_PRIVATE_KEY=/path/to/encrypted/key
SSH_PASSPHRASE=your-secret-passphrase
```

### Option 3: SSH Agent (Alternative)
```bash
# Pre-load key into agent
eval $(ssh-agent -s)
ssh-add /path/to/key
# Then run scripts normally
```

---

## 🚨 Error Handling

All scripts handle errors gracefully without requiring user intervention:

### Automatic Behaviors:
- ✅ SSH tunnel fails → Log warning, continue without tunnel
- ✅ Port in use → Kill existing process, retry
- ✅ Key not found → Log error, skip tunnel setup
- ✅ Database unreachable → Application handles connection retry
- ✅ Build fails → Exit with error code (CI/CD detects failure)
- ✅ Health check fails → Automatic rollback in deploy.sh

### Exit Codes:
- `0` - Success
- `1` - Error (script failed)
- `130` - Interrupted (Ctrl+C)

---

## 📊 Logging

All scripts provide detailed logging without prompts:

```bash
🚀 Starting ZigScan API
================================================
🔌 Setting up SSH tunnel...
📍 Tunnel: localhost:5433 -> 141.95.66.30:5432
✅ SSH tunnel established (PID: 12345)
✅ Port 5433 is listening
================================================
🚀 Starting NestJS application...
```

---

## ✅ Verification

To verify all scripts are non-interactive:

```bash
# Check for interactive commands (should return nothing)
grep -r "read -p" *.sh
grep -r "read -r.*-p" *.sh
grep -r "select " *.sh

# All scripts should run without hanging
timeout 120 ./validate-docker.sh
timeout 120 ./start-simple.sh &  # Background test
```

---

## 🎯 Best Practices

1. **Always set environment variables**
   ```bash
   export $(cat .env | xargs)
   ./script.sh
   ```

2. **Use timeouts in CI/CD**
   ```bash
   timeout 300 ./deploy.sh
   ```

3. **Check exit codes**
   ```bash
   ./script.sh
   if [ $? -eq 0 ]; then
       echo "Success"
   else
       echo "Failed"
       exit 1
   fi
   ```

4. **Redirect output if needed**
   ```bash
   ./script.sh > deployment.log 2>&1
   ```

5. **Use appropriate signals**
   ```bash
   # Graceful shutdown
   kill -SIGTERM $PID
   
   # Force kill if needed
   timeout 30 kill -SIGTERM $PID || kill -SIGKILL $PID
   ```

---

## 📝 Summary

✅ **Zero prompts** - All scripts run fully automated  
✅ **Environment-driven** - Configure via env vars  
✅ **CI/CD ready** - Works in all automation systems  
✅ **Error resilient** - Handles failures gracefully  
✅ **Proper cleanup** - Cleans up resources on exit  
✅ **Detailed logging** - Clear output without interaction  

**Your scripts are ready for production automation!** 🚀
