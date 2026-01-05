# SSH Tunnel Setup for ClickHouse Access

This guide explains how to reach the remote ClickHouse indexer when it is only exposed over SSH.

## Overview

The `SshTunnelService` opens an SSH connection to the remote host and forwards a local TCP port (e.g. `127.0.0.1:8123`) to the ClickHouse HTTP port (`8123`) on the remote machine. The API then sends HTTPS/HTTP requests to the local port, which transparently tunnel to ClickHouse.

```
[NestJS API] → localhost:8123 → [SSH Tunnel] → remote:8123 → [ClickHouse]
```

## Configuration

### SSH settings (password or key)

```bash
SSH_TUNNEL_ENABLED=true
SSH_HOST=your-server-ip
SSH_PORT=22
SSH_USERNAME=ubuntu
# Option A - password auth
# SSH_PASSWORD=your-ssh-password
# Option B - private key auth (recommended)
SSH_PRIVATE_KEY=/path/to/private/key
# SSH_PASSPHRASE=my-passphrase  # only if the key is encrypted

SSH_LOCAL_HOST=127.0.0.1
SSH_LOCAL_PORT=8123            # local ClickHouse port
SSH_REMOTE_HOST=127.0.0.1
SSH_REMOTE_PORT=8123           # remote ClickHouse HTTP port
```

### ClickHouse HTTP credentials

```bash
ZIGSCAN_CLICKHOUSE_URL=http://127.0.0.1:8123        # must point to the forwarded port
ZIGSCAN_CLICKHOUSE_USERNAME=ziguser
ZIGSCAN_CLICKHOUSE_PASSWORD=super-secure-password
ZIGSCAN_CLICKHOUSE_DATABASE=zigchain_mainnet_indexer
```

### ZigScan PostgreSQL (same tunnel, new local port)

```bash
ZIGSCAN_POSTGRES_HOST=127.0.0.1
ZIGSCAN_POSTGRES_PORT=5433        # local port forwarded by the SSH tunnel
ZIGSCAN_POSTGRES_USER=postgres
ZIGSCAN_POSTGRES_PASSWORD=your_postgres_password
ZIGSCAN_POSTGRES_DATABASE=zigscan_mainnet
ZIGSCAN_POSTGRES_SSL=false
ZIGSCAN_POSTGRES_REMOTE_HOST=127.0.0.1  # host reachable on the remote machine
ZIGSCAN_POSTGRES_REMOTE_PORT=5432       # remote PostgreSQL port to forward
```

The SSH connection already created for ClickHouse can also be used to reach the PostgreSQL server on the same remote host. Just forward an additional local port to `127.0.0.1:5432` on the remote machine and point your Postgres client at that local port.

When the API starts with `SSH_TUNNEL_ENABLED=true`, `SshTunnelService` now opens both ClickHouse and ZigScan Postgres tunnels automatically using the same SSH credentials, so you no longer need to run a manual `ssh -L …` command to reach Postgres.

> **Tip:** `ZIGSCAN_CLICKHOUSE_URL` supports comma‑separated fallbacks. When using the SSH tunnel, only set the local URL (no commas) so the service always picks the tunneled endpoint.

## How It Works

1. `SshTunnelService` starts with the app and opens the SSH tunnel.
2. `ClickhouseService` waits a few seconds, then creates HTTP clients that talk to `ZIGSCAN_CLICKHOUSE_URL`.
3. Feature services issue SQL statements over HTTP; requests travel through the tunnel and reach the remote ClickHouse instance.

## Testing the Connection

### 1. Manual tunnel check

```bash
# open tunnel
ssh -L 8123:127.0.0.1:8123 ubuntu@your-server-ip -N

# verify ClickHouse responds
curl -u ziguser:ABAK3fqyxdnA \
  'http://127.0.0.1:8123/?database=zigchain_mainnet_indexer&query=SELECT%201'
```

You should see `1` in the response body.

### 2. Automated test script

Run `node test-ssh-tunnel.js`. The script:

1. Opens the SSH tunnel using the `.env` values.
2. Performs `SELECT 1` through the tunnel.
3. Verifies that the required tables (`tx_event_attrs_json`, `txs`, `blocks`) exist.

### 3. Application logs

When the NestJS app starts you should see:

```
[SshTunnelService] Creating SSH tunnel: 127.0.0.1:8123 -> your-server-ip:8123
[SshTunnelService] ✓ SSH tunnel established successfully
[ClickhouseService] Initialized ClickHouse service with 1 connection(s)
```

Use `/api/v2/health` to confirm the API can reach ClickHouse – the response includes `clickhouse: "healthy"` when everything is working.

## Troubleshooting

### Connection refused

1. Confirm SSH credentials.
2. Ensure ClickHouse is listening on `127.0.0.1:8123` on the remote host.
3. Check firewalls/security groups.

```bash
sudo systemctl status clickhouse-server
sudo ss -tlnp | grep 8123
```

### Authentication failures

- For password auth, verify `SSH_PASSWORD`.
- For private keys, ensure the key exists and has `chmod 600`. Supply `SSH_PASSPHRASE` when using encrypted keys.
- Make sure the public key is present in `~/.ssh/authorized_keys` on the remote server.

### Port already in use

If `SSH_LOCAL_PORT` is busy (`listen EADDRINUSE`), pick another unused local port (e.g. `8124`) and update both the tunnel config and `ZIGSCAN_CLICKHOUSE_URL`.

### ClickHouse query failures

If the tunnel works but SQL fails, try running the query manually through `curl` or the `test-ssh-tunnel.js` script to inspect the exact error body returned by ClickHouse.

## Disabling the Tunnel

Set `SSH_TUNNEL_ENABLED=false` when the ClickHouse endpoint is directly reachable (no SSH jump host). Point `ZIGSCAN_CLICKHOUSE_URL` at the public endpoint and restart the service.

## Security Best Practices

1. Prefer SSH keys over passwords.
2. Restrict key permissions (`chmod 600`).
3. Limit SSH ingress to trusted IPs.
4. Keep ClickHouse credentials out of version control – they belong only in `.env` / secrets stores.

## Additional Resources

- [SSH Tunneling Guide](https://www.ssh.com/academy/ssh/tunneling)
- [PostgreSQL Authentication](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html)
