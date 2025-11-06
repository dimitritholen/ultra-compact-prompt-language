/**
 * Test if MCP server records statistics correctly
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import { once } from 'node:events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

describe('MCP Server Statistics Recording', () => {
  before(async () => {
    // Clean up any existing stats
    try {
      await fs.unlink(STATS_FILE);
    } catch (_err) {
      // File might not exist
    }
  });

  after(async () => {
    // Cleanup after tests
    try {
      await fs.unlink(STATS_FILE);
    } catch (_err) {
      // Ignore cleanup errors
    }
  });

  test.skip('should record statistics when compress_code_context is called (requires installed dependencies)', async (t) => {
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

    t.diagnostic('Sending test request to MCP server...');

    const serverPath = path.join(__dirname, '../server.js');
    const proc = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Send the request
    proc.stdin.write(JSON.stringify(testRequest) + '\n');
    proc.stdin.end(); // Close stdin to signal no more requests

    // Wait for actual response (event-based, not time-based)
    const { response, stderr } = await waitForResponse(proc, testRequest.id);

    t.diagnostic('Response received');

    if (stderr) {
      t.diagnostic('STDERR output:');
      t.diagnostic(stderr);
    }

    // Wait for process to exit and ensure stats are written
    t.diagnostic('Waiting for subprocess to complete stats recording...');
    await once(proc, 'close');

    // Check if stats file was created
    const statsData = await fs.readFile(STATS_FILE, 'utf-8');
    const stats = JSON.parse(statsData);

    t.diagnostic('Statistics file was created!');
    t.diagnostic(`Total compressions: ${stats.summary.totalCompressions}`);
    t.diagnostic(`Total original tokens: ${stats.summary.totalOriginalTokens}`);
    t.diagnostic(`Total compressed tokens: ${stats.summary.totalCompressedTokens}`);
    t.diagnostic(`Total tokens saved: ${stats.summary.totalTokensSaved}`);

    assert.ok(stats.summary, 'Should have summary object');
    assert.ok(stats.summary.totalCompressions > 0, 'Should have at least one compression recorded');

    if (stats.compressions && stats.compressions.length > 0) {
      const latest = stats.compressions[stats.compressions.length - 1];
      t.diagnostic(`Latest compression:`);
      t.diagnostic(`  Path: ${latest.path}`);
      t.diagnostic(`  Level: ${latest.level}`);
      t.diagnostic(`  Savings: ${latest.savingsPercentage}%`);

      assert.ok(latest.path, 'Latest compression should have a path');
      assert.ok(latest.level, 'Latest compression should have a level');
      assert.ok(latest.savingsPercentage !== undefined, 'Latest compression should have savings percentage');
    }
  });

  test.todo('Manual: Test with real MCP Inspector to verify full integration');
});
