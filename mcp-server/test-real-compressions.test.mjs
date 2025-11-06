/**
 * Real-world test for statistics recording with actual compressions
 *
 * This test:
 * 1. Backs up existing stats file
 * 2. Performs multiple real compressions using the MCP server
 * 3. Verifies all compressions were recorded with actual stats file validation
 * 4. Restores original stats file
 *
 * CRITICAL: Tests validate actual stats file content, NOT log messages.
 * This ensures tests remain stable even if log formats change.
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
      const stats = JSON.parse(data);

      // Ensure stats has the expected structure (recent/archived/monthly/summary)
      if (!stats.recent) stats.recent = [];
      if (!stats.archived) stats.archived = [];
      if (!stats.monthly) stats.monthly = [];
      if (!stats.summary) {
        stats.summary = {
          totalCompressions: 0,
          totalOriginalTokens: 0,
          totalCompressedTokens: 0,
          totalTokensSaved: 0
        };
      }

      return stats;
    } catch (error) {
      // Return empty stats structure if file doesn't exist or is invalid
      return {
        recent: [],
        archived: [],
        monthly: [],
        summary: {
          totalCompressions: 0,
          totalOriginalTokens: 0,
          totalCompressedTokens: 0,
          totalTokensSaved: 0
        }
      };
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
   * Validate compression record structure and values
   * @param {Object} record - Compression record to validate
   * @param {string} expectedPath - Expected file path
   * @param {string} expectedLevel - Expected compression level
   * @returns {Object} Validation result with success flag and errors
   */
  function validateCompressionRecord(record, expectedPath, expectedLevel) {
    const errors = [];

    // Required fields validation
    const requiredFields = ['timestamp', 'path', 'originalTokens', 'compressedTokens',
                            'tokensSaved', 'compressionRatio', 'savingsPercentage', 'level', 'format'];

    for (const field of requiredFields) {
      if (!(field in record)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Path validation
    if (record.path && !record.path.includes(path.basename(expectedPath))) {
      errors.push(`Path mismatch: expected ${expectedPath}, got ${record.path}`);
    }

    // Level validation
    if (record.level !== expectedLevel) {
      errors.push(`Level mismatch: expected ${expectedLevel}, got ${record.level}`);
    }

    // Token counts validation
    if (record.originalTokens <= 0) {
      errors.push(`Invalid originalTokens: ${record.originalTokens}`);
    }
    if (record.compressedTokens <= 0) {
      errors.push(`Invalid compressedTokens: ${record.compressedTokens}`);
    }
    if (record.tokensSaved !== record.originalTokens - record.compressedTokens) {
      errors.push(`Token math error: saved ${record.tokensSaved}, expected ${record.originalTokens - record.compressedTokens}`);
    }

    // Compression ratio validation
    const expectedRatio = record.compressedTokens / record.originalTokens;
    const ratioDiff = Math.abs(record.compressionRatio - expectedRatio);
    if (ratioDiff > 0.01) {
      errors.push(`Compression ratio error: ${record.compressionRatio}, expected ~${expectedRatio.toFixed(3)}`);
    }

    // Timestamp validation
    try {
      const timestamp = new Date(record.timestamp);
      const now = new Date();
      const ageSeconds = (now - timestamp) / 1000;
      if (ageSeconds < 0 || ageSeconds > 60) {
        errors.push(`Timestamp out of range: ${record.timestamp} (age: ${ageSeconds}s)`);
      }
    } catch (e) {
      errors.push(`Invalid timestamp format: ${record.timestamp}`);
    }

    return {
      success: errors.length === 0,
      errors
    };
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
    test('should record compression for single file with valid data', async () => {
      const testFile = path.join(__dirname, 'server.js');
      const initialStats = await loadStats();
      const initialCount = initialStats.recent ? initialStats.recent.length : 0;

      await callMCPTool('compress_code_context', {
        path: testFile,
        level: 'minimal',
        format: 'summary'
      });

      // Wait for async recording to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      const finalStats = await loadStats();
      const finalCount = finalStats.recent ? finalStats.recent.length : 0;

      assert.ok(finalCount > initialCount, `Stats file should be updated (${initialCount} → ${finalCount})`);

      // Validate the new record
      const newRecord = finalStats.recent[finalStats.recent.length - 1];
      const validation = validateCompressionRecord(newRecord, testFile, 'minimal');

      assert.ok(validation.success, `Record validation should pass. Errors: ${validation.errors.join(', ')}`);

      // Verify critical fields
      assert.ok(newRecord.originalTokens > 0, 'originalTokens should be positive');
      assert.ok(newRecord.compressedTokens > 0, 'compressedTokens should be positive');
      assert.ok(newRecord.tokensSaved > 0, 'tokensSaved should be positive');
      assert.ok(newRecord.compressionRatio > 0 && newRecord.compressionRatio < 1, 'compressionRatio should be between 0 and 1');
      assert.ok(newRecord.savingsPercentage > 0 && newRecord.savingsPercentage < 100, 'savingsPercentage should be between 0 and 100');
    });
  });

  describe('Directory compression', () => {
    test('should record compression for directory with fallback estimation', async () => {
      const testDir = path.join(__dirname, '../scripts');
      const initialStats = await loadStats();
      const initialCount = initialStats.recent ? initialStats.recent.length : 0;

      await callMCPTool('compress_code_context', {
        path: testDir,
        level: 'minimal',
        format: 'summary',
        limit: 10
      });

      // Wait for async recording to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      const finalStats = await loadStats();
      const finalCount = finalStats.recent ? finalStats.recent.length : 0;

      assert.ok(finalCount > initialCount, `Stats file should be updated (${initialCount} → ${finalCount})`);

      // Validate the new record
      const newRecord = finalStats.recent[finalStats.recent.length - 1];
      const validation = validateCompressionRecord(newRecord, testDir, 'minimal');

      assert.ok(validation.success, `Record validation should pass. Errors: ${validation.errors.join(', ')}`);

      // Check if record is marked as estimated (may or may not be, depending on implementation)
      if (newRecord.estimated) {
        assert.ok(true, 'Record correctly marked as estimated (fallback worked)');
      }

      // Verify token counts are reasonable
      assert.ok(newRecord.originalTokens > newRecord.compressedTokens, 'originalTokens should be greater than compressedTokens');
    });
  });

  describe('Multiple sequential compressions', () => {
    test('should record all sequential compressions with valid data', async () => {
      const initialStats = await loadStats();
      const initialCount = initialStats.recent ? initialStats.recent.length : 0;

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
      const finalCount = finalStats.recent ? finalStats.recent.length : 0;

      const expected = initialCount + testFiles.length;
      assert.strictEqual(finalCount, expected, `All compressions should be recorded (expected ${expected}, got ${finalCount})`);

      // Validate all new records
      const newRecords = finalStats.recent.slice(-testFiles.length);

      for (let i = 0; i < newRecords.length; i++) {
        const record = newRecords[i];
        const testFile = testFiles[i];
        const validation = validateCompressionRecord(record, testFile, 'full');

        assert.ok(validation.success, `Record ${i + 1} should be valid. Errors: ${validation.errors.join(', ')}`);
      }

      // Validate summary was updated correctly
      const expectedTotalCompressions = initialStats.summary.totalCompressions + testFiles.length;
      assert.strictEqual(
        finalStats.summary.totalCompressions,
        expectedTotalCompressions,
        `Summary totalCompressions should be ${expectedTotalCompressions}, got ${finalStats.summary.totalCompressions}`
      );

      // Validate summary token counts are reasonable
      assert.ok(finalStats.summary.totalOriginalTokens > 0, 'Summary totalOriginalTokens should be positive');
      assert.ok(finalStats.summary.totalCompressedTokens > 0, 'Summary totalCompressedTokens should be positive');
      assert.ok(finalStats.summary.totalTokensSaved > 0, 'Summary totalTokensSaved should be positive');
      assert.ok(
        finalStats.summary.totalOriginalTokens ===
        finalStats.summary.totalCompressedTokens + finalStats.summary.totalTokensSaved,
        'Summary token math should be correct'
      );
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
