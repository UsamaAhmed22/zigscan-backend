# GitHub Secrets Setup Guide for ZigScan API CI/CD

This guide explains how to configure GitHub Secrets for your CI/CD pipeline to work with PostgreSQL SSH tunneling.

## 🔐 Required GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** → Click **"New repository secret"**

### 1. Deployment Server Secrets

#### `SSH_HOST`
- **Description**: IP address or hostname of your deployment server
- **Example**: `123.45.67.89` or `api.yourdomain.com`
- **How to get it**: Your server's public IP or domain name

#### `SSH_USER`
- **Description**: SSH username for deployment server
- **Example**: `ubuntu` or `deploy`
- **How to get it**: The username you use to SSH into your server

#### `SSH_PRIVATE_KEY`
- **Description**: SSH private key for deployment server access
- **How to get it**:
  ```bash
  # On your local machine or CI runner
  cat ~/.ssh/id_rsa
  # Copy the entire output including BEGIN and END lines
  ```
- **Format**:
  ```
  -----BEGIN OPENSSH PRIVATE KEY-----
  b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn
  ... (many lines)
  -----END OPENSSH PRIVATE KEY-----
  ```

#### `SERVER_DEPLOY_PATH`
- **Description**: Directory path on deployment server where app will be deployed
- **Example**: `/home/ubuntu/zigscan-api`
- **How to set up**:
  ```bash
  # SSH into your server and create the directory
  ssh ubuntu@your-server.com
  mkdir -p /home/ubuntu/zigscan-api
  ```

---

### 2. PostgreSQL SSH Tunnel Secrets

These secrets are for connecting to your remote PostgreSQL database via SSH tunnel.

#### `POSTGRES_SSH_KEY`
- **Description**: SSH private key for PostgreSQL server tunnel (141.95.66.30)
- **How to get it**:
  ```bash
  cat /home/ubuntu/.ssh/primary
  # or wherever your PostgreSQL SSH key is located
  ```
- **Format**: Same as SSH_PRIVATE_KEY above

#### `POSTGRES_SSH_HOST`
- **Description**: PostgreSQL server hostname/IP
- **Example**: `141.95.66.30`
- **Current Value**: `141.95.66.30` (from your .env)

#### `POSTGRES_SSH_USER`
- **Description**: SSH username for PostgreSQL server
- **Example**: `ubuntu`
- **Current Value**: `ubuntu` (from your .env)

#### `POSTGRES_SSH_PASSPHRASE`
- **Description**: Passphrase for the PostgreSQL SSH key (if encrypted)
- **Example**: `your-secure-passphrase`
- **Current Value**: From your `SSH_PASSPHRASE` in .env
- **Note**: Leave empty if your key is not encrypted

---

### 3. Docker Registry Secrets

#### `GHCR_USERNAME`
- **Description**: GitHub username for GitHub Container Registry
- **Example**: Your GitHub username
- **How to get it**: Your GitHub profile name

#### `GHCR_TOKEN`
- **Description**: GitHub Personal Access Token for GHCR
- **How to create**:
  1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
  2. Click "Generate new token (classic)"
  3. Select scopes: `write:packages`, `read:packages`, `delete:packages`
  4. Generate and copy the token
  5. **Save it immediately** (you won't see it again)

---

### 4. Application Environment Secrets

#### `ENV_FILE_B64`
- **Description**: Base64-encoded .env file with all application configuration
- **How to create**:
  ```bash
  # On your local machine
  cd /path/to/zigscanapi-mainnet-v2
  
  # Create a production .env file
  cat > .env.production << 'EOF'
  # Application Settings
  NODE_ENV=production
  ZIGSCAN_REQUIRE_AUTH=true
  API_KEY_ISSUER_EMAILS=admin@zigscan.org
  ZIGSCAN_API=https://zigchain-mainnet-api.wickhub.cc
  ZIGSCAN_RPC=https://zigchain-mainnet-rpc-sanatry-01.wickhub.cc
  DEGENTER_API=https://dev-api.degenter.io
  COINGECKO_ZIG_ID=zignaly
  COINGECKO_API_KEY=your-coingecko-key
  
  # Local PostgreSQL (for metadata)
  POSTGRES_HOST=localhost
  POSTGRES_PORT=5432
  POSTGRES_USER=postgres
  POSTGRES_PASSWORD=your_password
  POSTGRES_DB=saad_test_db
  POSTGRES_SSL=false
  TYPEORM_LOGGING=false
  TYPEORM_SYNC=false
  
  # Remote ClickHouse via SSH Tunnel
  ZIGSCAN_CLICKHOUSE_URL=http://127.0.0.1:8123
  ZIGSCAN_CLICKHOUSE_USERNAME=ziguser
  ZIGSCAN_CLICKHOUSE_PASSWORD=ABAK3fqyxdnA
  ZIGSCAN_CLICKHOUSE_DATABASE=zigchain_mainnet_indexer
  EOF
  
  # Encode to base64
  base64 -w 0 .env.production
  
  # Copy the output and paste as secret value
  ```

---

## 📋 Complete Secrets Checklist

Copy this checklist and mark each secret as you add it:

```
Deployment Server:
[ ] SSH_HOST
[ ] SSH_USER
[ ] SSH_PRIVATE_KEY
[ ] SERVER_DEPLOY_PATH

ClickHouse Tunnel:
[ ] SSH_HOST (value: 141.95.66.30)
[ ] SSH_USERNAME (value: ubuntu)
[ ] SSH_PRIVATE_KEY / SSH_PASSWORD
[ ] ZIGSCAN_CLICKHOUSE_URL
[ ] ZIGSCAN_CLICKHOUSE_USERNAME
[ ] ZIGSCAN_CLICKHOUSE_PASSWORD
[ ] ZIGSCAN_CLICKHOUSE_DATABASE

Docker Registry:
[ ] GHCR_USERNAME
[ ] GHCR_TOKEN

Application Config:
[ ] ENV_FILE_B64
```

---

## 🧪 Testing the Setup

### 1. Test SSH Access to Deployment Server

```bash
ssh -i ~/.ssh/your_deploy_key ubuntu@your-server-ip
```

### 2. Test SSH Access to ClickHouse Server

```bash
ssh -i /home/ubuntu/.ssh/primary ubuntu@141.95.66.30
```

### 3. Test ClickHouse Connection via Tunnel

```bash
# On deployment server
ssh -L 8123:127.0.0.1:8123 -i ~/.ssh/postgres_tunnel_key ubuntu@141.95.66.30 -N &
curl -u ziguser:ABAK3fqyxdnA "http://127.0.0.1:8123/?database=zigchain_mainnet_indexer&query=SELECT%201"
```

### 4. Trigger GitHub Actions

```bash
# Push to main branch
git push origin main

# Or manually trigger from GitHub UI
# Go to: Actions → Deploy ZigScan API → Run workflow
```

---

## 🔧 Troubleshooting

### Secret Not Working

1. **Check secret name**: Must match exactly (case-sensitive)
2. **Check for extra spaces**: Don't add spaces before/after secret value
3. **Re-add the secret**: Delete and recreate if unsure

### SSH Key Issues

```bash
# Verify key format
head -1 ~/.ssh/your_key
# Should show: -----BEGIN OPENSSH PRIVATE KEY-----

# Check key permissions
chmod 600 ~/.ssh/your_key

# Test key
ssh-keygen -y -f ~/.ssh/your_key
```

### Base64 Encoding Issues

```bash
# Linux/Mac
base64 -w 0 .env.production

# Mac alternative
base64 -i .env.production

# Verify decoding works
echo "your-base64-string" | base64 -d
```

### View GitHub Actions Logs

1. Go to repository → **Actions** tab
2. Click on the workflow run
3. Click on job name (e.g., "build-and-deploy")
4. Expand steps to see detailed logs
5. Look for errors related to secrets

---

## 🔒 Security Best Practices

1. **Never commit secrets to git**
   ```bash
   # Add to .gitignore
   .env*
   *.key
   *.pem
   secrets/
   ```

2. **Rotate secrets regularly**
   - Change SSH keys every 6 months
   - Rotate API keys quarterly
   - Update tokens when team members leave

3. **Use environment-specific secrets**
   - Separate secrets for dev/staging/prod
   - Use GitHub Environments for better control

4. **Limit secret access**
   - Only add necessary secrets
   - Use GitHub Environments to restrict access
   - Audit secret usage in Actions logs

5. **Encrypt sensitive data**
   - Use SSH key passphrases
   - Encrypt database backups
   - Use HTTPS for all connections

---

## 📚 Additional Resources

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [SSH Key Generation Guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)

---

## ✅ Verification Commands

After setting up all secrets, verify your deployment:

```bash
# 1. Check GitHub Actions logs
# 2. Verify container is running
ssh ubuntu@your-server "docker ps | grep zigscan-api"

# 3. Test API health
curl https://your-api-domain.com/health

# 4. Check tunnel is working
ssh ubuntu@your-server "lsof -i :5433"

# 5. View application logs
ssh ubuntu@your-server "docker logs zigscan-api --tail 50"
```

---

## 🆘 Need Help?

If you encounter issues:

1. **Check the workflow file**: `.github/workflows/deploy.yml`
2. **Review GitHub Actions logs**: Look for specific error messages
3. **Test components individually**: SSH, Docker, PostgreSQL tunnel
4. **Verify all secrets are set**: Go through the checklist above

Common issues:
- ❌ `Permission denied (publickey)` → Check SSH_PRIVATE_KEY format
- ❌ `Error: No such file or directory` → Check SERVER_DEPLOY_PATH exists
- ❌ `connection refused` → Check POSTGRES_SSH_HOST and firewall
- ❌ `Bad decrypt` → Check POSTGRES_SSH_PASSPHRASE is correct
