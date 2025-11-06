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
 * Uses test-cache module for automatic cache reset between tests
 */

import { describe, test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  getCachedLLMClient,
  setCachedLLMClient,
  getLLMDetectionCallCount,
  incrementLLMDetectionCallCount,
  resetCache
} from './test-cache.mjs';

// Constants
const MODEL_PRICING = {
  'claude-sonnet-4': { pricePerMTok: 3.00, name: 'Claude Sonnet 4' },
  'gpt-4o': { pricePerMTok: 2.50, name: 'GPT-4o' }
};
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
  });

  afterEach(() => {
    // Automatically reset cache after each test for isolation
    resetCache();
  });

  /**
   * Helper functions (mocked versions from server.js)
   * Note: These functions use the test-cache module for caching
   */
  function detectLLMClient() {
    incrementLLMDetectionCallCount();

    const cached = getCachedLLMClient();
    if (cached) {
      return cached;
    }

    // Simulate detection
    const client = { client: 'test-client', model: DEFAULT_MODEL };
    setCachedLLMClient(client);
    return client;
  }

  function calculateCostSavings(tokensSaved, model = null) {
    let client = 'unknown';
    if (!model) {
      const detection = detectLLMClient();
      model = detection.model;
      client = detection.client;
    }

    const pricing = MODEL_PRICING[model] || MODEL_PRICING[DEFAULT_MODEL];
    const pricePerMTok = pricing.pricePerMTok;
    const costSavingsUSD = Math.round((tokensSaved / 1_000_000) * pricePerMTok * 100) / 100;

    return {
      costSavingsUSD,
      model,
      client,
      modelName: pricing.name,
      pricePerMTok
    };
  }

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
      costInfo = calculateCostSavings(tokensSaved);
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
      costInfo = calculateCostSavings(tokensSaved);
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
    test('should reuse cached LLM detection across multiple compressions', async () => {
      const originalContent = 'test content ' + 'x'.repeat(1000);
      const compressedContent = 'test';

      await recordCompression(TEST_FILE, originalContent, compressedContent, 'full', 'text');
      const firstClient = getCachedLLMClient();

      await recordCompression(TEST_FILE, originalContent, compressedContent, 'full', 'text');
      await recordCompression(TEST_FILE, originalContent, compressedContent, 'full', 'text');

      // Cache should be reused (same object reference)
      const currentClient = getCachedLLMClient();
      assert.strictEqual(currentClient, firstClient, 'Should reuse same cached client object');
      assert.strictEqual(currentClient.client, 'test-client');
      assert.strictEqual(currentClient.model, 'claude-sonnet-4');
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
      // Mock calculateCostSavings to throw error
      const originalCalcCost = calculateCostSavings;
      const mockCalculateCostSavings = async () => {
        throw new Error('Pricing service unavailable');
      };

      // Temporarily replace the function
      const originalRecordCompression = recordCompression;
      async function recordCompressionWithError(filePath, originalContent, compressedContent, level, format) {
        const stats = await loadStats();

        const originalTokens = countTokens(originalContent);
        const compressedTokens = countTokens(compressedContent);
        const tokensSaved = originalTokens - compressedTokens;
        const compressionRatio = originalTokens > 0 ? (compressedTokens / originalTokens) : 0;
        const savingsPercentage = originalTokens > 0 ? ((tokensSaved / originalTokens) * 100) : 0;

        // Calculate cost savings - this will fail
        let costInfo = null;
        try {
          costInfo = await mockCalculateCostSavings(tokensSaved);
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

      const originalContent = 'test content ' + 'x'.repeat(1000);
      const compressedContent = 'test';

      // Should not throw, should continue without cost info
      const record = await recordCompressionWithError(TEST_FILE, originalContent, compressedContent, 'full', 'text');

      // Cost fields should not exist (graceful degradation)
      assert.strictEqual(record.model, undefined, 'model field should not exist when pricing fails');
      assert.strictEqual(record.costSavingsUSD, undefined, 'costSavingsUSD should not exist when pricing fails');

      // But basic stats should still be recorded with strong validation
      // Validate originalTokens is a positive number
      assert.ok(typeof record.originalTokens === 'number' && record.originalTokens > 0,
        `originalTokens should be a positive number, got: ${record.originalTokens}`);

      // Validate compressedTokens is a non-negative number
      assert.ok(typeof record.compressedTokens === 'number' && record.compressedTokens >= 0,
        `compressedTokens should be a non-negative number, got: ${record.compressedTokens}`);

      // Validate tokensSaved is a positive number
      assert.ok(typeof record.tokensSaved === 'number' && record.tokensSaved > 0,
        `tokensSaved should be a positive number, got: ${record.tokensSaved}`);
    });
  });

  describe('Cost calculation accuracy', () => {
    test('should calculate costs accurately for different token amounts', () => {
      // Known values: 1000 tokens saved at $3/MTok = $0.003 → rounds to $0.00
      const costInfo1 = calculateCostSavings(1000);
      assert.strictEqual(costInfo1.costSavingsUSD, 0.00);

      // Test with 100,000 tokens: $3/MTok * 0.1M = $0.30
      const costInfo2 = calculateCostSavings(100000);
      assert.strictEqual(costInfo2.costSavingsUSD, 0.30);

      // Test with 1,000,000 tokens: $3/MTok * 1M = $3.00
      const costInfo3 = calculateCostSavings(1000000);
      assert.strictEqual(costInfo3.costSavingsUSD, 3.00);
    });
  });
});
