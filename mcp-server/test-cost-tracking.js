#!/usr/bin/env node

/**
 * Test suite for cost tracking integration in recordCompression() and recordCompressionWithEstimation()
 *
 * Tests:
 * 1. Cost fields are added to compression records
 * 2. LLM detection is cached per server lifecycle
 * 3. Pricing is loaded and reused
 * 4. Graceful handling when pricing unavailable
 * 5. Backward compatibility with existing stats
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Test configuration
const TEST_STATS_DIR = path.join(os.tmpdir(), '.ucpl-test', 'compress');
const TEST_STATS_FILE = path.join(TEST_STATS_DIR, 'compression-stats-test.json');
const TEST_FILE = path.join(os.tmpdir(), 'test-compression.js');

// Mock functions - simulated versions from server.js
const MODEL_PRICING = {
  'claude-sonnet-4': { pricePerMTok: 3.00, name: 'Claude Sonnet 4' },
  'gpt-4o': { pricePerMTok: 2.50, name: 'GPT-4o' }
};

const DEFAULT_MODEL = 'claude-sonnet-4';
let cachedLLMClient = null;
let llmDetectionCallCount = 0;

/**
 * Mock detectLLMClient with caching
 */
async function detectLLMClient() {
  llmDetectionCallCount++;

  if (cachedLLMClient) {
    return cachedLLMClient;
  }

  // Simulate detection
  cachedLLMClient = { client: 'test-client', model: DEFAULT_MODEL };
  return cachedLLMClient;
}

/**
 * Mock calculateCostSavings
 */
async function calculateCostSavings(tokensSaved, model = null) {
  let client = 'unknown';
  if (!model) {
    const detection = await detectLLMClient();
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

/**
 * Mock countTokens (simplified)
 */
function countTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Load test stats
 */
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

/**
 * Save test stats
 */
async function saveStats(stats) {
  await fs.mkdir(TEST_STATS_DIR, { recursive: true });
  await fs.writeFile(TEST_STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8');
}

/**
 * Mock recordCompression with cost tracking
 */
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
    console.error(`[WARN] Cost calculation failed: ${error.message}`);
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

/**
 * Mock recordCompressionWithEstimation with cost tracking
 */
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
    console.error(`[WARN] Cost calculation failed: ${error.message}`);
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

// Test utilities
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertExists(value, fieldName) {
  assert(value !== undefined && value !== null, `${fieldName} should exist`);
}

/**
 * Clean up test environment
 */
async function cleanup() {
  try {
    await fs.rm(TEST_STATS_DIR, { recursive: true, force: true });
    await fs.rm(TEST_FILE, { force: true });
  } catch (err) {
    // Ignore cleanup errors
  }
  // Reset caches
  cachedLLMClient = null;
  llmDetectionCallCount = 0;
}

/**
 * Test 1: Cost fields are added to compression records
 */
async function testCostFieldsInRecords() {
  console.log('\n=== Test 1: Cost fields in compression records ===');

  const originalContent = 'function test() { return "hello world"; }'.repeat(100);
  const compressedContent = 'fn test: ret "hello"';

  const record = await recordCompression(
    TEST_FILE,
    originalContent,
    compressedContent,
    'full',
    'text'
  );

  // Verify all 5 cost fields exist
  assertExists(record.model, 'model');
  assertExists(record.client, 'client');
  assertExists(record.pricePerMTok, 'pricePerMTok');
  assertExists(record.costSavingsUSD, 'costSavingsUSD');
  assertExists(record.currency, 'currency');

  // Verify field types
  assert(typeof record.model === 'string', 'model should be string');
  assert(typeof record.client === 'string', 'client should be string');
  assert(typeof record.pricePerMTok === 'number', 'pricePerMTok should be number');
  assert(typeof record.costSavingsUSD === 'number', 'costSavingsUSD should be number');
  assert(record.currency === 'USD', 'currency should be USD');

  // Verify cost calculation is positive
  assert(record.costSavingsUSD >= 0, 'costSavingsUSD should be non-negative');

  console.log('✓ All cost fields present and valid');
  console.log(`  - Model: ${record.model}`);
  console.log(`  - Client: ${record.client}`);
  console.log(`  - Price per MTok: $${record.pricePerMTok}`);
  console.log(`  - Cost savings: $${record.costSavingsUSD}`);
  console.log(`  - Currency: ${record.currency}`);
}

/**
 * Test 2: LLM detection is cached
 */
async function testLLMDetectionCaching() {
  console.log('\n=== Test 2: LLM detection caching ===');

  const initialCallCount = llmDetectionCallCount;

  // Make multiple compression calls
  const originalContent = 'test content ' + 'x'.repeat(1000);
  const compressedContent = 'test';

  await recordCompression(TEST_FILE, originalContent, compressedContent, 'full', 'text');
  await recordCompression(TEST_FILE, originalContent, compressedContent, 'full', 'text');
  await recordCompression(TEST_FILE, originalContent, compressedContent, 'full', 'text');

  const finalCallCount = llmDetectionCallCount;
  const callsMade = finalCallCount - initialCallCount;

  // LLM detection should be called only once (cached afterwards)
  assert(callsMade === 1, `LLM detection should be called once, was called ${callsMade} times`);

  console.log(`✓ LLM detection called ${callsMade} time(s) for 3 compressions (cached correctly)`);
}

/**
 * Test 3: recordCompressionWithEstimation includes cost fields
 */
async function testEstimatedCompressionCostFields() {
  console.log('\n=== Test 3: Cost fields in estimated compressions ===');

  const compressedContent = 'fn test: ret "hello"';

  const record = await recordCompressionWithEstimation(
    TEST_FILE,
    compressedContent,
    'full',
    'text'
  );

  // Verify all cost fields exist
  assertExists(record.model, 'model');
  assertExists(record.client, 'client');
  assertExists(record.pricePerMTok, 'pricePerMTok');
  assertExists(record.costSavingsUSD, 'costSavingsUSD');
  assertExists(record.currency, 'currency');
  assert(record.estimated === true, 'estimated flag should be true');

  console.log('✓ All cost fields present in estimated compression');
  console.log(`  - Model: ${record.model}`);
  console.log(`  - Cost savings (estimated): $${record.costSavingsUSD}`);
}

/**
 * Test 4: Backward compatibility with existing stats
 */
async function testBackwardCompatibility() {
  console.log('\n=== Test 4: Backward compatibility ===');

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
  assert(loadedStats.recent.length === 1, 'Should load old stats');
  assert(!loadedStats.recent[0].model, 'Old record should not have model field');

  // Add new compression (should have cost fields)
  const originalContent = 'new content ' + 'x'.repeat(1000);
  const compressedContent = 'new';
  await recordCompression(TEST_FILE, originalContent, compressedContent, 'full', 'text');

  const updatedStats = await loadStats();
  assert(updatedStats.recent.length === 2, 'Should have 2 records');
  assert(!updatedStats.recent[0].model, 'Old record still has no model field');
  assertExists(updatedStats.recent[1].model, 'New record should have model field');

  console.log('✓ Backward compatibility maintained');
  console.log('  - Old records without cost fields: OK');
  console.log('  - New records with cost fields: OK');
}

/**
 * Test 5: Graceful handling when pricing unavailable
 */
async function testGracefulPricingFailure() {
  console.log('\n=== Test 5: Graceful handling of pricing failures ===');

  // Mock calculateCostSavings to throw error
  const originalCalcCost = calculateCostSavings;
  global.calculateCostSavings = async () => {
    throw new Error('Pricing service unavailable');
  };

  try {
    const originalContent = 'test content ' + 'x'.repeat(1000);
    const compressedContent = 'test';

    // Should not throw, should continue without cost info
    const record = await recordCompression(TEST_FILE, originalContent, compressedContent, 'full', 'text');

    // Cost fields should not exist (graceful degradation)
    assert(!record.model, 'model field should not exist when pricing fails');
    assert(!record.costSavingsUSD, 'costSavingsUSD should not exist when pricing fails');

    // But basic stats should still be recorded
    assertExists(record.originalTokens, 'originalTokens');
    assertExists(record.compressedTokens, 'compressedTokens');
    assertExists(record.tokensSaved, 'tokensSaved');

    console.log('✓ Gracefully handles pricing unavailability');
    console.log('  - Basic stats still recorded: OK');
    console.log('  - Cost fields omitted: OK');
  } finally {
    // Restore original function
    global.calculateCostSavings = originalCalcCost;
  }
}

/**
 * Test 6: Cost calculation accuracy
 */
async function testCostCalculationAccuracy() {
  console.log('\n=== Test 6: Cost calculation accuracy ===');

  // Known values: 1000 tokens saved at $3/MTok = $0.003
  const tokensSaved = 1000;
  const expectedCost = 0.00; // Rounds to 0.00 (less than 1 cent)

  const costInfo = await calculateCostSavings(tokensSaved);

  assert(costInfo.costSavingsUSD === expectedCost, `Expected $${expectedCost}, got $${costInfo.costSavingsUSD}`);

  // Test with 100,000 tokens: $3/MTok * 0.1M = $0.30
  const costInfo2 = await calculateCostSavings(100000);
  assert(costInfo2.costSavingsUSD === 0.30, `Expected $0.30, got $${costInfo2.costSavingsUSD}`);

  // Test with 1,000,000 tokens: $3/MTok * 1M = $3.00
  const costInfo3 = await calculateCostSavings(1000000);
  assert(costInfo3.costSavingsUSD === 3.00, `Expected $3.00, got $${costInfo3.costSavingsUSD}`);

  console.log('✓ Cost calculations are accurate');
  console.log(`  - 1,000 tokens → $${costInfo.costSavingsUSD}`);
  console.log(`  - 100,000 tokens → $${costInfo2.costSavingsUSD}`);
  console.log(`  - 1,000,000 tokens → $${costInfo3.costSavingsUSD}`);
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('Starting cost tracking integration tests...');

  let passed = 0;
  let failed = 0;

  const tests = [
    testCostFieldsInRecords,
    testLLMDetectionCaching,
    testEstimatedCompressionCostFields,
    testBackwardCompatibility,
    testGracefulPricingFailure,
    testCostCalculationAccuracy
  ];

  for (const test of tests) {
    try {
      await cleanup();
      await test();
      passed++;
    } catch (error) {
      failed++;
      console.error(`\n✗ Test failed: ${test.name}`);
      console.error(`  Error: ${error.message}`);
      console.error(`  Stack: ${error.stack}`);
    }
  }

  await cleanup();

  console.log('\n' + '='.repeat(60));
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
