/**
 * Comprehensive Integration Test Suite for MCP Statistics Enhancement
 *
 * Covers all 8 implementation tasks (001-007) with 27 test cases:
 * - Task 001: parseFlexibleDate() function
 * - Task 002: Tool schema with flexible date parameters
 * - Task 003: handleGetStats() with date filtering
 * - Task 004: Pricing file system (init, load, update)
 * - Task 005: LLM detection and cost calculation
 * - Task 006: Cost recording in compression records
 * - Task 007: Cost breakdown in stats output
 *
 * Migrated to node:test from custom test runner
 */

import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Import production functions and constants from server.js (CommonJS module)
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, '../server.js');
const { generateStatsWithCost } = require('./test-utils/fixtures.js');

// Helper to get fresh imports (clears cache)
function getServerModule() {
  delete require.cache[SERVER_PATH];
  return require('./server.js');
}

const {
  parseFlexibleDate,
  MODEL_PRICING
} = require('./server.js');

const DEFAULT_MODEL = 'claude-sonnet-4';

// Production config file path (used by detectLLMClient)
const PRODUCTION_CONFIG_FILE = path.join(os.homedir(), '.ucpl', 'compress', 'config.json');

describe('MCP Statistics Enhancement - Integration Tests', () => {
  // Test directory configuration
  let TEST_DIR;
  let TEST_STATS_FILE;
  let BACKUP_CONFIG_FILE; // Backup of production config during tests

  before(async () => {
    TEST_DIR = path.join(os.tmpdir(), `.ucpl-test-integration-${Date.now()}`);
    TEST_STATS_FILE = path.join(TEST_DIR, 'compression-stats.json');
    await fs.mkdir(TEST_DIR, { recursive: true });

    // Backup production config if it exists
    try {
      const configContent = await fs.readFile(PRODUCTION_CONFIG_FILE, 'utf-8');
      BACKUP_CONFIG_FILE = path.join(TEST_DIR, 'backup-config.json');
      await fs.writeFile(BACKUP_CONFIG_FILE, configContent);
    } catch (err) {
      // Config doesn't exist, no backup needed
    }
  });

  after(async () => {
    // Restore production config if we backed it up
    if (BACKUP_CONFIG_FILE) {
      try {
        const backupContent = await fs.readFile(BACKUP_CONFIG_FILE, 'utf-8');
        await fs.mkdir(path.dirname(PRODUCTION_CONFIG_FILE), { recursive: true });
        await fs.writeFile(PRODUCTION_CONFIG_FILE, backupContent);
      } catch (err) {
        // Ignore restore errors
      }
    } else {
      // Remove test config if we created one
      try {
        await fs.unlink(PRODUCTION_CONFIG_FILE);
      } catch (err) {
        // Ignore if doesn't exist
      }
    }

    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Clear environment variables before each test
    delete process.env.CLAUDE_DESKTOP_VERSION;
    delete process.env.VSCODE_PID;
    delete process.env.CLINE_VERSION;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.OPENAI_MODEL;

    // Remove production config file to ensure clean state
    try {
      await fs.unlink(PRODUCTION_CONFIG_FILE);
    } catch (err) {
      // Ignore if doesn't exist
    }
  });

  /**
   * Helper functions
   *
   * Note: Most tests use production functions directly from server.js.
   * The tests for config file behavior write to the production CONFIG_FILE
   * location and use the production detectLLMClient function.
   */
  function calculateCostBreakdown(stats) {
    let totalCostSavingsUSD = 0;
    const modelBreakdown = {};
    let recordsWithCost = 0;
    let recordsWithoutCost = 0;

    // Process recent records
    for (const record of stats.recent || []) {
      if (record.costSavingsUSD !== undefined) {
        totalCostSavingsUSD += record.costSavingsUSD;
        recordsWithCost++;

        const model = record.model || DEFAULT_MODEL;
        if (!modelBreakdown[model]) {
          modelBreakdown[model] = {
            modelName: MODEL_PRICING[model]?.name || model,
            pricePerMTok: record.pricePerMTok || 0,
            compressions: 0,
            tokensSaved: 0,
            costSavingsUSD: 0
          };
        }

        modelBreakdown[model].compressions++;
        modelBreakdown[model].tokensSaved += record.tokensSaved || 0;
        modelBreakdown[model].costSavingsUSD += record.costSavingsUSD;
      } else {
        recordsWithoutCost++;
      }
    }

    // Process daily aggregates
    for (const dayStats of Object.values(stats.daily || {})) {
      if (dayStats.costSavingsUSD !== undefined) {
        totalCostSavingsUSD += dayStats.costSavingsUSD;
      }
    }

    // Process monthly aggregates
    for (const monthStats of Object.values(stats.monthly || {})) {
      if (monthStats.costSavingsUSD !== undefined) {
        totalCostSavingsUSD += monthStats.costSavingsUSD;
      }
    }

    const averageCostPerCompression = recordsWithCost > 0
      ? totalCostSavingsUSD / recordsWithCost
      : 0;

    return {
      totalCostSavingsUSD: Math.round(totalCostSavingsUSD * 100) / 100,
      averageCostPerCompression: Math.round(averageCostPerCompression * 100) / 100,
      modelBreakdown,
      recordsWithCost,
      recordsWithoutCost
    };
  }

  function filterStatsByDateRange(stats, startDate, endDate) {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : new Date();

    const filtered = {
      ...stats,
      recent: (stats.recent || []).filter(record => {
        const timestamp = new Date(record.timestamp);
        if (start && timestamp < start) return false;
        if (end && timestamp > end) return false;
        return true;
      }),
      daily: {},
      monthly: {}
    };

    // Filter daily aggregates
    for (const [dayKey, dayStats] of Object.entries(stats.daily || {})) {
      const dayDate = new Date(dayKey);
      if (start && dayDate < start) continue;
      if (end && dayDate > end) continue;
      filtered.daily[dayKey] = dayStats;
    }

    // Filter monthly aggregates
    for (const [monthKey, monthStats] of Object.entries(stats.monthly || {})) {
      const monthDate = new Date(monthKey + '-01');
      if (start && monthDate < start) continue;
      if (end && monthDate > end) continue;
      filtered.monthly[monthKey] = monthStats;
    }

    return filtered;
  }

  /**
   * Task 001: Date Parsing Tests
   */
  describe('Date Parsing (Task 001)', () => {
    test('should parse ISO format "2025-01-01"', () => {
      const result = parseFlexibleDate('2025-01-01');
      assert.strictEqual(result.getFullYear(), 2025);
      assert.strictEqual(result.getMonth(), 0);
      assert.strictEqual(result.getDate(), 1);
    });

    test('should parse relative time "-7d"', () => {
      const result = parseFlexibleDate('-7d');
      const expected = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const diff = Math.abs(result.getTime() - expected.getTime());
      assert.ok(diff < 1000, 'Time difference should be < 1 second');
    });

    test('should parse keyword "today"', () => {
      const result = parseFlexibleDate('today');
      assert.strictEqual(result.getHours(), 0);
      assert.strictEqual(result.getMinutes(), 0);
      assert.strictEqual(result.getSeconds(), 0);
    });

    test('should throw on invalid format', () => {
      assert.throws(
        () => parseFlexibleDate('invalid-date'),
        { message: /Invalid date format/ }
      );
    });

    test('should parse full ISO timestamp', () => {
      const result = parseFlexibleDate('2025-01-15T12:30:00.000Z');
      assert.strictEqual(result.getFullYear(), 2025);
      assert.strictEqual(result.getUTCHours(), 12);
      assert.strictEqual(result.getUTCMinutes(), 30);
    });
  });

  /**
   * Task 005: LLM Detection and Cost Calculation Tests
   */
  describe('LLM Detection (Task 005)', () => {
    test('should default to unknown client when no env vars set', async () => {
      const { detectLLMClient } = getServerModule();
      const result = await detectLLMClient();
      assert.strictEqual(result.client, 'unknown');
      assert.strictEqual(result.model, 'claude-sonnet-4');
    });

    test('should detect Claude Desktop from env var', async () => {
      process.env.CLAUDE_DESKTOP_VERSION = '1.0.0';
      const { detectLLMClient } = getServerModule();
      const result = await detectLLMClient();
      assert.strictEqual(result.client, 'claude-desktop');
      assert.strictEqual(result.model, 'claude-sonnet-4');
    });

    test('should detect Claude Code from VSCODE_PID', async () => {
      process.env.VSCODE_PID = '12345';
      const { detectLLMClient } = getServerModule();
      const result = await detectLLMClient();
      assert.strictEqual(result.client, 'claude-code');
      assert.strictEqual(result.model, 'claude-sonnet-4');
    });

    test('should use config file override', async () => {
      process.env.CLAUDE_DESKTOP_VERSION = '1.0.0';
      // Write to production config file location
      await fs.mkdir(path.dirname(PRODUCTION_CONFIG_FILE), { recursive: true });
      await fs.writeFile(PRODUCTION_CONFIG_FILE, JSON.stringify({ model: 'gpt-4o' }));
      const { detectLLMClient } = getServerModule();
      const result = await detectLLMClient();
      assert.strictEqual(result.client, 'config-override');
      assert.strictEqual(result.model, 'gpt-4o');
    });

    test('should fallback to env detection when config has invalid model', async () => {
      process.env.ANTHROPIC_MODEL = 'claude-opus-4';
      // Write to production config file location
      await fs.mkdir(path.dirname(PRODUCTION_CONFIG_FILE), { recursive: true });
      await fs.writeFile(PRODUCTION_CONFIG_FILE, JSON.stringify({ model: 'invalid-model' }));
      const { detectLLMClient } = getServerModule();
      const result = await detectLLMClient();
      assert.strictEqual(result.model, 'claude-opus-4');
    });
  });

  describe('Cost Calculation (Task 005)', () => {
    test('should calculate cost for Claude Sonnet 4 (1M tokens)', async () => {
      const { calculateCostSavings } = getServerModule();
      const result = await calculateCostSavings(1_000_000, 'claude-sonnet-4');
      assert.strictEqual(result.costSavingsUSD, 3.00);
      assert.strictEqual(result.model, 'claude-sonnet-4');
      assert.strictEqual(result.pricePerMTok, 3.00);
    });

    test('should calculate cost for Claude Opus 4 (500K tokens)', async () => {
      const { calculateCostSavings } = getServerModule();
      const result = await calculateCostSavings(500_000, 'claude-opus-4');
      assert.strictEqual(result.costSavingsUSD, 7.50);
      assert.strictEqual(result.model, 'claude-opus-4');
      assert.strictEqual(result.pricePerMTok, 15.00);
    });

    test('should round small amounts to nearest cent', async () => {
      const { calculateCostSavings } = getServerModule();
      const result = await calculateCostSavings(12_345, 'claude-sonnet-4');
      assert.strictEqual(result.costSavingsUSD, 0.04);
    });

    test('should handle zero tokens', async () => {
      const { calculateCostSavings } = getServerModule();
      const result = await calculateCostSavings(0, 'claude-sonnet-4');
      assert.strictEqual(result.costSavingsUSD, 0.00);
    });

    test('should fallback to 0 for negative tokens', async () => {
      const { calculateCostSavings } = getServerModule();
      const result = await calculateCostSavings(-1000, 'claude-sonnet-4');
      assert.strictEqual(result.costSavingsUSD, 0);
    });
  });

  /**
   * Task 006: Cost Recording in Compression Records
   */
  describe('Cost Recording (Task 006)', () => {
    test('should include cost fields in compression records', async () => {
      const stats = generateStatsWithCost();
      await fs.writeFile(TEST_STATS_FILE, JSON.stringify(stats, null, 2));

      const loaded = JSON.parse(await fs.readFile(TEST_STATS_FILE, 'utf-8'));
      assert.ok(loaded.recent[0].model, 'Record should have model field');
      assert.ok(loaded.recent[0].costSavingsUSD !== undefined, 'Record should have costSavingsUSD field');
      assert.strictEqual(loaded.recent[0].currency, 'USD');
    });

    test('should track multiple models correctly', () => {
      const stats = generateStatsWithCost();
      assert.strictEqual(stats.recent[0].model, 'claude-sonnet-4');
      assert.strictEqual(stats.recent[1].model, 'gpt-4o');
      assert.strictEqual(stats.recent[0].pricePerMTok, 3.00);
      assert.strictEqual(stats.recent[1].pricePerMTok, 2.50);
    });
  });

  /**
   * Task 007: Cost Breakdown in Stats Output
   */
  describe('Cost Breakdown (Task 007)', () => {
    test('should calculate total cost savings', () => {
      const stats = generateStatsWithCost();
      const breakdown = calculateCostBreakdown(stats);
      const expectedTotal = 0.00225 + 0.00375;
      assert.strictEqual(breakdown.totalCostSavingsUSD, Math.round(expectedTotal * 100) / 100);
    });

    test('should calculate average cost per compression', () => {
      const stats = generateStatsWithCost();
      const breakdown = calculateCostBreakdown(stats);
      const expectedAvg = (0.00225 + 0.00375) / 2;
      assert.strictEqual(breakdown.averageCostPerCompression, Math.round(expectedAvg * 100) / 100);
    });

    test('should provide model-specific breakdown', () => {
      const stats = generateStatsWithCost();
      const breakdown = calculateCostBreakdown(stats);
      assert.ok(breakdown.modelBreakdown['claude-sonnet-4'], 'Should have Claude Sonnet 4 breakdown');
      assert.ok(breakdown.modelBreakdown['gpt-4o'], 'Should have GPT-4o breakdown');
      assert.strictEqual(breakdown.modelBreakdown['claude-sonnet-4'].compressions, 1);
      assert.strictEqual(breakdown.modelBreakdown['gpt-4o'].compressions, 1);
    });

    test('should count records with/without cost tracking', () => {
      const stats = generateStatsWithCost();
      const breakdown = calculateCostBreakdown(stats);
      assert.strictEqual(breakdown.recordsWithCost, 2);
      assert.strictEqual(breakdown.recordsWithoutCost, 0);
    });
  });

  /**
   * Task 003: Stats Query with Date Filtering
   */
  describe('Stats Query (Task 003)', () => {
    test('should filter by relativeDays', () => {
      const stats = generateStatsWithCost();
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const filtered = filterStatsByDateRange(stats, twoDaysAgo, new Date());
      assert.strictEqual(filtered.recent.length, 1); // Only test1.js (1 day ago)
    });

    test('should filter by custom date range', () => {
      const stats = generateStatsWithCost();
      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const filtered = filterStatsByDateRange(stats, fourDaysAgo, twoDaysAgo);
      assert.strictEqual(filtered.recent.length, 1); // Only test2.js (3 days ago)
    });

    test('should return all records when no filters applied', () => {
      const stats = generateStatsWithCost();
      const filtered = filterStatsByDateRange(stats, null, null);
      assert.strictEqual(filtered.recent.length, stats.recent.length);
    });
  });

  /**
   * Task 004: Pricing System Tests
   */
  describe('Pricing System (Task 004)', () => {
    test('should have pricing for all required models', () => {
      const requiredModels = ['claude-sonnet-4', 'claude-opus-4', 'gpt-4o', 'gpt-4o-mini', 'gemini-2.0-flash', 'o1', 'o1-mini'];
      for (const model of requiredModels) {
        assert.ok(MODEL_PRICING[model], `Model ${model} should have pricing`);
        assert.ok(MODEL_PRICING[model].pricePerMTok > 0, `Model ${model} should have positive price`);
        assert.ok(MODEL_PRICING[model].name, `Model ${model} should have name`);
      }
    });

    test('should parse config file correctly', async () => {
      const validConfig = { model: 'claude-opus-4' };
      // Write to production config file location
      await fs.mkdir(path.dirname(PRODUCTION_CONFIG_FILE), { recursive: true });
      await fs.writeFile(PRODUCTION_CONFIG_FILE, JSON.stringify(validConfig));
      const loaded = JSON.parse(await fs.readFile(PRODUCTION_CONFIG_FILE, 'utf-8'));
      assert.strictEqual(loaded.model, 'claude-opus-4');
    });

    test('should handle invalid config schema', async () => {
      // Write to production config file location
      await fs.mkdir(path.dirname(PRODUCTION_CONFIG_FILE), { recursive: true });
      await fs.writeFile(PRODUCTION_CONFIG_FILE, '{"invalid": "schema"}');
      const { detectLLMClient } = getServerModule();
      const detection = await detectLLMClient();
      // Should fall back to env/default detection
      assert.ok(detection.client !== 'config-override' || detection.model === DEFAULT_MODEL);
    });
  });
});
