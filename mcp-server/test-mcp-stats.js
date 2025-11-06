#!/usr/bin/env node

/**
 * Test if MCP server records statistics correctly
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const readline = require('readline');
const { once } = require('events');

const STATS_FILE = path.join(os.homedir(), '.ucpl', 'compress', 'compression-stats.json');

/**
 * Maximum time to wait for subprocess response before timing out
 */
const RESPONSE_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Wait for a JSON-RPC response from the subprocess stdout
 * Uses event-based listening with readline for line-by-line processing
 * @param {import('child_process').ChildProcess} proc - The child process
 * @param {number} requestId - The expected JSON-RPC request ID
 * @returns {Promise<{response: string, stderr: string}>} The response and stderr output
 */
async function waitForResponse(proc, requestId) {
  let stderrOutput = '';
  let responseData = null;

  // Set up stderr listener
  proc.stderr.on('data', (data) => {
    stderrOutput += data.toString();
  });

  // Create readline interface for line-by-line stdout processing
  const rl = readline.createInterface({
    input: proc.stdout,
    crlfDelay: Infinity
  });

  // Promise race between response detection and timeout
  const responsePromise = (async () => {
    for await (const line of rl) {
      try {
        const parsed = JSON.parse(line);
        // Check if this is the JSON-RPC response we're waiting for
        if (parsed.jsonrpc === '2.0' && parsed.id === requestId) {
          responseData = line;
          break;
        }
      } catch (_err) {
        // Ignore non-JSON lines (could be diagnostics or other output)
        continue;
      }
    }
    return responseData;
  })();

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Response timeout after ${RESPONSE_TIMEOUT_MS}ms`)), RESPONSE_TIMEOUT_MS);
  });

  try {
    await Promise.race([responsePromise, timeoutPromise]);
  } finally {
    rl.close();
  }

  return { response: responseData, stderr: stderrOutput };
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
  const proc = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Send the request
  proc.stdin.write(JSON.stringify(testRequest) + '\n');
  proc.stdin.end(); // Close stdin to signal no more requests

  // Wait for actual response (event-based, not time-based)
  const { stderr } = await waitForResponse(proc, testRequest.id);

  console.log('✓ Response received\n');

  if (stderr) {
    console.log('STDERR output:');
    console.log(stderr);
    console.log();
  }

  // Wait for process to exit and ensure stats are written
  console.log('Waiting for subprocess to complete stats recording...');
  await once(proc, 'close');

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
      console.log('\nLatest compression:');
      const latest = stats.compressions[stats.compressions.length - 1];
      console.log(`  Path: ${latest.path}`);
      console.log(`  Level: ${latest.level}`);
      console.log(`  Savings: ${latest.savingsPercentage}%`);
    }

    return true;
  } catch (error) {
    console.log('\n❌ FAILED: Statistics file was NOT created');
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
