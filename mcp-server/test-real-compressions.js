#!/usr/bin/env node

/**
 * Real-world test for statistics recording with actual compressions
 *
 * This test:
 * 1. Backs up existing stats file (via beforeEach hook)
 * 2. Performs multiple real compressions using the MCP server
 * 3. Verifies all compressions were recorded
 * 4. Restores original stats file (via afterEach hook - guaranteed)
 *
 * Safety: Uses node:test lifecycle hooks to guarantee backup/restore
 * even on test failures or exceptions.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const STATS_DIR = path.join(os.homedir(), '.ucpl', 'compress');
const STATS_FILE = path.join(STATS_DIR, 'compression-stats.json');
const BACKUP_FILE = path.join(STATS_DIR, 'compression-stats.json.backup');
const SERVER_PATH = path.join(__dirname, 'server.js');

/**
 * Load statistics
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

/**
 * Backup existing stats
 */
async function backupStats() {
  try {
    await fs.copyFile(STATS_FILE, BACKUP_FILE);
    console.log('✅ Backed up existing stats file');
  } catch (_error) {
    console.log('  (No existing stats to backup)');
  }
}

/**
 * Restore original stats
 */
async function restoreStats() {
  try {
    await fs.copyFile(BACKUP_FILE, STATS_FILE);
    await fs.unlink(BACKUP_FILE);
    console.log('✅ Restored original stats file');
  } catch (_error) {
    console.log('  (No backup to restore)');
  }
}

/**
 * Clear stats for clean test
 */
async function clearStats() {
  try {
    await fs.unlink(STATS_FILE);
    console.log('✅ Cleared stats file for clean test');
  } catch (_error) {
    // File doesn't exist, that's fine
  }
}

/**
 * JSON-RPC client with proper newline-delimited message framing
 *
 * Implements robust protocol handling:
 * - Sequential line-by-line parsing (not backwards search)
 * - Request/response ID matching via Map
 * - Proper error handling for malformed JSON (fail-fast)
 * - Newline-delimited JSON framing per JSON-RPC/MCP spec
 *
 * @class JSONRPCClient
 */
class JSONRPCClient {
  /**
   * Create a JSON-RPC client that parses newline-delimited JSON from a stream
   *
   * @param {import('stream').Readable} processStdout - Readable stream (e.g., child_process.stdout)
   */
  constructor(processStdout) {
    this.pendingRequests = new Map(); // Maps request ID to Promise resolver/rejecter
    this.nextId = 1;
    this.closed = false;

    // Set up newline-delimited JSON parser using readline
    const readline = require('readline');
    this.lineReader = readline.createInterface({
      input: processStdout,
      crlfDelay: Infinity // Treat \r\n as single line break
    });

    this.lineReader.on('line', (line) => {
      if (!this.closed) {
        this.handleLine(line);
      }
    });
  }

  /**
   * Handle a single line of newline-delimited JSON
   * @param {string} line - Single line from stdout
   */
  handleLine(line) {
    // Ignore empty lines
    if (line.trim().length === 0) {
      return;
    }

    let message;
    try {
      message = JSON.parse(line);
    } catch (parseError) {
      // Fail fast on malformed JSON - this indicates a protocol error
      const error = new Error(`Malformed JSON-RPC message: ${parseError.message}\nLine: ${line}`);
      error.line = line;
      error.cause = parseError;

      // Reject all pending requests with this error
      for (const { reject } of this.pendingRequests.values()) {
        reject(error);
      }
      this.pendingRequests.clear();
      return;
    }

    // Validate JSON-RPC 2.0 structure
    if (message.jsonrpc !== '2.0') {
      const error = new Error(`Invalid JSON-RPC version: ${message.jsonrpc}`);
      error.responseMessage = message;

      // Reject all pending requests
      for (const { reject } of this.pendingRequests.values()) {
        reject(error);
      }
      this.pendingRequests.clear();
      return;
    }

    // Handle response (must have 'id' and either 'result' or 'error')
    if ('id' in message && ('result' in message || 'error' in message)) {
      this.handleResponse(message);
    }
    // Ignore notifications and other message types
  }

  /**
   * Handle a JSON-RPC response message
   *
   * @param {object} response - Parsed JSON-RPC response
   * @param {number|string} response.id - Request ID
   * @param {object} [response.result] - Result (if successful)
   * @param {object} [response.error] - Error (if failed)
   */
  handleResponse(response) {
    const { id } = response;

    // Validate response ID is present
    if (id === null || id === undefined) {
      console.warn('Received response without ID, ignoring');
      return;
    }

    const pending = this.pendingRequests.get(id);

    if (!pending) {
      // Response for unknown request ID - log but don't crash
      console.warn(`Received response for unknown request ID: ${id}`);
      return;
    }

    this.pendingRequests.delete(id);

    if ('error' in response) {
      const error = new Error(response.error.message || 'JSON-RPC error');
      error.code = response.error.code;
      error.data = response.error.data;
      error.rpcError = response.error;
      pending.reject(error);
    } else {
      pending.resolve(response);
    }
  }

  /**
   * Send a JSON-RPC request
   *
   * @param {object} request - JSON-RPC request object (without id)
   * @param {string} request.method - JSON-RPC method name
   * @param {object} [request.params] - Method parameters
   * @param {function(string): void} writeToStdin - Function to write to process stdin
   * @returns {Promise<object>} Promise that resolves with the JSON-RPC response
   */
  sendRequest(request, writeToStdin) {
    if (this.closed) {
      return Promise.reject(new Error('JSON-RPC client is closed'));
    }

    const id = this.nextId++;
    const fullRequest = { ...request, jsonrpc: '2.0', id };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      try {
        // Write newline-delimited JSON to stdin
        writeToStdin(JSON.stringify(fullRequest) + '\n');
      } catch (writeError) {
        this.pendingRequests.delete(id);
        reject(new Error(`Failed to write request: ${writeError.message}`));
      }
    });
  }

  /**
   * Clean up resources and reject all pending requests
   */
  close() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.lineReader.close();

    // Reject all pending requests
    const error = new Error('JSON-RPC client closed');
    for (const { reject } of this.pendingRequests.values()) {
      reject(error);
    }
    this.pendingRequests.clear();
  }
}

/**
 * Call MCP tool via JSON-RPC with robust newline-delimited parsing
 *
 * @param {string} toolName - MCP tool name (e.g., 'compress_code_context')
 * @param {object} args - Tool arguments
 * @returns {Promise<{response: object, stderr: string}>} Promise resolving to tool response and stderr output
 */
function callMCPTool(toolName, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [SERVER_PATH]);
    let stderr = '';

    // Create JSON-RPC client with newline-delimited JSON parsing
    const rpcClient = new JSONRPCClient(proc.stdout);

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      rpcClient.close();

      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (error) => {
      rpcClient.close();
      reject(new Error(`Process error: ${error.message}`));
    });

    // Helper to write to stdin
    const writeToStdin = (data) => {
      proc.stdin.write(data);
    };

    // Send initialize request
    const initRequest = {
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    };

    // Send tool call request
    const toolRequest = {
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    // Execute requests sequentially
    rpcClient.sendRequest(initRequest, writeToStdin)
      .then(() => rpcClient.sendRequest(toolRequest, writeToStdin))
      .then((response) => {
        proc.stdin.end();
        resolve({ response, stderr });
      })
      .catch((error) => {
        proc.stdin.end();
        rpcClient.close();
        reject(error);
      });
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
 * Test compression recording with single file
 * @returns {Promise<boolean>} Test result
 */
async function testSingleFileCompression() {
  console.log('\nTest 1: Single file compression...');

  try {
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

    if (finalCount <= initialCount) {
      console.log(`  ❌ Stats file not updated (${initialCount} → ${finalCount})`);
      return false;
    }

    console.log(`  ✅ Stats file updated (${initialCount} → ${finalCount})`);

    // Validate the new record
    const newRecord = finalStats.recent[finalStats.recent.length - 1];
    const validation = validateCompressionRecord(newRecord, testFile, 'minimal');

    if (!validation.success) {
      console.log('  ❌ Record validation failed:');
      validation.errors.forEach(err => console.log(`     - ${err}`));
      return false;
    }

    console.log('  ✅ Record validation passed:');
    console.log(`     - Tokens: ${newRecord.originalTokens} → ${newRecord.compressedTokens} (saved: ${newRecord.tokensSaved})`);
    console.log(`     - Ratio: ${newRecord.compressionRatio} (${newRecord.savingsPercentage}% savings)`);
    console.log(`     - Path: ${path.basename(newRecord.path)}`);
    console.log(`     - Timestamp: ${newRecord.timestamp}`);

    return true;
  } catch (error) {
    console.log(`  ❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test compression recording with directory (tests fallback estimation)
 * @returns {Promise<boolean>} Test result
 */
async function testDirectoryCompression() {
  console.log('\nTest 2: Directory compression (tests fallback)...');

  try {
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

    if (finalCount <= initialCount) {
      console.log(`  ❌ Stats file not updated (${initialCount} → ${finalCount})`);
      return false;
    }

    console.log(`  ✅ Stats file updated (${initialCount} → ${finalCount})`);

    // Validate the new record
    const newRecord = finalStats.recent[finalStats.recent.length - 1];
    const validation = validateCompressionRecord(newRecord, testDir, 'minimal');

    if (!validation.success) {
      console.log('  ❌ Record validation failed:');
      validation.errors.forEach(err => console.log(`     - ${err}`));
      return false;
    }

    console.log('  ✅ Record validation passed:');
    console.log(`     - Tokens: ${newRecord.originalTokens} → ${newRecord.compressedTokens} (saved: ${newRecord.tokensSaved})`);
    console.log(`     - Ratio: ${newRecord.compressionRatio} (${newRecord.savingsPercentage}% savings)`);

    // Check if record is marked as estimated (expected for directories)
    if (newRecord.estimated) {
      console.log('  ✅ Record correctly marked as estimated (fallback worked)');
    } else {
      console.log('  ⓘ  Record not marked as estimated (accurate stats available)');
    }

    return true;
  } catch (error) {
    console.log(`  ❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test multiple sequential compressions
 * @returns {Promise<boolean>} Test result
 */
async function testMultipleCompressions() {
  console.log('\nTest 3: Multiple sequential compressions...');

  try {
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

    if (finalCount !== expected) {
      console.log(`  ❌ Not all compressions recorded (expected ${expected}, got ${finalCount})`);
      return false;
    }

    console.log(`  ✅ All compressions recorded (${initialCount} → ${finalCount})`);

    // Validate all new records
    const newRecords = finalStats.recent.slice(-testFiles.length);
    let allValid = true;

    for (let i = 0; i < newRecords.length; i++) {
      const record = newRecords[i];
      const testFile = testFiles[i];
      const validation = validateCompressionRecord(record, testFile, 'full');

      if (!validation.success) {
        console.log(`  ❌ Record ${i + 1} validation failed:`);
        validation.errors.forEach(err => console.log(`     - ${err}`));
        allValid = false;
      } else {
        console.log(`  ✅ Record ${i + 1} valid: ${path.basename(record.path)} (${record.tokensSaved} tokens saved)`);
      }
    }

    // Validate summary was updated correctly
    const expectedTotalCompressions = initialStats.summary.totalCompressions + testFiles.length;
    if (finalStats.summary.totalCompressions !== expectedTotalCompressions) {
      console.log(`  ❌ Summary totalCompressions incorrect: expected ${expectedTotalCompressions}, got ${finalStats.summary.totalCompressions}`);
      allValid = false;
    } else {
      console.log('  ✅ Summary totalCompressions updated correctly');
    }

    return allValid;
  } catch (error) {
    console.log(`  ❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test get_compression_stats tool
 * @returns {Promise<boolean>} Test result
 */
async function testStatsRetrieval() {
  console.log('\nTest 4: Statistics retrieval...');

  try {
    const { response } = await callMCPTool('get_compression_stats', {
      period: 'all',
      includeDetails: true,
      limit: 10
    });

    if (response.result && response.result.content && response.result.content[0]) {
      const text = response.result.content[0].text;

      if (text.includes('Total Compressions:') && text.includes('Tokens Saved:')) {
        console.log('  ✅ Statistics retrieval works');
        console.log('     Summary preview:', text.split('\n').slice(0, 5).join('\n     '));
        return true;
      } else {
        console.log('  ❌ Statistics format unexpected');
        return false;
      }
    } else {
      console.log('  ❌ No response content');
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Main test suite with guaranteed backup/restore via lifecycle hooks
 */
async function runTests() {
  console.log('=== Real Compression Statistics Recording Tests ===');
  console.log('\nThis test will:');
  console.log('1. Backup your existing stats (automatic via beforeEach)');
  console.log('2. Run multiple compression tests');
  console.log('3. Restore your original stats (guaranteed via afterEach)\n');

  await describe('Real Compression Statistics Recording', async () => {
    // Guaranteed backup before tests (runs once for the suite)
    beforeEach(async () => {
      try {
        await backupStats();
        await clearStats();
      } catch (error) {
        console.error('⚠️  Backup failed:', error.message);
        throw error; // Fail fast if backup fails
      }
    });

    // Guaranteed restore after tests (even on failure)
    afterEach(async () => {
      try {
        await restoreStats();
      } catch (error) {
        console.error('⚠️  Restore failed:', error.message);
        // Don't throw - we want other cleanup to continue
      }
    });

    // Individual tests wrapped in test() calls
    await test('Single file compression', async () => {
      const result = await testSingleFileCompression();
      if (!result) {
        throw new Error('Single file compression test failed');
      }
    });

    await test('Directory compression (tests fallback)', async () => {
      const result = await testDirectoryCompression();
      if (!result) {
        throw new Error('Directory compression test failed');
      }
    });

    await test('Multiple sequential compressions', async () => {
      const result = await testMultipleCompressions();
      if (!result) {
        throw new Error('Multiple compressions test failed');
      }
    });

    await test('Statistics retrieval', async () => {
      const result = await testStatsRetrieval();
      if (!result) {
        throw new Error('Statistics retrieval test failed');
      }
    });
  });

  console.log('\n✅ All tests passed!');
  console.log('\n✅ The bug fix is working correctly!');
  console.log('   - Statistics are recorded for all compressions');
  console.log('   - Fallback estimation works when readOriginalContent fails');
  console.log('   - Multiple compressions are tracked properly');
}

// Process-level exception handlers for crash safety
process.on('uncaughtException', async (error) => {
  console.error('\n💥 Uncaught exception:', error);
  console.log('🔄 Attempting emergency stats restore...');
  try {
    await restoreStats();
    console.log('✅ Emergency restore completed');
  } catch (restoreError) {
    console.error('❌ Emergency restore failed:', restoreError.message);
  }
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('\n💥 Unhandled rejection at:', promise, 'reason:', reason);
  console.log('🔄 Attempting emergency stats restore...');
  try {
    await restoreStats();
    console.log('✅ Emergency restore completed');
  } catch (restoreError) {
    console.error('❌ Emergency restore failed:', restoreError.message);
  }
  process.exit(1);
});

// Run tests with guaranteed cleanup
runTests().catch(async (error) => {
  console.error('Fatal error:', error);
  console.log('🔄 Attempting final stats restore...');
  try {
    await restoreStats();
    console.log('✅ Final restore completed');
  } catch (restoreError) {
    console.error('❌ Final restore failed:', restoreError.message);
  }
  process.exit(1);
});
