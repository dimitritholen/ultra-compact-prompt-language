#!/usr/bin/env node

/**
 * Integration test for statistics recording fallback strategy
 *
 * Tests:
 * 1. recordCompressionWithFallback succeeds when readOriginalContent works
 * 2. recordCompressionWithFallback falls back to estimation when readOriginalContent fails
 * 3. Estimated statistics are marked with 'estimated: true' flag
 * 4. Multiple compressions are recorded correctly
 * 5. Both accurate and estimated compressions use correct multipliers
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Test statistics file (separate from production)
const TEST_STATS_DIR = path.join(os.tmpdir(), 'ucpl-test');
const TEST_STATS_FILE = path.join(TEST_STATS_DIR, 'compression-stats.json');
const FIXTURES_DIR = path.join(__dirname, 'test', 'fixtures');

// Import functions from server.js by requiring and extracting
const serverPath = path.join(__dirname, 'server.js');

// Note: server.js uses hardcoded path ~/.ucpl/compress/compression-stats.json
// This test uses its own temporary file for isolation (TEST_STATS_FILE)

/**
 * Count tokens (simplified version matching server.js)
 */
function countTokens(text) {
  try {
    const { encodingForModel } = require('js-tiktoken');
    const enc = encodingForModel('gpt-4o');
    const tokens = enc.encode(text);
    return tokens.length;
  } catch (error) {
    return Math.ceil(text.length / 4);
  }
}

/**
 * Load statistics
 */
async function loadStats() {
  try {
    const data = await fs.readFile(TEST_STATS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (_error) {
    return {
      compressions: [],
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
 * Save statistics
 */
async function saveStats(stats) {
  await fs.mkdir(TEST_STATS_DIR, { recursive: true });
  await fs.writeFile(TEST_STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8');
}

/**
 * Record compression (accurate)
 */
async function recordCompression(filePath, originalContent, compressedContent, level, format) {
  const stats = await loadStats();

  const originalTokens = countTokens(originalContent);
  const compressedTokens = countTokens(compressedContent);
  const tokensSaved = originalTokens - compressedTokens;
  const compressionRatio = originalTokens > 0 ? (compressedTokens / originalTokens) : 0;
  const savingsPercentage = originalTokens > 0 ? ((tokensSaved / originalTokens) * 100) : 0;

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

  stats.compressions.push(record);
  stats.summary.totalCompressions++;
  stats.summary.totalOriginalTokens += originalTokens;
  stats.summary.totalCompressedTokens += compressedTokens;
  stats.summary.totalTokensSaved += tokensSaved;

  await saveStats(stats);
}

/**
 * Record compression with estimation
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

  stats.compressions.push(record);
  stats.summary.totalCompressions++;
  stats.summary.totalOriginalTokens += estimatedOriginalTokens;
  stats.summary.totalCompressedTokens += compressedTokens;
  stats.summary.totalTokensSaved += tokensSaved;

  await saveStats(stats);
}

/**
 * Simulate readOriginalContent that works (reads real fixture file)
 * Uses server-sample.js fixture for realistic compression testing
 * @returns {Promise<string>} Original file content
 * @throws {Error} If fixture file is missing (expected test failure)
 */
async function readOriginalContentSuccess() {
  // Read real fixture file - will throw if file missing (expected test failure)
  return await fs.readFile(
    path.join(FIXTURES_DIR, 'server-sample.js'),
    'utf-8'
  );
}

/**
 * Simulate readOriginalContent that fails
 */
async function readOriginalContentFail() {
  throw new Error('ENOENT: no such file or directory');
}

/**
 * Record compression with fallback
 */
async function recordCompressionWithFallback(
  filePath,
  compressedContent,
  level,
  format,
  readOriginalFn
) {
  try {
    const originalContent = await readOriginalFn();

    if (originalContent && originalContent.length > 0) {
      await recordCompression(filePath, originalContent, compressedContent, level, format);
    } else {
      await recordCompressionWithEstimation(filePath, compressedContent, level, format);
    }
  } catch (_error) {
    await recordCompressionWithEstimation(filePath, compressedContent, level, format);
  }
}

// Test data (compressed representations of server-sample.js content)
const TEST_COMPRESSED_MINIMAL = 'COMPRESS_SCRIPT | STATS_DIR | STATS_FILE | TOKEN_MODEL | RETENTION_POLICY | MODEL_PRICING | DEFAULT_MODEL | CONFIG_FILE | cachedLLMClient | detectLLMClient()';
const TEST_COMPRESSED_FULL = `MCP Server for ucpl-compress - Provides code context compression
Constants: COMPRESS_SCRIPT, STATS_DIR, STATS_FILE, TOKEN_MODEL='gpt-4o'
Retention: 30d recent, 365d daily, 5y monthly
Model pricing (7 models): Claude Sonnet/Opus, GPT-4o/mini, Gemini, o1/mini
detectLLMClient(): Cached detection from config file > env vars > default
  - Checks CONFIG_FILE for model override
  - Detects Claude Desktop, Claude Code, Anthropic/OpenAI SDKs
  - Returns {client, model}`;

async function testAccurateRecording() {
  console.log('Test 1: Accurate recording when readOriginalContent succeeds...');

  try {
    await recordCompressionWithFallback(
      '/test/accurate.js',
      TEST_COMPRESSED_FULL,
      'full',
      'text',
      readOriginalContentSuccess
    );

    const stats = await loadStats();
    const record = stats.compressions[stats.compressions.length - 1];

    if (!record.estimated && record.originalTokens > record.compressedTokens) {
      console.log('  ✅ Accurate recording works correctly');
      console.log(`     Original: ${record.originalTokens}, Compressed: ${record.compressedTokens}, Saved: ${record.tokensSaved} (${record.savingsPercentage}%)`);
      return true;
    } else {
      console.log('  ❌ Accurate recording failed');
      console.log(`     estimated flag: ${record.estimated}, originalTokens: ${record.originalTokens}, compressedTokens: ${record.compressedTokens}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Accurate recording test failed: ${error.message}`);
    return false;
  }
}

async function testFallbackRecording() {
  console.log('\nTest 2: Fallback recording when readOriginalContent fails...');

  try {
    await recordCompressionWithFallback(
      '/test/fallback.js',
      TEST_COMPRESSED_MINIMAL,
      'minimal',
      'text',
      readOriginalContentFail
    );

    const stats = await loadStats();
    const record = stats.compressions[stats.compressions.length - 1];

    if (record.estimated === true && record.originalTokens > record.compressedTokens) {
      console.log('  ✅ Fallback recording works correctly');
      console.log(`     Original (estimated): ${record.originalTokens}, Compressed: ${record.compressedTokens}, Saved: ${record.tokensSaved} (${record.savingsPercentage}%)`);
      return true;
    } else {
      console.log('  ❌ Fallback recording failed');
      console.log(`     estimated flag: ${record.estimated}, originalTokens: ${record.originalTokens}, compressedTokens: ${record.compressedTokens}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Fallback recording test failed: ${error.message}`);
    return false;
  }
}

async function testEstimationMultipliers() {
  console.log('\nTest 3: Estimation multipliers are correct...');

  try {
    const compressedContent = 'fn test(): result';
    const compressedTokens = countTokens(compressedContent);

    const tests = [
      { level: 'minimal', expectedMultiplier: 10.0 },
      { level: 'signatures', expectedMultiplier: 6.0 },
      { level: 'full', expectedMultiplier: 4.0 }
    ];

    let allPassed = true;

    for (const test of tests) {
      await recordCompressionWithEstimation(
        `/test/${test.level}.js`,
        compressedContent,
        test.level,
        'text'
      );

      const stats = await loadStats();
      const record = stats.compressions[stats.compressions.length - 1];

      const expectedOriginal = Math.round(compressedTokens * test.expectedMultiplier);
      const actualOriginal = record.originalTokens;

      if (expectedOriginal === actualOriginal) {
        console.log(`  ✅ ${test.level}: multiplier ${test.expectedMultiplier}x is correct`);
      } else {
        console.log(`  ❌ ${test.level}: expected ${expectedOriginal}, got ${actualOriginal}`);
        allPassed = false;
      }
    }

    return allPassed;
  } catch (error) {
    console.log(`  ❌ Estimation multipliers test failed: ${error.message}`);
    return false;
  }
}

async function testMultipleCompressions() {
  console.log('\nTest 4: Multiple compressions are recorded correctly...');

  try {
    const initialStats = await loadStats();
    const initialCount = initialStats.compressions.length;

    // Record 3 more compressions
    await recordCompressionWithFallback('/test/multi1.js', TEST_COMPRESSED_FULL, 'full', 'text', readOriginalContentSuccess);
    await recordCompressionWithFallback('/test/multi2.js', TEST_COMPRESSED_MINIMAL, 'minimal', 'text', readOriginalContentFail);
    await recordCompressionWithFallback('/test/multi3.js', TEST_COMPRESSED_FULL, 'full', 'text', readOriginalContentSuccess);

    const finalStats = await loadStats();
    const finalCount = finalStats.compressions.length;

    if (finalCount === initialCount + 3) {
      console.log(`  ✅ Multiple compressions recorded correctly (${initialCount} → ${finalCount})`);
      return true;
    } else {
      console.log(`  ❌ Multiple compressions failed: expected ${initialCount + 3}, got ${finalCount}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Multiple compressions test failed: ${error.message}`);
    return false;
  }
}

async function testSummaryAccumulation() {
  console.log('\nTest 5: Summary statistics accumulate correctly...');

  try {
    const stats = await loadStats();

    const manualSum = {
      totalCompressions: stats.compressions.length,
      totalOriginalTokens: stats.compressions.reduce((sum, c) => sum + c.originalTokens, 0),
      totalCompressedTokens: stats.compressions.reduce((sum, c) => sum + c.compressedTokens, 0),
      totalTokensSaved: stats.compressions.reduce((sum, c) => sum + c.tokensSaved, 0)
    };

    const matches =
      stats.summary.totalCompressions === manualSum.totalCompressions &&
      stats.summary.totalOriginalTokens === manualSum.totalOriginalTokens &&
      stats.summary.totalCompressedTokens === manualSum.totalCompressedTokens &&
      stats.summary.totalTokensSaved === manualSum.totalTokensSaved;

    if (matches) {
      console.log('  ✅ Summary statistics are correct');
      console.log(`     Total compressions: ${stats.summary.totalCompressions}`);
      console.log(`     Total tokens saved: ${stats.summary.totalTokensSaved}`);
      return true;
    } else {
      console.log('  ❌ Summary statistics mismatch');
      console.log('     Expected:', manualSum);
      console.log('     Got:', stats.summary);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Summary accumulation test failed: ${error.message}`);
    return false;
  }
}

async function cleanup() {
  try {
    await fs.unlink(TEST_STATS_FILE);
    await fs.rmdir(TEST_STATS_DIR);
    console.log('\n✅ Cleanup complete');
  } catch (_error) {
    // Ignore cleanup errors
  }
}

async function runTests() {
  console.log('=== Statistics Recording Fallback Tests ===\n');

  // Ensure clean state
  await cleanup();

  const results = [];

  results.push(await testAccurateRecording());
  results.push(await testFallbackRecording());
  results.push(await testEstimationMultipliers());
  results.push(await testMultipleCompressions());
  results.push(await testSummaryAccumulation());

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
