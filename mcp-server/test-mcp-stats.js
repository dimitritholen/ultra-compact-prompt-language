#!/usr/bin/env node

/**
 * Test if MCP server records statistics correctly
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const STATS_FILE = path.join(os.homedir(), '.ucpl', 'compress', 'compression-stats.json');

async function testMCPStatsRecording() {
  console.log('Testing MCP server statistics recording...\n');

  // Clean up any existing stats
  try {
    await fs.unlink(STATS_FILE);
    console.log('✓ Cleaned up existing stats file');
  } catch (_err) {
    console.log('  (No existing stats file to clean)');
  }

  // Create a test request (simulate MCP client calling compress_code_context)
  const testRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'compress_code_context',
      arguments: {
        path: './scripts/validate_ucpl.py',
        level: 'minimal',
        format: 'summary'
      }
    }
  };

  console.log('\nSending test request to MCP server...');

  const serverPath = path.join(__dirname, 'server.js');
  const proc = spawn('node', [serverPath]);

  let response = '';
  let stderr = '';

  proc.stdout.on('data', (data) => {
    response += data.toString();
  });

  proc.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  // Send the request
  proc.stdin.write(JSON.stringify(testRequest) + '\n');

  // Wait for response
  await new Promise((resolve) => {
    setTimeout(resolve, 2000); // Give it 2 seconds to process
  });

  proc.kill();

  console.log('✓ Request sent\n');

  if (stderr) {
    console.log('STDERR output:');
    console.log(stderr);
    console.log();
  }

  // Wait a bit more for async stats recording
  console.log('Waiting for async stats recording...');
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Check if stats file was created
  try {
    const statsData = await fs.readFile(STATS_FILE, 'utf-8');
    const stats = JSON.parse(statsData);

    console.log('\n✅ SUCCESS! Statistics file was created!\n');
    console.log('Stats summary:');
    console.log(`  Total compressions: ${stats.summary.totalCompressions}`);
    console.log(`  Total original tokens: ${stats.summary.totalOriginalTokens}`);
    console.log(`  Total compressed tokens: ${stats.summary.totalCompressedTokens}`);
    console.log(`  Total tokens saved: ${stats.summary.totalTokensSaved}`);

    if (stats.compressions.length > 0) {
      console.log(`\nLatest compression:`);
      const latest = stats.compressions[stats.compressions.length - 1];
      console.log(`  Path: ${latest.path}`);
      console.log(`  Level: ${latest.level}`);
      console.log(`  Savings: ${latest.savingsPercentage}%`);
    }

    return true;
  } catch (error) {
    console.log(`\n❌ FAILED: Statistics file was NOT created`);
    console.log(`   Expected location: ${STATS_FILE}`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

testMCPStatsRecording()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Test error:', error);
    process.exit(1);
  });
