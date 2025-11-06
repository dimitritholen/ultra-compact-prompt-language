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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATS_FILE = path.join(os.homedir(), '.ucpl', 'compress', 'compression-stats.json');

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

    const serverPath = path.join(__dirname, 'server.js');
    const proc = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

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

    t.diagnostic('Request sent');

    if (stderr) {
      t.diagnostic('STDERR output:');
      t.diagnostic(stderr);
    }

    // Wait a bit more for async stats recording
    t.diagnostic('Waiting for async stats recording...');
    await new Promise((resolve) => setTimeout(resolve, 1000));

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
