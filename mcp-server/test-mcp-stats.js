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
  const assert = require('assert');

  const statsData = await fs.readFile(STATS_FILE, 'utf-8');
  const stats = JSON.parse(statsData);

  console.log('\nStatistics file was created successfully!\n');

  // Validate stats structure
  assert.ok(stats.summary, 'Stats file must have a summary object');
  assert.ok(stats.compressions, 'Stats file must have a compressions array');

  // Validate summary fields
  assert.strictEqual(
    typeof stats.summary.totalCompressions,
    'number',
    'totalCompressions must be a number'
  );
  assert.strictEqual(
    typeof stats.summary.totalOriginalTokens,
    'number',
    'totalOriginalTokens must be a number'
  );
  assert.strictEqual(
    typeof stats.summary.totalCompressedTokens,
    'number',
    'totalCompressedTokens must be a number'
  );
  assert.strictEqual(
    typeof stats.summary.totalTokensSaved,
    'number',
    'totalTokensSaved must be a number'
  );

  // Validate there is at least one compression recorded
  assert.ok(
    stats.compressions.length > 0,
    'At least one compression should be recorded'
  );

  // Validate compression record structure
  const latest = stats.compressions[stats.compressions.length - 1];
  assert.ok(latest.path, 'Compression record must have a path');
  assert.ok(latest.level, 'Compression record must have a level');
  assert.strictEqual(
    typeof latest.savingsPercentage,
    'number',
    'savingsPercentage must be a number'
  );
  assert.ok(
    latest.savingsPercentage >= 0 && latest.savingsPercentage <= 100,
    'savingsPercentage must be between 0 and 100'
  );

  console.log('Stats summary:');
  console.log(`  Total compressions: ${stats.summary.totalCompressions}`);
  console.log(`  Total original tokens: ${stats.summary.totalOriginalTokens}`);
  console.log(`  Total compressed tokens: ${stats.summary.totalCompressedTokens}`);
  console.log(`  Total tokens saved: ${stats.summary.totalTokensSaved}`);
  console.log(`\nLatest compression:`);
  console.log(`  Path: ${latest.path}`);
  console.log(`  Level: ${latest.level}`);
  console.log(`  Savings: ${latest.savingsPercentage}%`);

  console.log('\n✅ All assertions passed!');
  return true;
}

testMCPStatsRecording()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Test error:', error);
    process.exit(1);
  });
