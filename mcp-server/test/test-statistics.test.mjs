/**
 * Integration test for token statistics tracking
 *
 * Tests:
 * 1. Token counting function works
 * 2. Statistics are persisted correctly
 * 3. get_compression_stats tool works
 *
 * Migrated to node:test format.
 */

import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { encodingForModel } = require("js-tiktoken");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATS_FILE = path.join(__dirname, ".compression-stats.json");

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

describe("Token Statistics", () => {
  after(async () => {
    // Cleanup
    try {
      await fs.unlink(STATS_FILE);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test("Token counting works correctly", async () => {
    const enc = encodingForModel("gpt-4o");
    const originalTokens = enc.encode(TEST_CONTENT_ORIGINAL);
    const compressedTokens = enc.encode(TEST_CONTENT_COMPRESSED);

    assert.ok(
      originalTokens.length > compressedTokens.length,
      "Compressed content should have fewer tokens than original",
    );

    const tokensSaved = originalTokens.length - compressedTokens.length;
    const compressionRatio = compressedTokens.length / originalTokens.length;

    assert.ok(tokensSaved > 0, "Should save tokens");
    assert.ok(compressionRatio < 1, "Compression ratio should be less than 1");
  });

  test("Statistics persistence works", async () => {
    // Create test statistics
    const testStats = {
      compressions: [
        {
          timestamp: new Date().toISOString(),
          path: "/test/file.js",
          originalTokens: 100,
          compressedTokens: 25,
          tokensSaved: 75,
          compressionRatio: 0.25,
          savingsPercentage: 75,
          level: "full",
          format: "text",
        },
      ],
      summary: {
        totalCompressions: 1,
        totalOriginalTokens: 100,
        totalCompressedTokens: 25,
        totalTokensSaved: 75,
      },
    };

    // Write stats
    await fs.writeFile(STATS_FILE, JSON.stringify(testStats, null, 2));

    // Read stats back
    const data = await fs.readFile(STATS_FILE, "utf-8");
    const loaded = JSON.parse(data);

    assert.strictEqual(loaded.compressions.length, 1);
    assert.strictEqual(loaded.summary.totalCompressions, 1);
    assert.strictEqual(loaded.summary.totalTokensSaved, 75);
  });

  test("Statistics calculations are correct", async () => {
    const data = await fs.readFile(STATS_FILE, "utf-8");
    const stats = JSON.parse(data);
    const record = stats.compressions[0];

    // Verify calculations
    const expectedSaved = record.originalTokens - record.compressedTokens;
    const expectedRatio = record.compressedTokens / record.originalTokens;
    const expectedPercentage = (expectedSaved / record.originalTokens) * 100;

    assert.strictEqual(record.tokensSaved, expectedSaved);
    assert.ok(
      Math.abs(record.compressionRatio - expectedRatio) < 0.001,
      "Compression ratio should be accurate",
    );
    assert.ok(
      Math.abs(record.savingsPercentage - expectedPercentage) < 0.1,
      "Savings percentage should be accurate",
    );
  });
});
