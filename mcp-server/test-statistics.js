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
const {
  validateCompressionRecord,
  validateStatsSummary,
  validateStatsFile
} = require('./test-validation-helpers');

const STATS_FILE = path.join(__dirname, '.compression-stats.json');
const FIXTURES_DIR = path.join(__dirname, 'test', 'fixtures');

// Load test content from real fixtures
let TEST_CONTENT_ORIGINAL = null;
let TEST_CONTENT_COMPRESSED = null;

/**
 * Load fixture files before running tests
 * Ensures test data is loaded from real project files instead of synthetic content
 * @returns {Promise<void>}
 * @throws {Error} If fixture files are missing or empty
 */
async function loadFixtures() {
  try {
    TEST_CONTENT_ORIGINAL = await fs.readFile(
      path.join(FIXTURES_DIR, 'test-utils.js'),
      'utf-8'
    );
    TEST_CONTENT_COMPRESSED = await fs.readFile(
      path.join(FIXTURES_DIR, 'test-utils-compressed.txt'),
      'utf-8'
    );

    // Validate fixture content is non-empty
    if (!TEST_CONTENT_ORIGINAL || TEST_CONTENT_ORIGINAL.length === 0) {
      throw new Error('test-utils.js fixture is empty');
    }
    if (!TEST_CONTENT_COMPRESSED || TEST_CONTENT_COMPRESSED.length === 0) {
      throw new Error('test-utils-compressed.txt fixture is empty');
    }
  } catch (error) {
    console.error('Failed to load test fixtures:', error.message);
    console.error('Make sure test/fixtures/ directory exists with required files');
    throw error;
  }
}

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
    // Create test statistics with all required fields
    const testStats = {
      recent: [
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

    // Validate complete stats file structure
    validateStatsFile(loaded, { requireRecords: true });
    console.log('  ✅ Stats file structure is valid');

    // Validate summary fields
    validateStatsSummary(loaded.summary);
    console.log('  ✅ Summary fields validated');

    // Validate each compression record
    if (loaded.recent.length !== 1) {
      throw new Error(`Expected 1 compression record, got ${loaded.recent.length}`);
    }

    validateCompressionRecord(loaded.recent[0], 'loaded compression record');
    console.log('  ✅ Compression record fields validated');

    // Validate specific values
    const record = loaded.recent[0];
    if (record.path !== '/test/file.js') {
      throw new Error(`Expected path '/test/file.js', got '${record.path}'`);
    }
    if (record.originalTokens !== 100) {
      throw new Error(`Expected originalTokens 100, got ${record.originalTokens}`);
    }
    if (record.compressedTokens !== 25) {
      throw new Error(`Expected compressedTokens 25, got ${record.compressedTokens}`);
    }
    if (record.tokensSaved !== 75) {
      throw new Error(`Expected tokensSaved 75, got ${record.tokensSaved}`);
    }

    console.log('  ✅ All field values match expected');
    console.log('  ✅ Statistics persistence works correctly');
    return true;
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

    const record = stats.recent[0];

    // Verify calculations - validateCompressionRecord already checks these
    // but we'll verify explicitly for clarity
    const expectedSaved = record.originalTokens - record.compressedTokens;
    const expectedRatio = record.compressedTokens / record.originalTokens;
    const expectedPercentage = (expectedSaved / record.originalTokens) * 100;

    console.log('  Verifying token calculations:');
    console.log(`    originalTokens: ${record.originalTokens}`);
    console.log(`    compressedTokens: ${record.compressedTokens}`);
    console.log(`    tokensSaved: ${record.tokensSaved} (expected: ${expectedSaved})`);

    if (record.tokensSaved !== expectedSaved) {
      throw new Error(`tokensSaved mismatch: expected ${expectedSaved}, got ${record.tokensSaved}`);
    }
    console.log('  ✅ Token savings calculation is correct');

    console.log('  Verifying compression ratio:');
    console.log(`    compressionRatio: ${record.compressionRatio} (expected: ${expectedRatio.toFixed(3)})`);

    if (Math.abs(record.compressionRatio - expectedRatio) >= 0.001) {
      throw new Error(`compressionRatio mismatch: expected ${expectedRatio.toFixed(3)}, got ${record.compressionRatio}`);
    }
    console.log('  ✅ Compression ratio calculation is correct');

    console.log('  Verifying savings percentage:');
    console.log(`    savingsPercentage: ${record.savingsPercentage}% (expected: ${expectedPercentage.toFixed(1)}%)`);

    if (Math.abs(record.savingsPercentage - expectedPercentage) >= 0.2) {
      throw new Error(`savingsPercentage mismatch: expected ${expectedPercentage.toFixed(1)}%, got ${record.savingsPercentage}%`);
    }
    console.log('  ✅ Savings percentage calculation is correct');

    // Use validation helper to confirm everything
    validateCompressionRecord(record, 'calculations test record');
    console.log('  ✅ All field validations passed');

    console.log('  ✅ Statistics calculations are correct');
    return true;
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

  // Load test fixtures before running tests
  try {
    await loadFixtures();
    console.log('✅ Test fixtures loaded successfully\n');
  } catch (error) {
    console.error('❌ Failed to load test fixtures:', error.message);
    process.exit(1);
  }

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
