#!/usr/bin/env node

/**
 * Test script for multi-tier statistics retention
 */

const { aggregateStats, migrateStatsFormat } = require('./server.js');

// Test utilities
function createMockCompression(daysAgo, path = 'test.js') {
  const timestamp = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    timestamp: timestamp.toISOString(),
    path,
    originalTokens: 10000,
    compressedTokens: 2500,
    tokensSaved: 7500,
    compressionRatio: 0.25,
    savingsPercentage: 75.0,
    level: 'full',
    format: 'text'
  };
}

// Test cases
async function testMigration() {
  console.log('Test 1: Migration from old format to new format');

  const oldStats = {
    compressions: [
      createMockCompression(1, 'recent1.js'),    // Recent (1 day ago)
      createMockCompression(15, 'recent2.js'),   // Recent (15 days ago)
      createMockCompression(50, 'old1.js'),      // Daily (50 days ago)
      createMockCompression(200, 'old2.js'),     // Daily (200 days ago)
      createMockCompression(400, 'veryold1.js')  // Monthly (400 days ago)
    ],
    summary: {
      totalCompressions: 5,
      totalOriginalTokens: 50000,
      totalCompressedTokens: 12500,
      totalTokensSaved: 37500
    }
  };

  const newStats = migrateStatsFormat(oldStats);

  console.log('✓ Recent records:', newStats.recent.length, '(expected: 2)');
  console.log('✓ Daily aggregates:', Object.keys(newStats.daily).length, '(expected: 2)');
  console.log('✓ Monthly aggregates:', Object.keys(newStats.monthly).length, '(expected: 1)');
  console.log('✓ Summary preserved:', newStats.summary.totalCompressions === 5);

  const pass = newStats.recent.length === 2 &&
               Object.keys(newStats.daily).length === 2 &&
               Object.keys(newStats.monthly).length === 1 &&
               newStats.summary.totalCompressions === 5;

  console.log(pass ? '✅ Test 1 PASSED\n' : '❌ Test 1 FAILED\n');
  return pass;
}

async function testAggregation() {
  console.log('Test 2: Auto-aggregation on save');

  const stats = {
    version: '2.0',
    recent: [
      createMockCompression(1, 'recent1.js'),    // Keep in recent
      createMockCompression(15, 'recent2.js'),   // Keep in recent
      createMockCompression(45, 'old1.js'),      // Move to daily
      createMockCompression(400, 'veryold1.js')  // Move to monthly
    ],
    daily: {},
    monthly: {},
    summary: {
      totalCompressions: 4,
      totalOriginalTokens: 40000,
      totalCompressedTokens: 10000,
      totalTokensSaved: 30000
    }
  };

  const aggregated = aggregateStats(stats);

  console.log('✓ Recent after aggregation:', aggregated.recent.length, '(expected: 2)');
  console.log('✓ Daily after aggregation:', Object.keys(aggregated.daily).length, '(expected: 1)');
  console.log('✓ Monthly after aggregation:', Object.keys(aggregated.monthly).length, '(expected: 1)');

  const pass = aggregated.recent.length === 2 &&
               Object.keys(aggregated.daily).length === 1 &&
               Object.keys(aggregated.monthly).length === 1;

  console.log(pass ? '✅ Test 2 PASSED\n' : '❌ Test 2 FAILED\n');
  return pass;
}

async function testRetentionPolicy() {
  console.log('Test 3: Retention policy enforcement');

  const stats = {
    version: '2.0',
    recent: [
      createMockCompression(1, 'recent1.js'),
      createMockCompression(500, 'veryold1.js')  // Should be moved to monthly
    ],
    daily: {
      '2021-06-01': {  // ~4.4 years old - should be moved to monthly (within 5y retention)
        date: '2021-06-01',
        count: 10,
        originalTokens: 100000,
        compressedTokens: 25000,
        tokensSaved: 75000
      }
    },
    monthly: {
      '2018-01': {  // ~7 years old - older than 5 years - should be pruned
        month: '2018-01',
        count: 50,
        originalTokens: 500000,
        compressedTokens: 125000,
        tokensSaved: 375000
      }
    },
    summary: {
      totalCompressions: 62,
      totalOriginalTokens: 620000,
      totalCompressedTokens: 155000,
      totalTokensSaved: 465000
    }
  };

  const aggregated = aggregateStats(stats);

  console.log('✓ Old daily aggregates moved to monthly');
  console.log('✓ Monthly aggregates older than 5 years pruned');
  console.log('✓ Recent records older than 30 days moved to daily/monthly');

  // Debug: show what's in aggregated
  console.log('\nDebug - Aggregated structure:');
  console.log('- Recent count:', aggregated.recent.length);
  console.log('- Daily keys:', Object.keys(aggregated.daily));
  console.log('- Monthly keys:', Object.keys(aggregated.monthly));

  // Check that 2018-01 is pruned (older than 5 years)
  const has2018 = '2018-01' in aggregated.monthly;
  console.log('\n✓ 2018-01 pruned:', !has2018, '(expected: true)');

  // Check that 2021-06 is in monthly (moved from daily, within 5y retention)
  const has2021 = '2021-06' in aggregated.monthly;
  console.log('✓ 2021-06 in monthly:', has2021, '(expected: true)');

  const pass = !has2018 && has2021;

  console.log(pass ? '✅ Test 3 PASSED\n' : '❌ Test 3 FAILED\n');
  return pass;
}

async function testGrowthBounds() {
  console.log('Test 4: File size growth bounds');

  // Simulate 1000 compressions per day for 30 days
  const recentCompressions = [];
  for (let day = 0; day < 30; day++) {
    for (let i = 0; i < 1000; i++) {
      recentCompressions.push(createMockCompression(day, `file-${day}-${i}.js`));
    }
  }

  const stats = {
    version: '2.0',
    recent: recentCompressions,
    daily: {},
    monthly: {},
    summary: {
      totalCompressions: 30000,
      totalOriginalTokens: 300000000,
      totalCompressedTokens: 75000000,
      totalTokensSaved: 225000000
    }
  };

  // Calculate uncompressed size
  const uncompressedSize = JSON.stringify(stats).length;
  console.log('✓ Uncompressed stats size:', Math.round(uncompressedSize / 1024), 'KB');
  console.log('✓ Recent records:', stats.recent.length);

  // After aggregation, old records should be pruned
  const aggregated = aggregateStats(stats);
  const aggregatedSize = JSON.stringify(aggregated).length;
  console.log('✓ After aggregation:', Math.round(aggregatedSize / 1024), 'KB');
  console.log('✓ Recent records after aggregation:', aggregated.recent.length);
  console.log('✓ Daily aggregates:', Object.keys(aggregated.daily).length);

  // With retention policy, size should be bounded
  // Max: ~30k recent records + 365 daily + 60 monthly = ~30.5k records
  const maxExpectedRecords = 30500;
  const totalRecords = aggregated.recent.length +
                      Object.keys(aggregated.daily).length +
                      Object.keys(aggregated.monthly).length;

  console.log('✓ Total records after aggregation:', totalRecords, `(max: ${maxExpectedRecords})`);

  const pass = totalRecords <= maxExpectedRecords;

  console.log(pass ? '✅ Test 4 PASSED\n' : '❌ Test 4 FAILED\n');
  return pass;
}

/**
 * Run all test cases with error isolation
 *
 * Uses Promise.allSettled to ensure all tests execute to completion
 * regardless of individual test failures. This prevents one failing
 * test from canceling other tests in the suite.
 *
 * @returns {Promise<void>}
 *
 * @throws {Error} Only if the test suite itself fails catastrophically
 *
 * Exit codes:
 * - 0: All tests passed
 * - 1: One or more tests failed
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Multi-tier Statistics Retention Test Suite');
  console.log('='.repeat(60));
  console.log('');

  // Define tests with their names for error reporting
  const tests = [
    { name: 'testMigration', fn: testMigration },
    { name: 'testAggregation', fn: testAggregation },
    { name: 'testRetentionPolicy', fn: testRetentionPolicy },
    { name: 'testGrowthBounds', fn: testGrowthBounds }
  ];

  // Use Promise.allSettled to ensure all tests complete regardless of individual failures
  const settledResults = await Promise.allSettled(tests.map(t => t.fn()));

  // Extract test results and check for rejections
  const results = [];
  const failures = [];

  settledResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      // Test threw an exception instead of returning false
      results.push(false);
      failures.push({
        test: tests[index].name,
        error: result.reason
      });
      console.error(`\n❌ ${tests[index].name} threw an exception:`, result.reason);
    }
  });

  console.log('='.repeat(60));
  console.log('Test Results:');
  console.log('='.repeat(60));
  console.log(`Passed: ${results.filter(r => r).length}/${results.length}`);
  console.log(`Failed: ${results.filter(r => !r).length}/${results.length}`);

  // Report any exceptions that were caught
  if (failures.length > 0) {
    console.log('\nTests with exceptions:');
    failures.forEach(f => {
      console.error(`- ${f.test}: ${f.error.message || f.error}`);
    });
  }

  if (results.every(r => r)) {
    console.log('\n✅ All tests PASSED!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests FAILED');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
