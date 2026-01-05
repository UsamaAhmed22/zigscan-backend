#!/usr/bin/env node
/**
 * Test SSH Tunnel Connection
 * 
 * This script tests the SSH tunnel and PostgreSQL connection independently
 * to help debug connection issues.
 */

require('dotenv').config();
const { createTunnel } = require('tunnel-ssh');
const { readFileSync } = require('fs');
const axios = require('axios');

async function testConnection() {
  console.log('🔧 Testing SSH Tunnel and ClickHouse Connection...\n');

  // Configuration from .env
  const privateKeyPath = process.env.SSH_PRIVATE_KEY || '/home/ubuntu/.ssh/primary';
  const privateKey = readFileSync(privateKeyPath, 'utf8');

  const config = {
    ssh: {
      host: process.env.SSH_HOST || '141.95.66.30',
      port: parseInt(process.env.SSH_PORT || '22'),
      username: process.env.SSH_USERNAME || 'ubuntu',
      privateKey: privateKey,
      ...(process.env.SSH_PASSPHRASE ? { passphrase: process.env.SSH_PASSPHRASE } : {}),
    },
    forward: {
      srcAddr: process.env.SSH_LOCAL_HOST || '127.0.0.1',
      srcPort: parseInt(process.env.SSH_LOCAL_PORT || '8123'),
      dstAddr: process.env.SSH_REMOTE_HOST || '127.0.0.1',
      dstPort: parseInt(process.env.SSH_REMOTE_PORT || '8123'),
    },
    clickhouse: {
      url: (process.env.ZIGSCAN_CLICKHOUSE_URL || 'http://127.0.0.1:8123')
        .split(',')[0]
        .trim(),
      username: process.env.ZIGSCAN_CLICKHOUSE_USERNAME || 'default',
      password: process.env.ZIGSCAN_CLICKHOUSE_PASSWORD || '',
      database: process.env.ZIGSCAN_CLICKHOUSE_DATABASE || 'zigchain_mainnet_indexer',
    },
  };

  console.log('📋 Configuration:');
  console.log(`   SSH Host: ${config.ssh.host}:${config.ssh.port}`);
  console.log(`   SSH User: ${config.ssh.username}`);
  console.log(`   SSH Key: ${privateKeyPath}`);
  console.log(`   SSH Passphrase: ${process.env.SSH_PASSPHRASE ? '✓ Set' : '✗ Not set'}`);
  console.log(
    `   Forward: ${config.forward.srcAddr}:${config.forward.srcPort} -> ${config.forward.dstAddr}:${config.forward.dstPort}`,
  );
  console.log(`   ClickHouse URL: ${config.clickhouse.url}`);
  console.log(`   ClickHouse DB: ${config.clickhouse.database}\n`);

  let tunnel = null;
  let clickhouseClient = null;

  try {
    // Step 1: Create SSH Tunnel
    console.log('📡 Step 1: Creating SSH tunnel...');
    
    tunnel = await createTunnel(
      { autoClose: true, reconnectOnError: false },
      {},
      config.ssh,
      config.forward
    );

    console.log('✅ SSH tunnel established!\n');

    // Wait a moment for tunnel to stabilize
    console.log('⏳ Waiting for tunnel to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 2: Test ClickHouse Connection
    console.log('🔌 Step 2: Testing ClickHouse connection through tunnel...');
    clickhouseClient = axios.create({
      baseURL: config.clickhouse.url,
      auth: {
        username: config.clickhouse.username,
        password: config.clickhouse.password,
      },
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' },
    });

    console.log('   Attempting to run SELECT 1...');
    await clickhouseClient.post(
      '',
      { sql: 'SELECT 1' },
      {
        params: {
          database: config.clickhouse.database,
          format: 'JSON',
        },
      },
    );
    console.log('✅ ClickHouse connected!\n');

    // Step 3: Verify required tables exist
    console.log('🔍 Step 3: Checking for required tables...');
    const tablesSql = `
      SELECT name
      FROM system.tables
      WHERE database = '${config.clickhouse.database}'
        AND name IN ('tx_event_attrs_json', 'txs', 'blocks')
      ORDER BY name
    `;

    const tableResponse = await clickhouseClient.post(
      '',
      { sql: tablesSql },
      {
        params: {
          database: config.clickhouse.database,
          format: 'JSON',
        },
      },
    );

    const tables = tableResponse.data?.data || [];
    if (tables.length > 0) {
      console.log('✅ Found tables:');
      tables.forEach(row => console.log(`   - ${row.name}`));
    } else {
      console.log('⚠️  No required tables found');
    }

    console.log('\n🎉 All tests passed! Connection is working correctly.\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Verify SSH key has correct permissions: chmod 600', privateKeyPath);
    console.error('2. Check if SSH_PASSPHRASE is set correctly in .env');
    console.error('3. Test SSH manually: ssh -i', privateKeyPath, config.ssh.username + '@' + config.ssh.host);
    console.error('4. Check if ClickHouse is running on remote: systemctl status clickhouse-server');
    console.error('5. Verify port', config.forward.srcPort, 'is not already in use: lsof -i :' + config.forward.srcPort);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (tunnel) {
      const [server, client] = tunnel;
      server.close();
      client.end();
    }
  }
}

testConnection().catch(console.error);
