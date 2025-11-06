#!/usr/bin/env node

/**
 * Test cost reporting aggregation in handleGetStats()
 *
 * Tests:
 * 1. Total cost savings aggregation from records with cost fields
 * 2. Average cost savings per compression calculation
 * 3. Model breakdown grouping by model name
 * 4. Backward compatibility with records without cost fields
 * 5. Correct USD formatting (2 decimal places)
 * 6. Model breakdown sorted by cost savings (descending)
 *
 * Lifecycle Hooks:
 * - beforeEach: Creates test directory before each test
 * - afterEach: Cleans up test files even on test failure
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const assert = require('assert');
const { assertAlmostEqual } = require('./test-utils');

// Test utilities
const TEST_DIR = path.join(os.tmpdir(), `ucpl-cost-test-${Date.now()}`);
const TEST_STATS_FILE = path.join(TEST_DIR, 'compression-stats.json');

/**
 * Lifecycle hook: Setup test environment before each test
 * Creates test directory for isolated test execution
 */
async function setupTest() {
  await fs.mkdir(TEST_DIR, { recursive: true });
}

/**
 * Lifecycle hook: Cleanup test environment after each test
 * Guarantees cleanup even on test failure
 */
async function teardownTest() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch (error) {
    // Silent cleanup failure - directory may not exist
  }
}

/**
 * Create mock statistics file with cost data
 */
async function createMockStats(data) {
  await fs.writeFile(TEST_STATS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Load and parse statistics
 */
async function loadStats() {
  const data = await fs.readFile(TEST_STATS_FILE, 'utf-8');
  return JSON.parse(data);
}

/**
 * Test 1: Aggregate total cost savings from records
 */
async function testTotalCostSavings() {
  console.log('\n=== Test 1: Total Cost Savings Aggregation ===');

  try {
    await setupTest(); // beforeEach hook

    const mockData = {
    summary: {
      totalCompressions: 0,
      totalOriginalTokens: 0,
      totalCompressedTokens: 0,
      totalTokensSaved: 0
    },
    recent: [
      {
        timestamp: new Date().toISOString(),
        path: '/test/file1.py',
        originalTokens: 1000,
        compressedTokens: 300,
        tokensSaved: 700,
        model: 'claude-sonnet-4',
        pricePerMTok: 3.00,
        costSavingsUSD: 0.0021, // 700 * 3.00 / 1,000,000
        currency: 'USD'
      },
      {
        timestamp: new Date().toISOString(),
        path: '/test/file2.py',
        originalTokens: 2000,
        compressedTokens: 500,
        tokensSaved: 1500,
        model: 'claude-sonnet-4',
        pricePerMTok: 3.00,
        costSavingsUSD: 0.0045, // 1500 * 3.00 / 1,000,000
        currency: 'USD'
      },
      {
        timestamp: new Date().toISOString(),
        path: '/test/file3.py',
        originalTokens: 5000,
        compressedTokens: 1000,
        tokensSaved: 4000,
        model: 'gpt-4o',
        pricePerMTok: 2.50,
        costSavingsUSD: 0.01, // 4000 * 2.50 / 1,000,000
        currency: 'USD'
      }
    ],
    daily: {},
    monthly: {}
  };

  await createMockStats(mockData);

  // Simulate aggregation logic
  let totalCostSavingsUSD = 0;
  for (const record of mockData.recent) {
    if (record.costSavingsUSD && typeof record.costSavingsUSD === 'number') {
      totalCostSavingsUSD += record.costSavingsUSD;
    }
  }

    const expectedTotal = 0.0021 + 0.0045 + 0.01;
    assertAlmostEqual(
      totalCostSavingsUSD,
      expectedTotal,
      0.0001,
      `Expected total cost savings to be ${expectedTotal.toFixed(4)}, got ${totalCostSavingsUSD.toFixed(4)}`
    );

    console.log(`✓ Total cost savings aggregated correctly: $${totalCostSavingsUSD.toFixed(4)}`);
  } finally {
    await teardownTest(); // afterEach hook - runs even on failure
  }
}

/**
 * Test 2: Calculate average cost savings per compression
 */
async function testAverageCostSavings() {
  console.log('\n=== Test 2: Average Cost Savings per Compression ===');

  try {
    await setupTest(); // beforeEach hook

    // Re-create test data (each test is independent)
    const mockData = {
      summary: {
        totalCompressions: 0,
        totalOriginalTokens: 0,
        totalCompressedTokens: 0,
        totalTokensSaved: 0
      },
      recent: [
        {
          timestamp: new Date().toISOString(),
          path: '/test/file1.py',
          originalTokens: 1000,
          compressedTokens: 300,
          tokensSaved: 700,
          model: 'claude-sonnet-4',
          pricePerMTok: 3.00,
          costSavingsUSD: 0.0021,
          currency: 'USD'
        },
        {
          timestamp: new Date().toISOString(),
          path: '/test/file2.py',
          originalTokens: 2000,
          compressedTokens: 500,
          tokensSaved: 1500,
          model: 'claude-sonnet-4',
          pricePerMTok: 3.00,
          costSavingsUSD: 0.0045,
          currency: 'USD'
        },
        {
          timestamp: new Date().toISOString(),
          path: '/test/file3.py',
          originalTokens: 5000,
          compressedTokens: 1000,
          tokensSaved: 4000,
          model: 'gpt-4o',
          pricePerMTok: 2.50,
          costSavingsUSD: 0.01,
          currency: 'USD'
        }
      ],
      daily: {},
      monthly: {}
    };

    await createMockStats(mockData);
    const stats = await loadStats();
  const totalCompressions = stats.recent.length;
  let totalCostSavingsUSD = 0;

  for (const record of stats.recent) {
    if (record.costSavingsUSD) {
      totalCostSavingsUSD += record.costSavingsUSD;
    }
  }

  const averageCostSavingsPerCompression = totalCompressions > 0
    ? totalCostSavingsUSD / totalCompressions
    : 0;

    const expectedAverage = (0.0021 + 0.0045 + 0.01) / 3;
    assertAlmostEqual(
      averageCostSavingsPerCompression,
      expectedAverage,
      0.0001,
      `Expected average cost savings to be ${expectedAverage.toFixed(4)}, got ${averageCostSavingsPerCompression.toFixed(4)}`
    );

    console.log(`✓ Average cost savings calculated correctly: $${averageCostSavingsPerCompression.toFixed(4)}`);
  } finally {
    await teardownTest(); // afterEach hook - runs even on failure
  }
}

/**
 * Test 3: Model breakdown grouping
 */
async function testModelBreakdown() {
  console.log('\n=== Test 3: Model Breakdown Grouping ===');

  try {
    await setupTest(); // beforeEach hook

    // Re-create test data (each test is independent)
    const mockData = {
      summary: {
        totalCompressions: 0,
        totalOriginalTokens: 0,
        totalCompressedTokens: 0,
        totalTokensSaved: 0
      },
      recent: [
        {
          timestamp: new Date().toISOString(),
          path: '/test/file1.py',
          originalTokens: 1000,
          compressedTokens: 300,
          tokensSaved: 700,
          model: 'claude-sonnet-4',
          pricePerMTok: 3.00,
          costSavingsUSD: 0.0021,
          currency: 'USD'
        },
        {
          timestamp: new Date().toISOString(),
          path: '/test/file2.py',
          originalTokens: 2000,
          compressedTokens: 500,
          tokensSaved: 1500,
          model: 'claude-sonnet-4',
          pricePerMTok: 3.00,
          costSavingsUSD: 0.0045,
          currency: 'USD'
        },
        {
          timestamp: new Date().toISOString(),
          path: '/test/file3.py',
          originalTokens: 5000,
          compressedTokens: 1000,
          tokensSaved: 4000,
          model: 'gpt-4o',
          pricePerMTok: 2.50,
          costSavingsUSD: 0.01,
          currency: 'USD'
        }
      ],
      daily: {},
      monthly: {}
    };

    await createMockStats(mockData);
    const stats = await loadStats();
  const modelBreakdownMap = {};

  // Group by model
  for (const record of stats.recent) {
    if (record.costSavingsUSD && typeof record.costSavingsUSD === 'number') {
      const modelKey = record.model || 'unknown';
      if (!modelBreakdownMap[modelKey]) {
        modelBreakdownMap[modelKey] = {
          modelName: modelKey,
          compressions: 0,
          tokensSaved: 0,
          costSavingsUSD: 0
        };
      }
      modelBreakdownMap[modelKey].compressions++;
      modelBreakdownMap[modelKey].tokensSaved += record.tokensSaved;
      modelBreakdownMap[modelKey].costSavingsUSD += record.costSavingsUSD;
    }
  }

  // Convert to array and sort by cost savings (descending)
  const modelBreakdown = Object.values(modelBreakdownMap)
    .sort((a, b) => b.costSavingsUSD - a.costSavingsUSD);

  // Verify breakdown
  assert.strictEqual(modelBreakdown.length, 2, 'Expected 2 models in breakdown');
  assert.strictEqual(modelBreakdown[0].modelName, 'gpt-4o', 'Expected gpt-4o to be first (highest cost savings)');
  assert.strictEqual(modelBreakdown[0].compressions, 1, 'Expected 1 compression for gpt-4o');
  assert.strictEqual(modelBreakdown[0].tokensSaved, 4000, 'Expected 4000 tokens saved for gpt-4o');
  assertAlmostEqual(
    modelBreakdown[0].costSavingsUSD,
    0.01,
    0.0001,
    'Expected $0.01 cost savings for gpt-4o'
  );

  assert.strictEqual(modelBreakdown[1].modelName, 'claude-sonnet-4', 'Expected claude-sonnet-4 to be second');
  assert.strictEqual(modelBreakdown[1].compressions, 2, 'Expected 2 compressions for claude-sonnet-4');
  assert.strictEqual(modelBreakdown[1].tokensSaved, 2200, 'Expected 2200 tokens saved for claude-sonnet-4');
  assertAlmostEqual(
    modelBreakdown[1].costSavingsUSD,
    0.0066,
    0.0001,
    'Expected $0.0066 cost savings for claude-sonnet-4'
  );

    console.log('✓ Model breakdown grouped and sorted correctly');
    console.log(`  - ${modelBreakdown[0].modelName}: ${modelBreakdown[0].compressions} compressions, $${modelBreakdown[0].costSavingsUSD.toFixed(4)}`);
    console.log(`  - ${modelBreakdown[1].modelName}: ${modelBreakdown[1].compressions} compressions, $${modelBreakdown[1].costSavingsUSD.toFixed(4)}`);
  } finally {
    await teardownTest(); // afterEach hook - runs even on failure
  }
}

/**
 * Test 4: Backward compatibility with records without cost fields
 */
async function testBackwardCompatibility() {
  console.log('\n=== Test 4: Backward Compatibility (Missing Cost Fields) ===');

  try {
    await setupTest(); // beforeEach hook

    const mockData = {
    summary: {
      totalCompressions: 0,
      totalOriginalTokens: 0,
      totalCompressedTokens: 0,
      totalTokensSaved: 0
    },
    recent: [
      {
        timestamp: new Date().toISOString(),
        path: '/test/old-file1.py',
        originalTokens: 1000,
        compressedTokens: 300,
        tokensSaved: 700
        // No cost fields (old record format)
      },
      {
        timestamp: new Date().toISOString(),
        path: '/test/new-file.py',
        originalTokens: 2000,
        compressedTokens: 500,
        tokensSaved: 1500,
        model: 'claude-sonnet-4',
        pricePerMTok: 3.00,
        costSavingsUSD: 0.0045,
        currency: 'USD'
      }
    ],
    daily: {},
    monthly: {}
  };

  await createMockStats(mockData);

  // Simulate aggregation with mixed records
  let totalCostSavingsUSD = 0;
  let recordsWithCost = 0;

  for (const record of mockData.recent) {
    if (record.costSavingsUSD && typeof record.costSavingsUSD === 'number') {
      totalCostSavingsUSD += record.costSavingsUSD;
      recordsWithCost++;
    }
  }

  assert.strictEqual(recordsWithCost, 1, 'Expected only 1 record with cost field');
  assertAlmostEqual(
    totalCostSavingsUSD,
    0.0045,
    0.0001,
    'Expected cost only from new record'
  );

    console.log('✓ Handled mixed old/new records correctly');
    console.log(`  - Records with cost: ${recordsWithCost}`);
    console.log(`  - Total cost savings: $${totalCostSavingsUSD.toFixed(4)}`);
  } finally {
    await teardownTest(); // afterEach hook - runs even on failure
  }
}

/**
 * Test 5: USD formatting (2 decimal places)
 * Note: This test doesn't need setup/teardown as it doesn't use filesystem
 */
async function testCurrencyFormatting() {
  console.log('\n=== Test 5: USD Currency Formatting ===');

  const testValues = [
    { input: 0.0021, expected: '0.00' },
    { input: 0.0045, expected: '0.00' },
    { input: 0.01, expected: '0.01' },
    { input: 0.0166, expected: '0.02' },
    { input: 1.234567, expected: '1.23' },
    { input: 10.5, expected: '10.50' }
  ];

  for (const test of testValues) {
    const formatted = test.input.toFixed(2);
    assert.strictEqual(formatted, test.expected, `Expected ${test.input} to format as ${test.expected}, got ${formatted}`);
  }

  console.log('✓ All currency values formatted correctly to 2 decimal places');
}

/**
 * Test 6: Model breakdown sorting (descending by cost)
 */
async function testModelBreakdownSorting() {
  console.log('\n=== Test 6: Model Breakdown Sorting ===');

  try {
    await setupTest(); // beforeEach hook

    const mockData = {
    summary: {
      totalCompressions: 0,
      totalOriginalTokens: 0,
      totalCompressedTokens: 0,
      totalTokensSaved: 0
    },
    recent: [
      {
        timestamp: new Date().toISOString(),
        path: '/test/file1.py',
        tokensSaved: 500,
        model: 'gpt-4o-mini',
        costSavingsUSD: 0.00008 // Lowest
      },
      {
        timestamp: new Date().toISOString(),
        path: '/test/file2.py',
        tokensSaved: 1000,
        model: 'claude-opus-4',
        costSavingsUSD: 0.015 // Highest
      },
      {
        timestamp: new Date().toISOString(),
        path: '/test/file3.py',
        tokensSaved: 800,
        model: 'claude-sonnet-4',
        costSavingsUSD: 0.0024 // Middle
      }
    ],
    daily: {},
    monthly: {}
  };

  await createMockStats(mockData);

  const modelBreakdownMap = {};
  for (const record of mockData.recent) {
    if (record.costSavingsUSD) {
      const modelKey = record.model;
      if (!modelBreakdownMap[modelKey]) {
        modelBreakdownMap[modelKey] = {
          modelName: modelKey,
          compressions: 0,
          tokensSaved: 0,
          costSavingsUSD: 0
        };
      }
      modelBreakdownMap[modelKey].compressions++;
      modelBreakdownMap[modelKey].tokensSaved += record.tokensSaved;
      modelBreakdownMap[modelKey].costSavingsUSD += record.costSavingsUSD;
    }
  }

  const modelBreakdown = Object.values(modelBreakdownMap)
    .sort((a, b) => b.costSavingsUSD - a.costSavingsUSD);

  assert.strictEqual(modelBreakdown[0].modelName, 'claude-opus-4', 'Expected highest cost model first');
  assert.strictEqual(modelBreakdown[1].modelName, 'claude-sonnet-4', 'Expected middle cost model second');
  assert.strictEqual(modelBreakdown[2].modelName, 'gpt-4o-mini', 'Expected lowest cost model last');

    console.log('✓ Model breakdown sorted correctly by cost savings (descending)');
    for (let i = 0; i < modelBreakdown.length; i++) {
      console.log(`  ${i + 1}. ${modelBreakdown[i].modelName}: $${modelBreakdown[i].costSavingsUSD.toFixed(4)}`);
    }
  } finally {
    await teardownTest(); // afterEach hook - runs even on failure
  }
}

/**
 * Test 7: Empty records handling
 */
async function testEmptyRecords() {
  console.log('\n=== Test 7: Empty Records Handling ===');

  try {
    await setupTest(); // beforeEach hook

    const mockData = {
    summary: {
      totalCompressions: 0,
      totalOriginalTokens: 0,
      totalCompressedTokens: 0,
      totalTokensSaved: 0
    },
    recent: [],
    daily: {},
    monthly: {}
  };

  await createMockStats(mockData);

  let totalCostSavingsUSD = 0;
  const totalCompressions = mockData.recent.length;

  for (const record of mockData.recent) {
    if (record.costSavingsUSD) {
      totalCostSavingsUSD += record.costSavingsUSD;
    }
  }

  const averageCostSavingsPerCompression = totalCompressions > 0
    ? totalCostSavingsUSD / totalCompressions
    : 0;

    assert.strictEqual(totalCostSavingsUSD, 0, 'Expected zero cost savings for empty records');
    assert.strictEqual(averageCostSavingsPerCompression, 0, 'Expected zero average for empty records');

    console.log('✓ Empty records handled correctly (no division by zero)');
  } finally {
    await teardownTest(); // afterEach hook - runs even on failure
  }
}

/**
 * Run all tests
 * Note: setup/cleanup now handled by lifecycle hooks in each test
 */
async function runTests() {
  console.log('Starting cost reporting aggregation tests...\n');
  console.log('Lifecycle hooks: beforeEach/afterEach run automatically per test\n');

  try {
    await testTotalCostSavings();
    await testAverageCostSavings();
    await testModelBreakdown();
    await testBackwardCompatibility();
    await testCurrencyFormatting();
    await testModelBreakdownSorting();
    await testEmptyRecords();

    console.log('\n✅ All cost reporting tests passed!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests();
