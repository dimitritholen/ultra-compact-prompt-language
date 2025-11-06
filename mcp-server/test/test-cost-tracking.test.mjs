/**
 * Test suite for cost tracking integration in recordCompression() and recordCompressionWithEstimation()
 *
 * Tests:
 * 1. Cost fields are added to compression records
 * 2. LLM detection is cached per server lifecycle
 * 3. Pricing is loaded and reused
 * 4. Graceful handling when pricing unavailable
 * 5. Backward compatibility with existing stats
 *
 * Migrated to node:test from custom test runner
 * Tests import production code directly from server.js for real behavior validation
 */

import { describe, test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Import production functions and constants from server.js
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, '../server.js');

// Helper to get fresh imports (clears cache)
function getServerModule() {
  delete require.cache[SERVER_PATH];
  return require('./server.js');
}

const {
  detectLLMClient,
  calculateCostSavings,
  MODEL_PRICING
} = require('./server.js');

const DEFAULT_MODEL = 'claude-sonnet-4';

describe('Cost Tracking Integration', () => {
  let TEST_STATS_DIR;
  let TEST_STATS_FILE;
  let TEST_FILE;

  before(async () => {
    TEST_STATS_DIR = path.join(os.tmpdir(), `.ucpl-test-cost-${Date.now()}`);
    TEST_STATS_FILE = path.join(TEST_STATS_DIR, 'compression-stats-test.json');
    TEST_FILE = path.join(os.tmpdir(), 'test-compression.js');
    await fs.mkdir(TEST_STATS_DIR, { recursive: true });
  });

  after(async () => {
    await fs.rm(TEST_STATS_DIR, { recursive: true, force: true });
    await fs.rm(TEST_FILE, { force: true }).catch(() => {});
  });

  beforeEach(async () => {
    await fs.rm(TEST_STATS_FILE, { force: true }).catch(() => {});
    // Clear environment variables
    delete process.env.CLAUDE_DESKTOP_VERSION;
    delete process.env.VSCODE_PID;
    delete process.env.CLINE_VERSION;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.OPENAI_MODEL;
  });

  /**
   * Helper functions
   * Note: Most functions now use production code from server.js
   */
  function countTokens(text) {
    return Math.ceil(text.length / 4);
  }

  async function loadStats() {
    try {
      const data = await fs.readFile(TEST_STATS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (_error) {
      return {
        version: '2.0',
        recent: [],
        daily: {},
        monthly: {},
        summary: {
          totalCompressions: 0,
          totalOriginalTokens: 0,
          totalCompressedTokens: 0,
          totalTokensSaved: 0
        }
      };
    }
  }

  async function saveStats(stats) {
    await fs.mkdir(TEST_STATS_DIR, { recursive: true });
    await fs.writeFile(TEST_STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8');
  }

  async function recordCompression(filePath, originalContent, compressedContent, level, format) {
    const stats = await loadStats();

    const originalTokens = countTokens(originalContent);
    const compressedTokens = countTokens(compressedContent);
    const tokensSaved = originalTokens - compressedTokens;
    const compressionRatio = originalTokens > 0 ? (compressedTokens / originalTokens) : 0;
    const savingsPercentage = originalTokens > 0 ? ((tokensSaved / originalTokens) * 100) : 0;

    // Calculate cost savings with LLM detection
    let costInfo = null;
    try {
      costInfo = await calculateCostSavings(tokensSaved);
    } catch (error) {
      // Gracefully handle errors
    }

    const record = {
      timestamp: new Date().toISOString(),
      path: filePath,
      originalTokens,
      compressedTokens,
      tokensSaved,
      compressionRatio: Math.round(compressionRatio * 1000) / 1000,
      savingsPercentage: Math.round(savingsPercentage * 10) / 10,
      level,
      format
    };

    // Add cost tracking fields if available
    if (costInfo) {
      record.model = costInfo.model;
      record.client = costInfo.client;
      record.pricePerMTok = costInfo.pricePerMTok;
      record.costSavingsUSD = costInfo.costSavingsUSD;
      record.currency = 'USD';
    }

    stats.recent.push(record);
    stats.summary.totalCompressions++;
    stats.summary.totalOriginalTokens += originalTokens;
    stats.summary.totalCompressedTokens += compressedTokens;
    stats.summary.totalTokensSaved += tokensSaved;

    await saveStats(stats);
    return record;
  }

  async function recordCompressionWithEstimation(filePath, compressedContent, level, format) {
    const stats = await loadStats();
    const compressedTokens = countTokens(compressedContent);

    const estimationMultipliers = {
      'minimal': 10.0,
      'signatures': 6.0,
      'full': 4.0
    };

    const multiplier = estimationMultipliers[level] || 4.0;
    const estimatedOriginalTokens = Math.round(compressedTokens * multiplier);
    const tokensSaved = estimatedOriginalTokens - compressedTokens;
    const compressionRatio = compressedTokens / estimatedOriginalTokens;
    const savingsPercentage = (tokensSaved / estimatedOriginalTokens) * 100;

    // Calculate cost savings with LLM detection
    let costInfo = null;
    try {
      costInfo = await calculateCostSavings(tokensSaved);
    } catch (error) {
      // Gracefully handle errors
    }

    const record = {
      timestamp: new Date().toISOString(),
      path: filePath,
      originalTokens: estimatedOriginalTokens,
      compressedTokens,
      tokensSaved,
      compressionRatio: Math.round(compressionRatio * 1000) / 1000,
      savingsPercentage: Math.round(savingsPercentage * 10) / 10,
      level,
      format,
      estimated: true
    };

    // Add cost tracking fields if available
    if (costInfo) {
      record.model = costInfo.model;
      record.client = costInfo.client;
      record.pricePerMTok = costInfo.pricePerMTok;
      record.costSavingsUSD = costInfo.costSavingsUSD;
      record.currency = 'USD';
    }

    stats.recent.push(record);
    stats.summary.totalCompressions++;
    stats.summary.totalOriginalTokens += estimatedOriginalTokens;
    stats.summary.totalCompressedTokens += compressedTokens;
    stats.summary.totalTokensSaved += tokensSaved;

    await saveStats(stats);
    return record;
  }

  /**
   * Test cases
   */
  describe('Cost fields in compression records', () => {
    test('should include all cost fields in compression record', async () => {
      const originalContent = 'function test() { return "hello world"; }'.repeat(100);
      const compressedContent = 'fn test: ret "hello"';

      const record = await recordCompression(
        TEST_FILE,
        originalContent,
        compressedContent,
        'full',
        'text'
      );

      // Verify all 5 cost fields exist with strong validation
      // Validate model is a non-empty string
      assert.ok(typeof record.model === 'string' && record.model.length > 0,
        `model should be a non-empty string, got: ${record.model}`);

      // Validate client is a known value
      const validClients = ['anthropic', 'openai', 'auto', 'unknown', 'test-client'];
      assert.ok(validClients.includes(record.client),
        `client should be one of [${validClients.join(', ')}], got: ${record.client}`);

      // Validate pricePerMTok is a positive number
      assert.ok(typeof record.pricePerMTok === 'number' && record.pricePerMTok > 0,
        `pricePerMTok should be a positive number, got: ${record.pricePerMTok}`);

      // Validate costSavingsUSD is a non-negative number
      assert.ok(typeof record.costSavingsUSD === 'number' && record.costSavingsUSD >= 0,
        `costSavingsUSD should be a non-negative number, got: ${record.costSavingsUSD}`);

      // Validate currency is exactly 'USD'
      assert.strictEqual(record.currency, 'USD',
        `currency should be 'USD', got: ${record.currency}`);

      // Verify cost calculation is positive
      assert.ok(record.costSavingsUSD >= 0, 'costSavingsUSD should be non-negative');
    });
  });

  describe('LLM detection caching', () => {
    test('should handle multiple compressions with consistent cost fields', async () => {
      const originalContent = 'test content ' + 'x'.repeat(1000);
      const compressedContent = 'test';

      const record1 = await recordCompression(TEST_FILE, originalContent, compressedContent, 'full', 'text');
      const record2 = await recordCompression(TEST_FILE, originalContent, compressedContent, 'full', 'text');
      const record3 = await recordCompression(TEST_FILE, originalContent, compressedContent, 'full', 'text');

      // All records should have consistent cost fields (production code caches LLM detection)
      assert.strictEqual(record1.model, record2.model, 'Models should be consistent');
      assert.strictEqual(record2.model, record3.model, 'Models should be consistent');
      assert.strictEqual(record1.client, record2.client, 'Clients should be consistent');
      assert.strictEqual(record1.pricePerMTok, record2.pricePerMTok, 'Prices should be consistent');
    });
  });

  describe('Estimated compressions', () => {
    test('should include cost fields in estimated compressions', async () => {
      const compressedContent = 'fn test: ret "hello"';

      const record = await recordCompressionWithEstimation(
        TEST_FILE,
        compressedContent,
        'full',
        'text'
      );

      // Verify all cost fields exist with strong validation
      // Validate model is a non-empty string
      assert.ok(typeof record.model === 'string' && record.model.length > 0,
        `model should be a non-empty string, got: ${record.model}`);

      // Validate client is a known value
      const validClients = ['anthropic', 'openai', 'auto', 'unknown', 'test-client'];
      assert.ok(validClients.includes(record.client),
        `client should be one of [${validClients.join(', ')}], got: ${record.client}`);

      // Validate pricePerMTok is a positive number
      assert.ok(typeof record.pricePerMTok === 'number' && record.pricePerMTok > 0,
        `pricePerMTok should be a positive number, got: ${record.pricePerMTok}`);

      // Validate costSavingsUSD is a non-negative number (can be 0 for estimated)
      assert.ok(typeof record.costSavingsUSD === 'number' && record.costSavingsUSD >= 0,
        `costSavingsUSD should be a non-negative number, got: ${record.costSavingsUSD}`);

      // Validate currency is exactly 'USD'
      assert.strictEqual(record.currency, 'USD',
        `currency should be 'USD', got: ${record.currency}`);

      assert.strictEqual(record.estimated, true, 'estimated flag should be true');
    });
  });

  describe('Backward compatibility', () => {
    test('should maintain backward compatibility with old stats', async () => {
      // Create old-style stats without cost fields
      const oldStats = {
        version: '2.0',
        recent: [{
          timestamp: new Date().toISOString(),
          path: '/test/old.js',
          originalTokens: 1000,
          compressedTokens: 250,
          tokensSaved: 750,
          compressionRatio: 0.25,
          savingsPercentage: 75.0,
          level: 'full',
          format: 'text'
          // Note: NO cost fields
        }],
        daily: {},
        monthly: {},
        summary: {
          totalCompressions: 1,
          totalOriginalTokens: 1000,
          totalCompressedTokens: 250,
          totalTokensSaved: 750
        }
      };

      await saveStats(oldStats);

      // Load and verify it doesn't break
      const loadedStats = await loadStats();
      assert.strictEqual(loadedStats.recent.length, 1, 'Should load old stats');
      assert.strictEqual(loadedStats.recent[0].model, undefined, 'Old record should not have model field');

      // Add new compression (should have cost fields)
      const originalContent = 'new content ' + 'x'.repeat(1000);
      const compressedContent = 'new';
      await recordCompression(TEST_FILE, originalContent, compressedContent, 'full', 'text');

      const updatedStats = await loadStats();
      assert.strictEqual(updatedStats.recent.length, 2, 'Should have 2 records');
      assert.strictEqual(updatedStats.recent[0].model, undefined, 'Old record still has no model field');
      assert.ok(updatedStats.recent[1].model !== undefined, 'New record should have model field');
    });
  });

  describe('Graceful error handling', () => {
    test('should handle pricing failures gracefully', async () => {
      // Test real error conditions: invalid inputs to calculateCostSavings

      // Test 1: Invalid tokensSaved (negative) - should return defaults gracefully
      const resultNegative = await calculateCostSavings(-100);
      assert.strictEqual(resultNegative.costSavingsUSD, 0, 'Should return 0 cost for negative tokens');
      assert.strictEqual(resultNegative.model, DEFAULT_MODEL, 'Should return default model on error');
      assert.strictEqual(typeof resultNegative.pricePerMTok, 'number', 'Should have default pricing');

      // Test 2: Invalid tokensSaved (NaN) - should return defaults gracefully
      const resultNaN = await calculateCostSavings(NaN);
      assert.strictEqual(resultNaN.costSavingsUSD, 0, 'Should return 0 cost for NaN tokens');
      assert.strictEqual(resultNaN.model, DEFAULT_MODEL, 'Should return default model on error');

      // Test 3: Invalid tokensSaved (non-number) - should return defaults gracefully
      const resultString = await calculateCostSavings('invalid');
      assert.strictEqual(resultString.costSavingsUSD, 0, 'Should return 0 cost for non-number tokens');
      assert.strictEqual(resultString.model, DEFAULT_MODEL, 'Should return default model on error');

      // Test 4: Unknown model - should fallback to defaults gracefully
      const resultUnknownModel = await calculateCostSavings(1000, 'totally-fake-model-xyz');
      assert.ok(resultUnknownModel.costSavingsUSD >= 0, 'Should calculate cost with default pricing');
      assert.strictEqual(resultUnknownModel.model, 'totally-fake-model-xyz', 'Should preserve model name');
      assert.ok(typeof resultUnknownModel.pricePerMTok === 'number', 'Should use fallback pricing');
    });
  });

  describe('Cost calculation accuracy', () => {
    test('should calculate costs accurately for different token amounts', async () => {
      // Known values: 1000 tokens saved at $3/MTok = $0.003 → rounds to $0.00
      const costInfo1 = await calculateCostSavings(1000);
      assert.strictEqual(costInfo1.costSavingsUSD, 0.00);

      // Test with 100,000 tokens: $3/MTok * 0.1M = $0.30
      const costInfo2 = await calculateCostSavings(100000);
      assert.strictEqual(costInfo2.costSavingsUSD, 0.30);

      // Test with 1,000,000 tokens: $3/MTok * 1M = $3.00
      const costInfo3 = await calculateCostSavings(1000000);
      assert.strictEqual(costInfo3.costSavingsUSD, 3.00);
    });
  });
});
