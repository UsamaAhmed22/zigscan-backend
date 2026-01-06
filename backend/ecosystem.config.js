module.exports = {
  apps: [{
    name: 'zigscan-api',
    script: './start-production.sh',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production',
      USE_SSH_TUNNEL: 'true'
    },
    env_production: {
      NODE_ENV: 'production',
      USE_SSH_TUNNEL: 'true'
    },
    env_development: {
      NODE_ENV: 'development',
      USE_SSH_TUNNEL: 'true'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    // Graceful shutdown
    shutdown_with_message: false,
    kill_timeout: 5000
  }]
};
