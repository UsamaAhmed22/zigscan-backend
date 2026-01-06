#!/bin/bash
set -e

echo "🚀 Starting ZigScan API"
echo "================================================"

# Default to true (prior behavior) but let NestJS manage the tunnel when configured to.
USE_SSH_TUNNEL=${USE_SSH_TUNNEL:-"true"}
if [ "${SSH_TUNNEL_ENABLED}" = "true" ] && [ "${USE_SSH_TUNNEL}" = "true" ]; then
    echo "ℹ️  SSH_TUNNEL_ENABLED=true, skipping entrypoint tunnel so NestJS can manage the connection."
    USE_SSH_TUNNEL=false
fi

# Function to cleanup SSH tunnel on exit
cleanup() {
    echo "🧹 Cleaning up..."
    if [ -n "$SSH_TUNNEL_PID" ]; then
        kill "$SSH_TUNNEL_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGTERM SIGINT EXIT

# Setup SSH tunnel if enabled
if [ "${USE_SSH_TUNNEL}" = "true" ]; then
    echo "🔌 Setting up SSH tunnel..."
    
    # Get configuration from environment
    SSH_HOST=${SSH_HOST:-"141.95.66.30"}
    SSH_USER=${SSH_USERNAME:-"ubuntu"}
    SSH_KEY=${SSH_PRIVATE_KEY:-"/root/.ssh/zigscan_database_connection_ovh"}
    LOCAL_PORT=${SSH_LOCAL_PORT:-8123}
    REMOTE_PORT=${SSH_REMOTE_PORT:-8123}
    
    # Check if SSH key exists
    if [ ! -f "$SSH_KEY" ]; then
        echo "⚠️  SSH key not found at $SSH_KEY"
        echo "⚠️  Continuing without SSH tunnel..."
        USE_SSH_TUNNEL=false
    else
        echo "📍 Tunnel: localhost:${LOCAL_PORT} -> ${SSH_HOST}:${REMOTE_PORT}"
        
        # Set proper permissions
        chmod 600 "$SSH_KEY" 2>/dev/null || true
        
        # Kill any existing process on the port
        fuser -k ${LOCAL_PORT}/tcp 2>/dev/null || true
        sleep 1
        
        # SSH connection options
        SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR"
        
        # Verify SSH key file exists and is readable
        if [ ! -r "$SSH_KEY" ]; then
            echo "❌ ERROR: SSH key file not readable at: $SSH_KEY"
            ls -la "$SSH_KEY" 2>/dev/null || echo "   File does not exist"
            exit 1
        fi
        
        echo "🔍 Debug info:"
        echo "   SSH Host: ${SSH_USER}@${SSH_HOST}"
        echo "   SSH Key: $SSH_KEY"
        echo "   Key exists: $([ -f "$SSH_KEY" ] && echo "YES" || echo "NO")"
        echo "   Key permissions: $(ls -l "$SSH_KEY" 2>/dev/null | awk '{print $1}')"
        echo "   Key size: $(wc -c < "$SSH_KEY" 2>/dev/null || echo "unknown") bytes"
        
        # Test SSH connection first
        echo "🔌 Testing SSH connection..."
        if ssh -i "$SSH_KEY" \
            -o ConnectTimeout=10 \
            -o ConnectionAttempts=1 \
            -o BatchMode=yes \
            $SSH_OPTS \
            "${SSH_USER}@${SSH_HOST}" "exit 0" 2>/dev/null; then
            echo "✅ SSH authentication successful"
        else
            SSH_EXIT=$?
            echo "❌ ERROR: SSH authentication failed (exit code: $SSH_EXIT)"
            echo ""
            echo "Troubleshooting:"
            echo "  1. Ensure the SSH key is authorized on the remote server"
            echo "  2. If the key has a passphrase, you need to:"
            echo "     a) Mount a decrypted key, OR"
            echo "     b) Use ssh-agent to handle the passphrase"
            echo ""
            echo "Current setup:"
            echo "  SSH Host: ${SSH_USER}@${SSH_HOST}"
            echo "  SSH Key: $SSH_KEY"
            exit 1
        fi
        
        # Start SSH tunnel
        echo "🔌 Establishing SSH tunnel..."
        if ! ssh -f -N \
            -i "$SSH_KEY" \
            -L "${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT}" \
            -o ServerAliveInterval=60 \
            -o ServerAliveCountMax=3 \
            -o ExitOnForwardFailure=yes \
            $SSH_OPTS \
            "${SSH_USER}@${SSH_HOST}"; then
            echo "❌ ERROR: Failed to establish SSH tunnel"
            echo "   Possible causes:"
            echo "     → Port ${LOCAL_PORT} is already in use locally"
            echo "     → Remote port ${REMOTE_PORT} is not accessible"
            echo "     → Network connectivity issues"
            exit 1
        fi
        
        # Wait for tunnel to establish
        sleep 3
        
        # Find tunnel PID
        SSH_TUNNEL_PID=$(pgrep -f "ssh.*${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT}" | head -1)
        
        if [ -n "$SSH_TUNNEL_PID" ]; then
            echo "✅ SSH tunnel established (PID: $SSH_TUNNEL_PID)"
        else
            echo "⚠️  Could not verify SSH tunnel PID"
        fi
        
        # Test if port is listening
        sleep 2
        if nc -z localhost ${LOCAL_PORT} 2>/dev/null; then
            echo "✅ Port ${LOCAL_PORT} is listening"
        else
            echo "⚠️  Port ${LOCAL_PORT} might not be ready yet"
        fi
    fi
else
    echo "ℹ️  SSH tunnel disabled (USE_SSH_TUNNEL=${USE_SSH_TUNNEL})"
fi

echo "================================================"
echo "🚀 Starting NestJS application..."
echo ""

# Start the application
exec node dist/main.js
