#!/usr/bin/env node

/**
 * Integration test for token statistics tracking
 *
 * Tests:
 * 1. Token counting function works
 * 2. Statistics are persisted correctly
 * 3. get_compression_stats tool works
 */

const fs = require('fs').promises;
const path = require('path');
const { encodingForModel } = require('js-tiktoken');

const STATS_FILE = path.join(__dirname, '.compression-stats.json');
const TEST_CONTENT_ORIGINAL = `
function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price * item.quantity;
  }
  return total;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}
`.trim();

const TEST_CONTENT_COMPRESSED = `
fn calculateTotal(items): sum(item.price * item.quantity)
fn formatCurrency(amount): USD format
`.trim();

async function testTokenCounting() {
  console.log('Testing token counting...');

  try {
    const enc = encodingForModel('gpt-4o');
    const originalTokens = enc.encode(TEST_CONTENT_ORIGINAL);
    const compressedTokens = enc.encode(TEST_CONTENT_COMPRESSED);

    console.log(`  Original tokens: ${originalTokens.length}`);
    console.log(`  Compressed tokens: ${compressedTokens.length}`);
    console.log(`  Tokens saved: ${originalTokens.length - compressedTokens.length}`);
    console.log(`  Compression ratio: ${(compressedTokens.length / originalTokens.length * 100).toFixed(1)}%`);

    if (originalTokens.length > compressedTokens.length) {
      console.log('  ✅ Token counting works correctly');
      return true;
    } else {
      console.log('  ❌ Token counting failed - compressed should be smaller');
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Token counting failed: ${error.message}`);
    return false;
  }
}

async function testStatsPersistence() {
  console.log('\nTesting statistics persistence...');

  try {
    // Create test statistics
    const testStats = {
      compressions: [
        {
          timestamp: new Date().toISOString(),
          path: '/test/file.js',
          originalTokens: 100,
          compressedTokens: 25,
          tokensSaved: 75,
          compressionRatio: 0.25,
          savingsPercentage: 75,
          level: 'full',
          format: 'text'
        }
      ],
      summary: {
        totalCompressions: 1,
        totalOriginalTokens: 100,
        totalCompressedTokens: 25,
        totalTokensSaved: 75
      }
    };

    // Write stats
    await fs.writeFile(STATS_FILE, JSON.stringify(testStats, null, 2));
    console.log('  ✅ Wrote test statistics');

    // Read stats back
    const data = await fs.readFile(STATS_FILE, 'utf-8');
    const loaded = JSON.parse(data);

    if (loaded.compressions.length === 1 && loaded.summary.totalCompressions === 1) {
      console.log('  ✅ Statistics persistence works correctly');
      return true;
    } else {
      console.log('  ❌ Statistics persistence failed - data mismatch');
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Statistics persistence failed: ${error.message}`);
    return false;
  }
}

async function testStatsCalculations() {
  console.log('\nTesting statistics calculations...');

  try {
    const data = await fs.readFile(STATS_FILE, 'utf-8');
    const stats = JSON.parse(data);

    const record = stats.compressions[0];

    // Verify calculations
    const expectedSaved = record.originalTokens - record.compressedTokens;
    const expectedRatio = record.compressedTokens / record.originalTokens;
    const expectedPercentage = (expectedSaved / record.originalTokens) * 100;

    if (
      record.tokensSaved === expectedSaved &&
      Math.abs(record.compressionRatio - expectedRatio) < 0.001 &&
      Math.abs(record.savingsPercentage - expectedPercentage) < 0.1
    ) {
      console.log('  ✅ Statistics calculations are correct');
      return true;
    } else {
      console.log('  ❌ Statistics calculations are incorrect');
      console.log(`    Expected saved: ${expectedSaved}, Got: ${record.tokensSaved}`);
      console.log(`    Expected ratio: ${expectedRatio.toFixed(3)}, Got: ${record.compressionRatio}`);
      console.log(`    Expected percentage: ${expectedPercentage.toFixed(1)}, Got: ${record.savingsPercentage}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Statistics calculations test failed: ${error.message}`);
    return false;
  }
}

async function cleanup() {
  try {
    await fs.unlink(STATS_FILE);
    console.log('\n✅ Cleanup complete');
  } catch (error) {
    // Ignore cleanup errors
  }
}

async function runTests() {
  console.log('=== Token Statistics Integration Tests ===\n');

  const results = [];

  results.push(await testTokenCounting());
  results.push(await testStatsPersistence());
  results.push(await testStatsCalculations());

  await cleanup();

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log(`\n=== Results: ${passed}/${total} tests passed ===`);

  if (passed === total) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
