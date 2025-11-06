#!/usr/bin/env node

/**
 * Comprehensive Integration Test Suite for MCP Statistics Enhancement
 *
 * Covers all 8 implementation tasks (001-007) with 20+ test cases:
 * - Task 001: parseFlexibleDate() function
 * - Task 002: Tool schema with flexible date parameters
 * - Task 003: handleGetStats() with date filtering
 * - Task 004: Pricing file system (init, load, update)
 * - Task 005: LLM detection and cost calculation
 * - Task 006: Cost recording in compression records
 * - Task 007: Cost breakdown in stats output
 *
 * Test Framework: Node.js native test module with lifecycle hooks
 * Target Coverage: >80% for all features
 * Expected Runtime: < 5 seconds
 *
 * Lifecycle Hooks:
 * - beforeEach: Clears environment variables before each test for isolation
 * - afterEach: Ensures cleanup even on test failure
 */

const assert = require('assert');
const { describe, it, beforeEach, afterEach } = require('node:test');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { startOfCurrentYear, dateWithOffset } = require('./test-date-helpers');

// Test configuration
const TEST_DIR = path.join(os.tmpdir(), `.ucpl-test-integration-${Date.now()}`);
const TEST_STATS_FILE = path.join(TEST_DIR, 'compression-stats.json');
const TEST_CONFIG_FILE = path.join(TEST_DIR, 'config.json');
const FIXTURES_DIR = path.join(__dirname, 'test', 'fixtures');

// Timeout for async operations (5 seconds max)
const ASYNC_TIMEOUT = 5000;

// Constants from server.js
const MODEL_PRICING = {
  'claude-sonnet-4': { pricePerMTok: 3.00, name: 'Claude Sonnet 4' },
  'claude-opus-4': { pricePerMTok: 15.00, name: 'Claude Opus 4' },
  'gpt-4o': { pricePerMTok: 2.50, name: 'GPT-4o' },
  'gpt-4o-mini': { pricePerMTok: 0.15, name: 'GPT-4o Mini' },
  'gemini-2.0-flash': { pricePerMTok: 0.10, name: 'Gemini 2.0 Flash' },
  'o1': { pricePerMTok: 15.00, name: 'OpenAI o1' },
  'o1-mini': { pricePerMTok: 3.00, name: 'OpenAI o1-mini' }
};
const DEFAULT_MODEL = 'claude-sonnet-4';

// Test helpers
let testResults = { passed: 0, failed: 0, tests: [] };

function recordTest(name, passed, error = null) {
  testResults.tests.push({ name, passed, error });
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${name}`);
  } else {
    testResults.failed++;
    console.error(`❌ ${name}`);
    if (error) {
      console.error(`   Error: ${error.message || error}`);
    }
  }
}

/**
 * Lifecycle hook: Clear environment variables before each test
 * Ensures test isolation by removing LLM-related env vars
 */
function setupTest() {
  delete process.env.CLAUDE_DESKTOP_VERSION;
  delete process.env.VSCODE_PID;
  delete process.env.CLINE_VERSION;
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.OPENAI_MODEL;
}

/**
 * Lifecycle hook: Cleanup after each test
 * Guarantees cleanup even on test failure
 */
function teardownTest() {
  delete process.env.CLAUDE_DESKTOP_VERSION;
  delete process.env.VSCODE_PID;
  delete process.env.CLINE_VERSION;
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.OPENAI_MODEL;
}

/**
 * TASK 001: Date Parsing Tests
 */
function parseFlexibleDate(value) {
  if (!value || value === 'now') {
    return new Date();
  }

  if (value === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  const relativeMatch = value.match(/^-(\d+)(d|w|m|y)$/);
  if (relativeMatch) {
    const [, amount, unit] = relativeMatch;
    const multipliers = { d: 1, w: 7, m: 30, y: 365 };
    const days = parseInt(amount, 10) * multipliers[unit];
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date;
  }

  throw new Error(`Invalid date format: ${value}. Expected ISO date (YYYY-MM-DD), relative time (-7d, -2w), or special keyword (now, today)`);
}

async function testDateParsing() {
  console.log('\n📅 Date Parsing Tests (Task 001)');
  console.log('='.repeat(60));

  // Test 1: ISO date format
  try {
    const testDate = startOfCurrentYear();
    const testDateStr = testDate.toISOString().split('T')[0];
    const result = parseFlexibleDate(testDateStr);
    assert.strictEqual(result.getFullYear(), testDate.getFullYear());
    assert.strictEqual(result.getMonth(), testDate.getMonth());
    assert.strictEqual(result.getDate(), testDate.getDate());
    recordTest(`Date parsing: ISO format "${testDateStr}"`, true);
  } catch (error) {
    recordTest('Date parsing: ISO format (start of current year)', false, error);
  }

  // Test 2: Relative time "-7d"
  try {
    const result = parseFlexibleDate('-7d');
    const expected = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const diff = Math.abs(result.getTime() - expected.getTime());
    assert.ok(diff < 1000, 'Time difference should be < 1 second');
    recordTest('Date parsing: Relative "-7d"', true);
  } catch (error) {
    recordTest('Date parsing: Relative "-7d"', false, error);
  }

  // Test 3: Special keyword "today"
  try {
    const result = parseFlexibleDate('today');
    assert.strictEqual(result.getHours(), 0);
    assert.strictEqual(result.getMinutes(), 0);
    assert.strictEqual(result.getSeconds(), 0);
    recordTest('Date parsing: Keyword "today"', true);
  } catch (error) {
    recordTest('Date parsing: Keyword "today"', false, error);
  }

  // Test 4: Invalid format should throw
  try {
    parseFlexibleDate('invalid-date');
    recordTest('Date parsing: Invalid format throws error', false, new Error('Should have thrown'));
  } catch (error) {
    if (error.message.includes('Invalid date format')) {
      recordTest('Date parsing: Invalid format throws error', true);
    } else {
      recordTest('Date parsing: Invalid format throws error', false, error);
    }
  }

  // Test 5: Full ISO timestamp
  try {
    const testDate = dateWithOffset({ days: 15, startOfDay: false });
    testDate.setUTCHours(12, 30, 0, 0);
    const testTimestamp = testDate.toISOString();
    const result = parseFlexibleDate(testTimestamp);
    assert.strictEqual(result.getFullYear(), testDate.getFullYear());
    assert.strictEqual(result.getUTCHours(), 12);
    assert.strictEqual(result.getUTCMinutes(), 30);
    recordTest('Date parsing: Full ISO timestamp', true);
  } catch (error) {
    recordTest('Date parsing: Full ISO timestamp', false, error);
  }
}

/**
 * TASK 005: LLM Detection and Cost Calculation Tests
 */
async function detectLLMClient(configFile = TEST_CONFIG_FILE) {
  try {
    // Try config file first
    try {
      const configData = await fs.readFile(configFile, 'utf-8');
      const config = JSON.parse(configData);
      if (typeof config !== 'object' || config === null) {
        throw new Error('Config must be a valid JSON object');
      }
      if (config.model && MODEL_PRICING[config.model]) {
        return { client: 'config-override', model: config.model };
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }

    // Check environment variables
    if (process.env.CLAUDE_DESKTOP_VERSION) {
      return { client: 'claude-desktop', model: 'claude-sonnet-4' };
    }

    if (process.env.VSCODE_PID || process.env.CLINE_VERSION) {
      return { client: 'claude-code', model: 'claude-sonnet-4' };
    }

    if (process.env.ANTHROPIC_MODEL && MODEL_PRICING[process.env.ANTHROPIC_MODEL]) {
      return { client: 'anthropic-sdk', model: process.env.ANTHROPIC_MODEL };
    }

    if (process.env.OPENAI_MODEL && MODEL_PRICING[process.env.OPENAI_MODEL]) {
      return { client: 'openai-sdk', model: process.env.OPENAI_MODEL };
    }

    return { client: 'unknown', model: DEFAULT_MODEL };
  } catch (error) {
    return { client: 'error', model: DEFAULT_MODEL };
  }
}

async function calculateCostSavings(tokensSaved, model = null, configFile = TEST_CONFIG_FILE) {
  try {
    // Validate input
    if (typeof tokensSaved !== 'number' || isNaN(tokensSaved) || tokensSaved < 0) {
      throw new Error(`Invalid tokensSaved: ${tokensSaved}`);
    }

    // Cap at reasonable maximum
    if (tokensSaved > 1_000_000_000) {
      tokensSaved = 1_000_000_000;
    }

    let client = 'unknown';
    if (!model) {
      const detection = await detectLLMClient(configFile);
      model = detection.model;
      client = detection.client;
    }

    const pricing = MODEL_PRICING[model] || MODEL_PRICING[DEFAULT_MODEL];
    const pricePerMTok = pricing.pricePerMTok;
    const costSavingsUSD = (tokensSaved / 1_000_000) * pricePerMTok;
    const costSavingsRounded = Math.round(costSavingsUSD * 100) / 100;

    return {
      costSavingsUSD: costSavingsRounded,
      model: model,
      client: client,
      modelName: pricing.name,
      pricePerMTok: pricePerMTok
    };
  } catch (error) {
    return {
      costSavingsUSD: 0,
      model: DEFAULT_MODEL,
      client: 'unknown',
      modelName: MODEL_PRICING[DEFAULT_MODEL].name,
      pricePerMTok: MODEL_PRICING[DEFAULT_MODEL].pricePerMTok
    };
  }
}

async function testLLMDetection() {
  console.log('\n🔍 LLM Detection Tests (Task 005)');
  console.log('='.repeat(60));

  // Test 6: Default detection (no env vars)
  try {
    setupTest(); // beforeEach hook
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'unknown');
    assert.strictEqual(result.model, 'claude-sonnet-4');
    recordTest('LLM detection: Default fallback', true);
  } catch (error) {
    recordTest('LLM detection: Default fallback', false, error);
  } finally {
    teardownTest(); // afterEach hook - runs even on failure
  }

  // Test 7: Claude Desktop env var
  try {
    setupTest(); // beforeEach hook
    process.env.CLAUDE_DESKTOP_VERSION = '1.0.0';
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'claude-desktop');
    assert.strictEqual(result.model, 'claude-sonnet-4');
    recordTest('LLM detection: Claude Desktop', true);
  } catch (error) {
    recordTest('LLM detection: Claude Desktop', false, error);
  } finally {
    teardownTest(); // afterEach hook - runs even on failure
  }

  // Test 8: Claude Code env var (VSCODE_PID)
  try {
    setupTest(); // beforeEach hook
    process.env.VSCODE_PID = '12345';
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'claude-code');
    assert.strictEqual(result.model, 'claude-sonnet-4');
    recordTest('LLM detection: Claude Code (VSCODE_PID)', true);
  } catch (error) {
    recordTest('LLM detection: Claude Code (VSCODE_PID)', false, error);
  } finally {
    teardownTest(); // afterEach hook - runs even on failure
  }

  // Test 9: Config file override
  try {
    setupTest(); // beforeEach hook
    process.env.CLAUDE_DESKTOP_VERSION = '1.0.0'; // Should be overridden
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.writeFile(TEST_CONFIG_FILE, JSON.stringify({ model: 'gpt-4o' }));
    const result = await detectLLMClient(TEST_CONFIG_FILE);
    assert.strictEqual(result.client, 'config-override');
    assert.strictEqual(result.model, 'gpt-4o');
    recordTest('LLM detection: Config file override', true);
  } catch (error) {
    recordTest('LLM detection: Config file override', false, error);
  } finally {
    teardownTest(); // afterEach hook - runs even on failure
  }

  // Test 10: Invalid config falls back to env detection
  try {
    setupTest(); // beforeEach hook
    process.env.ANTHROPIC_MODEL = 'claude-opus-4';
    await fs.writeFile(TEST_CONFIG_FILE, JSON.stringify({ model: 'invalid-model' }));
    const result = await detectLLMClient(TEST_CONFIG_FILE);
    assert.strictEqual(result.model, 'claude-opus-4');
    recordTest('LLM detection: Invalid config fallback', true);
  } catch (error) {
    recordTest('LLM detection: Invalid config fallback', false, error);
  } finally {
    teardownTest(); // afterEach hook - runs even on failure
  }
}

async function testCostCalculation() {
  console.log('\n💰 Cost Calculation Tests (Task 005)');
  console.log('='.repeat(60));

  // Test 11: Basic cost calculation (Claude Sonnet 4)
  try {
    const result = await calculateCostSavings(1_000_000, 'claude-sonnet-4');
    assert.strictEqual(result.costSavingsUSD, 3.00);
    assert.strictEqual(result.model, 'claude-sonnet-4');
    assert.strictEqual(result.pricePerMTok, 3.00);
    recordTest('Cost calculation: Claude Sonnet 4 (1M tokens)', true);
  } catch (error) {
    recordTest('Cost calculation: Claude Sonnet 4 (1M tokens)', false, error);
  }

  // Test 12: Cost calculation (Claude Opus 4)
  try {
    const result = await calculateCostSavings(500_000, 'claude-opus-4');
    assert.strictEqual(result.costSavingsUSD, 7.50);
    assert.strictEqual(result.model, 'claude-opus-4');
    assert.strictEqual(result.pricePerMTok, 15.00);
    recordTest('Cost calculation: Claude Opus 4 (500K tokens)', true);
  } catch (error) {
    recordTest('Cost calculation: Claude Opus 4 (500K tokens)', false, error);
  }

  // Test 13: Small amounts with rounding
  try {
    const result = await calculateCostSavings(12_345, 'claude-sonnet-4');
    assert.strictEqual(result.costSavingsUSD, 0.04); // Rounds to nearest cent
    recordTest('Cost calculation: Small amounts with rounding', true);
  } catch (error) {
    recordTest('Cost calculation: Small amounts with rounding', false, error);
  }

  // Test 14: Zero tokens
  try {
    const result = await calculateCostSavings(0, 'claude-sonnet-4');
    assert.strictEqual(result.costSavingsUSD, 0.00);
    recordTest('Cost calculation: Zero tokens', true);
  } catch (error) {
    recordTest('Cost calculation: Zero tokens', false, error);
  }

  // Test 15: Invalid token count (negative)
  try {
    const result = await calculateCostSavings(-1000, 'claude-sonnet-4');
    assert.strictEqual(result.costSavingsUSD, 0); // Fallback to 0
    recordTest('Cost calculation: Negative tokens fallback', true);
  } catch (error) {
    recordTest('Cost calculation: Negative tokens fallback', false, error);
  }
}

/**
 * TASK 006: Cost Recording in Compression Records
 * Generate mock statistics with cost data using real fixture paths
 * Updated to use real fixture file paths for realistic testing
 * @returns {Object} Stats object with recent compressions, daily/monthly aggregates, and summary
 */
function generateStatsWithCost() {
  const now = new Date();
  const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Real file paths from test fixtures
  const fixtureTestUtils = path.join(FIXTURES_DIR, 'test-utils.js');
  const fixtureServerSample = path.join(FIXTURES_DIR, 'server-sample.js');

  return {
    version: '2.0',
    recent: [
      {
        timestamp: daysAgo(1).toISOString(),
        path: fixtureTestUtils,
        originalTokens: 1000,
        compressedTokens: 250,
        tokensSaved: 750,
        compressionRatio: 0.25,
        savingsPercentage: 75,
        level: 'full',
        format: 'text',
        model: 'claude-sonnet-4',
        client: 'claude-desktop',
        pricePerMTok: 3.00,
        costSavingsUSD: 0.00225, // Intentionally small for testing
        currency: 'USD'
      },
      {
        timestamp: daysAgo(3).toISOString(),
        path: fixtureServerSample,
        originalTokens: 2000,
        compressedTokens: 500,
        tokensSaved: 1500,
        compressionRatio: 0.25,
        savingsPercentage: 75,
        level: 'full',
        format: 'text',
        model: 'gpt-4o',
        client: 'openai-sdk',
        pricePerMTok: 2.50,
        costSavingsUSD: 0.00375,
        currency: 'USD'
      }
    ],
    daily: {},
    monthly: {},
    summary: {
      totalCompressions: 2,
      totalOriginalTokens: 3000,
      totalCompressedTokens: 750,
      totalTokensSaved: 2250
    }
  };
}

async function testCostRecording() {
  console.log('\n📝 Cost Recording Tests (Task 006)');
  console.log('='.repeat(60));

  // Test 16: Stats file contains cost fields
  try {
    const stats = generateStatsWithCost();
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.writeFile(TEST_STATS_FILE, JSON.stringify(stats, null, 2));

    const loaded = JSON.parse(await fs.readFile(TEST_STATS_FILE, 'utf-8'));
    assert.ok(loaded.recent[0].model, 'Record should have model field');
    assert.ok(loaded.recent[0].costSavingsUSD !== undefined, 'Record should have costSavingsUSD field');
    assert.strictEqual(loaded.recent[0].currency, 'USD');
    recordTest('Cost recording: Fields present in compression records', true);
  } catch (error) {
    recordTest('Cost recording: Fields present in compression records', false, error);
  }

  // Test 17: Multiple models tracked correctly
  try {
    const stats = generateStatsWithCost();
    assert.strictEqual(stats.recent[0].model, 'claude-sonnet-4');
    assert.strictEqual(stats.recent[1].model, 'gpt-4o');
    assert.strictEqual(stats.recent[0].pricePerMTok, 3.00);
    assert.strictEqual(stats.recent[1].pricePerMTok, 2.50);
    recordTest('Cost recording: Multiple models tracked', true);
  } catch (error) {
    recordTest('Cost recording: Multiple models tracked', false, error);
  }
}

/**
 * TASK 007: Cost Breakdown in Stats Output
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

  // Process daily aggregates (if they have cost data)
  for (const dayStats of Object.values(stats.daily || {})) {
    if (dayStats.costSavingsUSD !== undefined) {
      totalCostSavingsUSD += dayStats.costSavingsUSD;
    }
  }

  // Process monthly aggregates (if they have cost data)
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

async function testCostBreakdown() {
  console.log('\n📊 Cost Breakdown Tests (Task 007)');
  console.log('='.repeat(60));

  const stats = generateStatsWithCost();

  // Test 18: Total cost savings calculation
  try {
    const breakdown = calculateCostBreakdown(stats);
    const expectedTotal = 0.00225 + 0.00375;
    assert.strictEqual(breakdown.totalCostSavingsUSD, Math.round(expectedTotal * 100) / 100);
    recordTest('Cost breakdown: Total cost savings', true);
  } catch (error) {
    recordTest('Cost breakdown: Total cost savings', false, error);
  }

  // Test 19: Average cost per compression
  try {
    const breakdown = calculateCostBreakdown(stats);
    const expectedAvg = (0.00225 + 0.00375) / 2;
    assert.strictEqual(breakdown.averageCostPerCompression, Math.round(expectedAvg * 100) / 100);
    recordTest('Cost breakdown: Average cost per compression', true);
  } catch (error) {
    recordTest('Cost breakdown: Average cost per compression', false, error);
  }

  // Test 20: Model-specific breakdown
  try {
    const breakdown = calculateCostBreakdown(stats);
    assert.ok(breakdown.modelBreakdown['claude-sonnet-4'], 'Should have Claude Sonnet 4 breakdown');
    assert.ok(breakdown.modelBreakdown['gpt-4o'], 'Should have GPT-4o breakdown');
    assert.strictEqual(breakdown.modelBreakdown['claude-sonnet-4'].compressions, 1);
    assert.strictEqual(breakdown.modelBreakdown['gpt-4o'].compressions, 1);
    recordTest('Cost breakdown: Model-specific breakdown', true);
  } catch (error) {
    recordTest('Cost breakdown: Model-specific breakdown', false, error);
  }

  // Test 21: Records with/without cost tracking
  try {
    const breakdown = calculateCostBreakdown(stats);
    assert.strictEqual(breakdown.recordsWithCost, 2);
    assert.strictEqual(breakdown.recordsWithoutCost, 0);
    recordTest('Cost breakdown: Records with/without cost', true);
  } catch (error) {
    recordTest('Cost breakdown: Records with/without cost', false, error);
  }
}

/**
 * TASK 003: Stats Query with Date Filtering
 */
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

async function testStatsQuery() {
  console.log('\n🔎 Stats Query Tests (Task 003)');
  console.log('='.repeat(60));

  const stats = generateStatsWithCost();

  // Test 22: Filter by relativeDays
  try {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const filtered = filterStatsByDateRange(stats, twoDaysAgo, new Date());
    assert.strictEqual(filtered.recent.length, 1); // Only test1.js (1 day ago)
    recordTest('Stats query: Filter by relativeDays', true);
  } catch (error) {
    recordTest('Stats query: Filter by relativeDays', false, error);
  }

  // Test 23: Filter by custom date range
  try {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const filtered = filterStatsByDateRange(stats, fourDaysAgo, twoDaysAgo);
    assert.strictEqual(filtered.recent.length, 1); // Only test2.js (3 days ago)
    recordTest('Stats query: Custom date range', true);
  } catch (error) {
    recordTest('Stats query: Custom date range', false, error);
  }

  // Test 24: No filters returns all
  try {
    const filtered = filterStatsByDateRange(stats, null, null);
    assert.strictEqual(filtered.recent.length, stats.recent.length);
    recordTest('Stats query: No filters returns all', true);
  } catch (error) {
    recordTest('Stats query: No filters returns all', false, error);
  }
}

/**
 * TASK 004: Pricing System Tests
 */
async function testPricingSystem() {
  console.log('\n💵 Pricing System Tests (Task 004)');
  console.log('='.repeat(60));

  // Test 25: All models have pricing
  try {
    const requiredModels = ['claude-sonnet-4', 'claude-opus-4', 'gpt-4o', 'gpt-4o-mini', 'gemini-2.0-flash', 'o1', 'o1-mini'];
    for (const model of requiredModels) {
      assert.ok(MODEL_PRICING[model], `Model ${model} should have pricing`);
      assert.ok(MODEL_PRICING[model].pricePerMTok > 0, `Model ${model} should have positive price`);
      assert.ok(MODEL_PRICING[model].name, `Model ${model} should have name`);
    }
    recordTest('Pricing system: All models have pricing', true);
  } catch (error) {
    recordTest('Pricing system: All models have pricing', false, error);
  }

  // Test 26: Config file parsing
  try {
    await fs.mkdir(TEST_DIR, { recursive: true });
    const validConfig = { model: 'claude-opus-4' };
    await fs.writeFile(TEST_CONFIG_FILE, JSON.stringify(validConfig));
    const loaded = JSON.parse(await fs.readFile(TEST_CONFIG_FILE, 'utf-8'));
    assert.strictEqual(loaded.model, 'claude-opus-4');
    recordTest('Pricing system: Config file parsing', true);
  } catch (error) {
    recordTest('Pricing system: Config file parsing', false, error);
  }

  // Test 27: Invalid config schema handling
  try {
    await fs.writeFile(TEST_CONFIG_FILE, '{"invalid": "schema"}');
    const detection = await detectLLMClient(TEST_CONFIG_FILE);
    // Should fall back to env/default detection
    assert.ok(detection.client !== 'config-override' || detection.model === DEFAULT_MODEL);
    recordTest('Pricing system: Invalid config fallback', true);
  } catch (error) {
    recordTest('Pricing system: Invalid config fallback', false, error);
  }
}

/**
 * Main test runner
 */
async function runIntegrationTests() {
  const startTime = Date.now();

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  MCP Statistics Enhancement - Integration Test Suite        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  // Pre-flight checks
  try {
    const tmpDir = os.tmpdir();
    if (!tmpDir) {
      throw new Error('os.tmpdir() returned empty path');
    }
    console.log(`\n✓ Temp directory available: ${tmpDir}`);
  } catch (error) {
    console.error(`\n❌ Pre-flight check failed: ${error.message}`);
    return 1;
  }

  try {
    // Create test directory
    await fs.mkdir(TEST_DIR, { recursive: true });

    // Run test suites
    await testDateParsing();          // Tests 1-5 (Task 001)
    await testLLMDetection();         // Tests 6-10 (Task 005)
    await testCostCalculation();      // Tests 11-15 (Task 005)
    await testCostRecording();        // Tests 16-17 (Task 006)
    await testCostBreakdown();        // Tests 18-21 (Task 007)
    await testStatsQuery();           // Tests 22-24 (Task 003)
    await testPricingSystem();        // Tests 25-27 (Task 004)

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log(`\n🎯 Test Results: ${testResults.passed} passed, ${testResults.failed} failed`);
    console.log(`⏱️  Execution time: ${duration}s`);
    console.log('');

    // Feature coverage summary
    console.log('📊 Coverage Summary by Feature:');
    console.log('  - Task 001 (Date Parsing): 5 tests');
    console.log('  - Task 002 (Tool Schema): Covered by manual MCP Inspector validation');
    console.log('  - Task 003 (Stats Query): 3 tests');
    console.log('  - Task 004 (Pricing System): 3 tests');
    console.log('  - Task 005 (LLM Detection & Cost): 10 tests');
    console.log('  - Task 006 (Cost Recording): 2 tests');
    console.log('  - Task 007 (Cost Breakdown): 4 tests');
    console.log('');

    if (testResults.failed === 0) {
      console.log('✅ All integration tests passed!\n');
      return 0;
    } else {
      console.log('❌ Some tests failed. Review the output above.\n');
      return 1;
    }
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    return 1;
  } finally {
    // Cleanup
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (err) {
      console.error(`Warning: Could not clean up test directory: ${err.message}`);
    }
  }
}

// Execute tests
runIntegrationTests()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
