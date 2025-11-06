#!/usr/bin/env node

/**
 * Test if MCP server records statistics correctly
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const {
  validateCompressionRecord,
  validateStatsSummary,
  validateStatsFile
} = require('./test-validation-helpers');

const STATS_FILE = path.join(os.homedir(), '.ucpl', 'compress', 'compression-stats.json');

/**
 * Poll for stats file to exist and have expected records with exponential backoff
 * @param {number} expectedCount - Expected number of records
 * @param {number} maxWaitMs - Maximum wait time in milliseconds (default: 5000)
 * @returns {Promise<object>} Stats object when condition is met
 */
async function pollForStatsFile(expectedCount, maxWaitMs = 5000) {
  const startTime = Date.now();
  let delay = 100; // Start with 100ms

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const data = await fs.readFile(STATS_FILE, 'utf-8');
      const stats = JSON.parse(data);
      const currentCount = stats.recent ? stats.recent.length : 0;

      if (currentCount >= expectedCount) {
        return stats;
      }
    } catch (error) {
      // Stats file doesn't exist yet, keep polling
    }

    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, 1000); // Exponential backoff, max 1s
  }

  // Timeout - try one more time and throw if still not found
  const data = await fs.readFile(STATS_FILE, 'utf-8');
  return JSON.parse(data);
}

async function testMCPStatsRecording() {
  console.log('Testing MCP server statistics recording...\n');

  // Clean up any existing stats
  try {
    await fs.unlink(STATS_FILE);
    console.log('✓ Cleaned up existing stats file');
  } catch (_err) {
    console.log('  (No existing stats file to clean)');
  }

  // Create temporary test file for compression
  const testFile = path.join(os.tmpdir(), `test-mcp-${Date.now()}.js`);
  const testContent = `
/**
 * Test file for MCP statistics recording
 * This file contains example functions to test compression.
 */

const config = {
  enabled: true,
  timeout: 5000,
  retries: 3,
  endpoints: ['api.example.com', 'backup.example.com']
};

function example() {
  const data = {
    foo: 'bar',
    baz: 42,
    nested: {
      key1: 'value1',
      key2: 'value2',
      key3: 'value3'
    }
  };
  return data;
}

function processData(input) {
  if (!input) {
    throw new Error('Input is required');
  }

  const processed = input.trim().toUpperCase();
  console.log('Processing:', processed);
  return processed;
}

function validateInput(data) {
  if (typeof data !== 'object') {
    throw new TypeError('Data must be an object');
  }

  if (!data.id || !data.name) {
    throw new Error('Missing required fields: id, name');
  }

  return true;
}

async function fetchData(url, options = {}) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }

  return response.json();
}

module.exports = {
  example,
  processData,
  validateInput,
  fetchData,
  config
};
`.trim();

  await fs.writeFile(testFile, testContent);
  console.log(`✓ Created temporary test file: ${testFile}`);

  // Create a test request (simulate MCP client calling compress_code_context)
  const testRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'compress_code_context',
      arguments: {
        path: testFile,
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

  // Initialize server first (required by MCP protocol)
  const initRequest = {
    jsonrpc: '2.0',
    id: 0,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    }
  };

  proc.stdin.write(JSON.stringify(initRequest) + '\n');

  // Give server time to initialize before sending tool request
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Send the tool request
  proc.stdin.write(JSON.stringify(testRequest) + '\n');

  console.log('✓ Request sent\n');

  // Poll for stats file with exponential backoff
  console.log('Polling for stats file creation...');
  const stats = await pollForStatsFile(1, 5000);

  proc.kill();

  if (stderr) {
    console.log('STDERR output:');
    console.log(stderr);
    console.log();
  }

  if (response) {
    console.log('Response received (first 500 chars):');
    console.log(response.substring(0, 500));
    console.log();
  }

  // Check if stats file was created
  const assert = require('assert');

  console.log('\nStatistics file was created successfully!\n');

  // Validate complete stats file structure
  console.log('Validating stats file structure...');
  validateStatsFile(stats, { requireRecords: true });
  console.log('✅ Stats file structure is valid\n');

  // Validate summary object
  console.log('Validating summary fields...');
  validateStatsSummary(stats.summary);
  console.log('✅ Summary fields validated\n');

  // Validate there is at least one compression recorded
  assert.ok(
    stats.recent && stats.recent.length > 0,
    'At least one compression should be recorded in recent array'
  );
  console.log(`Found ${stats.recent.length} compression record(s)\n`);

  // Validate all compression records
  console.log('Validating compression records...');
  stats.recent.forEach((record, index) => {
    validateCompressionRecord(record, `compression record #${index + 1}`);
  });
  console.log('✅ All compression records validated\n');

  // Get latest compression for detailed output
  const latest = stats.recent[stats.recent.length - 1];

  // Validate all required fields are present with proper types
  assert.ok(latest.timestamp, 'Latest record must have timestamp');
  assert.ok(latest.path, 'Latest record must have path');
  assert.ok(typeof latest.originalTokens === 'number', 'originalTokens must be a number');
  assert.ok(typeof latest.compressedTokens === 'number', 'compressedTokens must be a number');
  assert.ok(typeof latest.tokensSaved === 'number', 'tokensSaved must be a number');
  assert.ok(typeof latest.compressionRatio === 'number', 'compressionRatio must be a number');
  assert.ok(typeof latest.savingsPercentage === 'number', 'savingsPercentage must be a number');
  assert.ok(latest.level, 'Latest record must have level');
  assert.ok(latest.format, 'Latest record must have format');

  // Validate value ranges
  assert.ok(latest.originalTokens >= 0, 'originalTokens must be non-negative');
  assert.ok(latest.compressedTokens >= 0, 'compressedTokens must be non-negative');
  assert.ok(latest.tokensSaved >= 0, 'tokensSaved must be non-negative');
  assert.ok(
    latest.compressionRatio >= 0 && latest.compressionRatio <= 1.1,
    'compressionRatio must be between 0 and 1.1'
  );
  assert.ok(
    latest.savingsPercentage >= 0 && latest.savingsPercentage <= 100,
    'savingsPercentage must be between 0 and 100'
  );

  // Validate calculations
  const expectedTokensSaved = latest.originalTokens - latest.compressedTokens;
  assert.strictEqual(
    latest.tokensSaved,
    expectedTokensSaved,
    `tokensSaved must equal originalTokens - compressedTokens (expected ${expectedTokensSaved}, got ${latest.tokensSaved})`
  );

  const expectedRatio = latest.originalTokens > 0 ? latest.compressedTokens / latest.originalTokens : 0;
  assert.ok(
    Math.abs(latest.compressionRatio - expectedRatio) < 0.001,
    `compressionRatio must match calculation (expected ${expectedRatio.toFixed(3)}, got ${latest.compressionRatio})`
  );

  const expectedPercentage = latest.originalTokens > 0 ? (latest.tokensSaved / latest.originalTokens) * 100 : 0;
  assert.ok(
    Math.abs(latest.savingsPercentage - expectedPercentage) < 0.2,
    `savingsPercentage must match calculation (expected ${expectedPercentage.toFixed(1)}%, got ${latest.savingsPercentage}%)`
  );

  console.log('Stats summary:');
  console.log(`  Total compressions: ${stats.summary.totalCompressions}`);
  console.log(`  Total original tokens: ${stats.summary.totalOriginalTokens.toLocaleString()}`);
  console.log(`  Total compressed tokens: ${stats.summary.totalCompressedTokens.toLocaleString()}`);
  console.log(`  Total tokens saved: ${stats.summary.totalTokensSaved.toLocaleString()}`);

  console.log('\nLatest compression:');
  console.log(`  Timestamp: ${latest.timestamp}`);
  console.log(`  Path: ${latest.path}`);
  console.log(`  Level: ${latest.level}`);
  console.log(`  Format: ${latest.format}`);
  console.log(`  Original tokens: ${latest.originalTokens.toLocaleString()}`);
  console.log(`  Compressed tokens: ${latest.compressedTokens.toLocaleString()}`);
  console.log(`  Tokens saved: ${latest.tokensSaved.toLocaleString()}`);
  console.log(`  Compression ratio: ${latest.compressionRatio}`);
  console.log(`  Savings percentage: ${latest.savingsPercentage}%`);

  if (latest.estimated) {
    console.log('  ⚠️  Values are estimated (original content not available)');
  }

  if (latest.model) {
    console.log(`\nCost tracking:`);
    console.log(`  Model: ${latest.model}`);
    console.log(`  Price per M tokens: $${latest.pricePerMTok}`);
    console.log(`  Cost savings: $${latest.costSavingsUSD.toFixed(6)}`);
  }

  console.log('\n✅ All field validations passed!');
  console.log('✅ All calculations verified!');
  console.log('✅ All assertions passed!');

  // Cleanup temporary test file
  try {
    await fs.unlink(testFile);
    console.log('✓ Cleaned up temporary test file');
  } catch (err) {
    console.warn('⚠️  Failed to clean up temporary test file:', err.message);
  }

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
