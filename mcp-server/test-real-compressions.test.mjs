/**
 * Real-world test for statistics recording with actual compressions
 *
 * This test:
 * 1. Backs up existing stats file
 * 2. Performs multiple real compressions using the MCP server
 * 3. Verifies all compressions were recorded
 * 4. Restores original stats file
 *
 * Migrated to node:test from custom test runner
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATS_DIR = path.join(os.homedir(), '.ucpl', 'compress');
const STATS_FILE = path.join(STATS_DIR, 'compression-stats.json');
const BACKUP_FILE = path.join(STATS_DIR, 'compression-stats.json.backup');
const SERVER_PATH = path.join(__dirname, 'server.js');

describe('Real Compression Statistics Recording', () => {
  /**
   * Helper functions
   */
  async function loadStats() {
    try {
      const data = await fs.readFile(STATS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (_error) {
      return { compressions: [], summary: { totalCompressions: 0 } };
    }
  }

  async function backupStats() {
    try {
      await fs.copyFile(STATS_FILE, BACKUP_FILE);
    } catch (_error) {
      // No existing stats to backup
    }
  }

  async function restoreStats() {
    try {
      await fs.copyFile(BACKUP_FILE, STATS_FILE);
      await fs.unlink(BACKUP_FILE);
    } catch (_error) {
      // No backup to restore
    }
  }

  async function clearStats() {
    try {
      await fs.unlink(STATS_FILE);
    } catch (_error) {
      // File doesn't exist, that's fine
    }
  }

  function callMCPTool(toolName, args) {
    return new Promise((resolve, reject) => {
      const proc = spawn('node', [SERVER_PATH]);
      let stdout = '';
      let stderr = '';
      let requestId = Date.now();

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          try {
            const lines = stdout.trim().split('\n').filter(line => line.length > 0);

            // Find the tool call response
            let toolResponse = null;
            for (let i = lines.length - 1; i >= 0; i--) {
              try {
                const parsed = JSON.parse(lines[i]);
                if (parsed.id === requestId + 1) {
                  toolResponse = parsed;
                  break;
                }
              } catch (_e) {
                // Skip non-JSON lines
              }
            }

            if (toolResponse) {
              resolve({ response: toolResponse, stderr });
            } else {
              reject(new Error('No tool response found in output'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}\nOutput: ${stdout}`));
          }
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`));
        }
      });

      // Initialize server first
      const initRequest = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      };

      // Then call the tool
      const toolRequest = {
        jsonrpc: '2.0',
        id: requestId + 1,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      proc.stdin.write(JSON.stringify(initRequest) + '\n');
      proc.stdin.write(JSON.stringify(toolRequest) + '\n');
      proc.stdin.end();
    });
  }

  /**
   * Test setup and teardown
   */
  before(async () => {
    await backupStats();
    await clearStats();
  });

  after(async () => {
    await restoreStats();
  });

  /**
   * Test cases
   */
  describe('Single file compression', () => {
    test('should record compression for single file', async () => {
      const testFile = path.join(__dirname, 'server.js');
      const initialStats = await loadStats();
      const initialCount = initialStats.compressions.length;

      const { stderr } = await callMCPTool('compress_code_context', {
        path: testFile,
        level: 'minimal',
        format: 'summary'
      });

      // Check for recording message in stderr
      assert.ok(
        stderr.includes('[INFO] Recorded compression'),
        'Compression should be recorded (log message found)'
      );

      // Wait for async recording to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      const finalStats = await loadStats();
      const finalCount = finalStats.compressions.length;

      assert.ok(finalCount > initialCount, `Stats file should be updated (${initialCount} → ${finalCount})`);
    });
  });

  describe('Directory compression', () => {
    test('should record compression for directory with fallback', async () => {
      const testDir = path.join(__dirname, '../scripts');
      const initialStats = await loadStats();
      const initialCount = initialStats.compressions.length;

      const { stderr } = await callMCPTool('compress_code_context', {
        path: testDir,
        level: 'minimal',
        format: 'summary',
        limit: 10
      });

      // Check for recording message in stderr (might be estimated)
      const hasRecordingLog = stderr.includes('[INFO] Recorded compression');
      assert.ok(hasRecordingLog, 'Compression should be recorded');

      // Wait for async recording to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      const finalStats = await loadStats();
      const finalCount = finalStats.compressions.length;

      assert.ok(finalCount > initialCount, `Stats file should be updated (${initialCount} → ${finalCount})`);

      // Check if last record has estimated flag for large directories
      const lastRecord = finalStats.compressions[finalStats.compressions.length - 1];
      if (lastRecord.estimated) {
        assert.ok(true, 'Record marked as estimated (fallback worked)');
      }
    });
  });

  describe('Multiple sequential compressions', () => {
    test('should record all sequential compressions', async () => {
      const initialStats = await loadStats();
      const initialCount = initialStats.compressions.length;

      const testFiles = [
        path.join(__dirname, 'server.js'),
        path.join(__dirname, 'test-statistics.js'),
        path.join(__dirname, 'test-schema.js')
      ];

      for (const file of testFiles) {
        await callMCPTool('compress_code_context', {
          path: file,
          level: 'full',
          format: 'summary'
        });
      }

      // Wait for all async recordings to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      const finalStats = await loadStats();
      const finalCount = finalStats.compressions.length;

      const expected = initialCount + testFiles.length;
      assert.strictEqual(finalCount, expected, `All compressions should be recorded (expected ${expected}, got ${finalCount})`);
    });
  });

  describe('Statistics retrieval', () => {
    test('should retrieve statistics correctly', async () => {
      const { response } = await callMCPTool('get_compression_stats', {
        period: 'all',
        includeDetails: true,
        limit: 10
      });

      assert.ok(response.result, 'Response should have result');
      assert.ok(response.result.content, 'Response should have content');
      assert.ok(response.result.content[0], 'Response should have content array');

      const text = response.result.content[0].text;

      assert.ok(text.includes('Total Compressions:'), 'Should include total compressions');
      assert.ok(text.includes('Tokens Saved:'), 'Should include tokens saved');
    });
  });
});
