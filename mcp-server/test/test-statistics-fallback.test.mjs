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

import {
  describe,
  test,
  before,
  after,
  beforeEach,
  afterEach,
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Test statistics file (separate from production)
const TEST_STATS_DIR = path.join(os.tmpdir(), "ucpl-test");
const TEST_STATS_FILE = path.join(TEST_STATS_DIR, "compression-stats.json");

/**
 * Count tokens (simplified version matching server.js)
 */
function countTokens(text) {
  try {
    // Try to dynamically import js-tiktoken
    // For simplicity in tests, we'll just use the fallback estimation
    return Math.ceil(text.length / 4);
  } catch (error) {
    // Fallback to simple estimation
    return Math.ceil(text.length / 4);
  }
}

/**
 * Load statistics
 */
async function loadStats() {
  try {
    const data = await fs.readFile(TEST_STATS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (_error) {
    return {
      compressions: [],
      summary: {
        totalCompressions: 0,
        totalOriginalTokens: 0,
        totalCompressedTokens: 0,
        totalTokensSaved: 0,
      },
    };
  }
}

/**
 * Save statistics
 */
async function saveStats(stats) {
  await fs.mkdir(TEST_STATS_DIR, { recursive: true });
  await fs.writeFile(TEST_STATS_FILE, JSON.stringify(stats, null, 2), "utf-8");
}

/**
 * Record compression (accurate)
 */
async function recordCompression(
  filePath,
  originalContent,
  compressedContent,
  level,
  format,
) {
  const stats = await loadStats();

  const originalTokens = countTokens(originalContent);
  const compressedTokens = countTokens(compressedContent);
  const tokensSaved = originalTokens - compressedTokens;
  const compressionRatio =
    originalTokens > 0 ? compressedTokens / originalTokens : 0;
  const savingsPercentage =
    originalTokens > 0 ? (tokensSaved / originalTokens) * 100 : 0;

  const record = {
    timestamp: new Date().toISOString(),
    path: filePath,
    originalTokens,
    compressedTokens,
    tokensSaved,
    compressionRatio: Math.round(compressionRatio * 1000) / 1000,
    savingsPercentage: Math.round(savingsPercentage * 10) / 10,
    level,
    format,
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
async function recordCompressionWithEstimation(
  filePath,
  compressedContent,
  level,
  format,
) {
  const stats = await loadStats();
  const compressedTokens = countTokens(compressedContent);

  const estimationMultipliers = {
    minimal: 10.0,
    signatures: 6.0,
    full: 4.0,
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
    estimated: true,
  };

  stats.compressions.push(record);
  stats.summary.totalCompressions++;
  stats.summary.totalOriginalTokens += estimatedOriginalTokens;
  stats.summary.totalCompressedTokens += compressedTokens;
  stats.summary.totalTokensSaved += tokensSaved;

  await saveStats(stats);
}

/**
 * Simulate readOriginalContent that works
 */
async function readOriginalContentSuccess() {
  return `
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

function applyDiscount(total, discountPercent) {
  return total * (1 - discountPercent / 100);
}
  `.trim();
}

/**
 * Simulate readOriginalContent that fails
 */
async function readOriginalContentFail() {
  throw new Error("ENOENT: no such file or directory");
}

/**
 * Record compression with fallback
 */
async function recordCompressionWithFallback(
  filePath,
  compressedContent,
  level,
  format,
  readOriginalFn,
) {
  try {
    const originalContent = await readOriginalFn();

    if (originalContent && originalContent.length > 0) {
      await recordCompression(
        filePath,
        originalContent,
        compressedContent,
        level,
        format,
      );
    } else {
      await recordCompressionWithEstimation(
        filePath,
        compressedContent,
        level,
        format,
      );
    }
  } catch (_error) {
    await recordCompressionWithEstimation(
      filePath,
      compressedContent,
      level,
      format,
    );
  }
}

// Test data
const TEST_COMPRESSED_MINIMAL =
  "fn calculateTotal(items): sum | fn formatCurrency(amount): USD | fn applyDiscount(t,d): t*(1-d/100)";
const TEST_COMPRESSED_FULL = `calculateTotal(items): Sums price*quantity for items
formatCurrency(amount): Formats as USD currency
applyDiscount(total, discountPercent): Applies percentage discount`;

describe("Statistics Recording Fallback Tests", () => {
  before(async () => {
    // Ensure clean state
    try {
      await fs.rm(TEST_STATS_DIR, { recursive: true, force: true });
    } catch (_error) {
      // Directory might not exist
    }
  });

  after(async () => {
    // Cleanup
    try {
      await fs.rm(TEST_STATS_DIR, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe("Accurate Recording", () => {
    test("should record accurately when readOriginalContent succeeds", async (t) => {
      await recordCompressionWithFallback(
        "/test/accurate.js",
        TEST_COMPRESSED_FULL,
        "full",
        "text",
        readOriginalContentSuccess,
      );

      const stats = await loadStats();
      const record = stats.compressions[stats.compressions.length - 1];

      t.diagnostic(
        `Original: ${record.originalTokens}, Compressed: ${record.compressedTokens}, Saved: ${record.tokensSaved} (${record.savingsPercentage}%)`,
      );

      assert.strictEqual(
        record.estimated,
        undefined,
        "Should not have estimated flag",
      );
      assert.ok(
        record.originalTokens > record.compressedTokens,
        "Original should be greater than compressed",
      );
    });
  });

  describe("Fallback Recording", () => {
    test("should use fallback estimation when readOriginalContent fails", async (t) => {
      await recordCompressionWithFallback(
        "/test/fallback.js",
        TEST_COMPRESSED_MINIMAL,
        "minimal",
        "text",
        readOriginalContentFail,
      );

      const stats = await loadStats();
      const record = stats.compressions[stats.compressions.length - 1];

      t.diagnostic(
        `Original (estimated): ${record.originalTokens}, Compressed: ${record.compressedTokens}, Saved: ${record.tokensSaved} (${record.savingsPercentage}%)`,
      );

      assert.strictEqual(record.estimated, true, "Should have estimated flag");
      assert.ok(
        record.originalTokens > record.compressedTokens,
        "Original should be greater than compressed",
      );
    });
  });

  describe("Estimation Multipliers", () => {
    test("should use correct multiplier for minimal level (10.0x)", async () => {
      const compressedContent = "fn test(): result";
      const compressedTokens = countTokens(compressedContent);

      await recordCompressionWithEstimation(
        "/test/minimal.js",
        compressedContent,
        "minimal",
        "text",
      );

      const stats = await loadStats();
      const record = stats.compressions[stats.compressions.length - 1];

      const expectedOriginal = Math.round(compressedTokens * 10.0);
      assert.strictEqual(
        record.originalTokens,
        expectedOriginal,
        "Should use 10x multiplier for minimal",
      );
    });

    test("should use correct multiplier for signatures level (6.0x)", async () => {
      const compressedContent = "fn test(): result";
      const compressedTokens = countTokens(compressedContent);

      await recordCompressionWithEstimation(
        "/test/signatures.js",
        compressedContent,
        "signatures",
        "text",
      );

      const stats = await loadStats();
      const record = stats.compressions[stats.compressions.length - 1];

      const expectedOriginal = Math.round(compressedTokens * 6.0);
      assert.strictEqual(
        record.originalTokens,
        expectedOriginal,
        "Should use 6x multiplier for signatures",
      );
    });

    test("should use correct multiplier for full level (4.0x)", async () => {
      const compressedContent = "fn test(): result";
      const compressedTokens = countTokens(compressedContent);

      await recordCompressionWithEstimation(
        "/test/full.js",
        compressedContent,
        "full",
        "text",
      );

      const stats = await loadStats();
      const record = stats.compressions[stats.compressions.length - 1];

      const expectedOriginal = Math.round(compressedTokens * 4.0);
      assert.strictEqual(
        record.originalTokens,
        expectedOriginal,
        "Should use 4x multiplier for full",
      );
    });
  });

  describe("Multiple Compressions", () => {
    test("should record multiple compressions correctly", async () => {
      const initialStats = await loadStats();
      const initialCount = initialStats.compressions.length;

      // Record 3 more compressions
      await recordCompressionWithFallback(
        "/test/multi1.js",
        TEST_COMPRESSED_FULL,
        "full",
        "text",
        readOriginalContentSuccess,
      );
      await recordCompressionWithFallback(
        "/test/multi2.js",
        TEST_COMPRESSED_MINIMAL,
        "minimal",
        "text",
        readOriginalContentFail,
      );
      await recordCompressionWithFallback(
        "/test/multi3.js",
        TEST_COMPRESSED_FULL,
        "full",
        "text",
        readOriginalContentSuccess,
      );

      const finalStats = await loadStats();
      const finalCount = finalStats.compressions.length;

      assert.strictEqual(
        finalCount,
        initialCount + 3,
        "Should have 3 more compressions",
      );
    });
  });

  describe("Summary Accumulation", () => {
    test("should accumulate summary statistics correctly", async () => {
      const stats = await loadStats();

      const manualSum = {
        totalCompressions: stats.compressions.length,
        totalOriginalTokens: stats.compressions.reduce(
          (sum, c) => sum + c.originalTokens,
          0,
        ),
        totalCompressedTokens: stats.compressions.reduce(
          (sum, c) => sum + c.compressedTokens,
          0,
        ),
        totalTokensSaved: stats.compressions.reduce(
          (sum, c) => sum + c.tokensSaved,
          0,
        ),
      };

      assert.strictEqual(
        stats.summary.totalCompressions,
        manualSum.totalCompressions,
        "Total compressions should match",
      );
      assert.strictEqual(
        stats.summary.totalOriginalTokens,
        manualSum.totalOriginalTokens,
        "Total original tokens should match",
      );
      assert.strictEqual(
        stats.summary.totalCompressedTokens,
        manualSum.totalCompressedTokens,
        "Total compressed tokens should match",
      );
      assert.strictEqual(
        stats.summary.totalTokensSaved,
        manualSum.totalTokensSaved,
        "Total tokens saved should match",
      );
    });
  });
});
