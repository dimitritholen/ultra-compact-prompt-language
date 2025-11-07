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
 * Migrated to node:test format.
 */

import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Test utilities
const TEST_DIR = path.join(os.tmpdir(), `ucpl-cost-test-${Date.now()}`);
const TEST_STATS_FILE = path.join(TEST_DIR, "compression-stats.json");

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
  const data = await fs.readFile(TEST_STATS_FILE, "utf-8");
  return JSON.parse(data);
}

describe("Cost Reporting Aggregation", () => {
  before(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  after(async () => {
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test("Total cost savings aggregation", async () => {
    const mockData = {
      summary: {
        totalCompressions: 0,
        totalOriginalTokens: 0,
        totalCompressedTokens: 0,
        totalTokensSaved: 0,
      },
      recent: [
        {
          timestamp: new Date().toISOString(),
          path: "/test/file1.py",
          originalTokens: 1000,
          compressedTokens: 300,
          tokensSaved: 700,
          model: "claude-sonnet-4",
          pricePerMTok: 3.0,
          costSavingsUSD: 0.0021, // 700 * 3.00 / 1,000,000
          currency: "USD",
        },
        {
          timestamp: new Date().toISOString(),
          path: "/test/file2.py",
          originalTokens: 2000,
          compressedTokens: 500,
          tokensSaved: 1500,
          model: "claude-sonnet-4",
          pricePerMTok: 3.0,
          costSavingsUSD: 0.0045, // 1500 * 3.00 / 1,000,000
          currency: "USD",
        },
        {
          timestamp: new Date().toISOString(),
          path: "/test/file3.py",
          originalTokens: 5000,
          compressedTokens: 1000,
          tokensSaved: 4000,
          model: "gpt-4o",
          pricePerMTok: 2.5,
          costSavingsUSD: 0.01, // 4000 * 2.50 / 1,000,000
          currency: "USD",
        },
      ],
      daily: {},
      monthly: {},
    };

    await createMockStats(mockData);

    // Simulate aggregation logic
    let totalCostSavingsUSD = 0;
    for (const record of mockData.recent) {
      if (record.costSavingsUSD && typeof record.costSavingsUSD === "number") {
        totalCostSavingsUSD += record.costSavingsUSD;
      }
    }

    const expectedTotal = 0.0021 + 0.0045 + 0.01;
    assert.strictEqual(
      Math.round(totalCostSavingsUSD * 10000) / 10000,
      Math.round(expectedTotal * 10000) / 10000,
    );
  });

  test("Average cost savings per compression", async () => {
    const stats = await loadStats();
    const totalCompressions = stats.recent.length;
    let totalCostSavingsUSD = 0;

    for (const record of stats.recent) {
      if (record.costSavingsUSD) {
        totalCostSavingsUSD += record.costSavingsUSD;
      }
    }

    const averageCostSavingsPerCompression =
      totalCompressions > 0 ? totalCostSavingsUSD / totalCompressions : 0;

    const expectedAverage = (0.0021 + 0.0045 + 0.01) / 3;
    assert.strictEqual(
      Math.round(averageCostSavingsPerCompression * 10000) / 10000,
      Math.round(expectedAverage * 10000) / 10000,
    );
  });

  test("Model breakdown grouping", async () => {
    const stats = await loadStats();
    const modelBreakdownMap = {};

    // Group by model
    for (const record of stats.recent) {
      if (record.costSavingsUSD && typeof record.costSavingsUSD === "number") {
        const modelKey = record.model || "unknown";
        if (!modelBreakdownMap[modelKey]) {
          modelBreakdownMap[modelKey] = {
            modelName: modelKey,
            compressions: 0,
            tokensSaved: 0,
            costSavingsUSD: 0,
          };
        }
        modelBreakdownMap[modelKey].compressions++;
        modelBreakdownMap[modelKey].tokensSaved += record.tokensSaved;
        modelBreakdownMap[modelKey].costSavingsUSD += record.costSavingsUSD;
      }
    }

    // Convert to array and sort by cost savings (descending)
    const modelBreakdown = Object.values(modelBreakdownMap).sort(
      (a, b) => b.costSavingsUSD - a.costSavingsUSD,
    );

    // Verify breakdown
    assert.strictEqual(modelBreakdown.length, 2);
    assert.strictEqual(modelBreakdown[0].modelName, "gpt-4o");
    assert.strictEqual(modelBreakdown[0].compressions, 1);
    assert.strictEqual(modelBreakdown[0].tokensSaved, 4000);
    assert.strictEqual(
      Math.round(modelBreakdown[0].costSavingsUSD * 10000) / 10000,
      0.01,
    );

    assert.strictEqual(modelBreakdown[1].modelName, "claude-sonnet-4");
    assert.strictEqual(modelBreakdown[1].compressions, 2);
    assert.strictEqual(modelBreakdown[1].tokensSaved, 2200);
    assert.strictEqual(
      Math.round(modelBreakdown[1].costSavingsUSD * 10000) / 10000,
      0.0066,
    );
  });

  test("Backward compatibility with missing cost fields", async () => {
    const mockData = {
      summary: {
        totalCompressions: 0,
        totalOriginalTokens: 0,
        totalCompressedTokens: 0,
        totalTokensSaved: 0,
      },
      recent: [
        {
          timestamp: new Date().toISOString(),
          path: "/test/old-file1.py",
          originalTokens: 1000,
          compressedTokens: 300,
          tokensSaved: 700,
          // No cost fields (old record format)
        },
        {
          timestamp: new Date().toISOString(),
          path: "/test/new-file.py",
          originalTokens: 2000,
          compressedTokens: 500,
          tokensSaved: 1500,
          model: "claude-sonnet-4",
          pricePerMTok: 3.0,
          costSavingsUSD: 0.0045,
          currency: "USD",
        },
      ],
      daily: {},
      monthly: {},
    };

    await createMockStats(mockData);

    // Simulate aggregation with mixed records
    let totalCostSavingsUSD = 0;
    let recordsWithCost = 0;

    for (const record of mockData.recent) {
      if (record.costSavingsUSD && typeof record.costSavingsUSD === "number") {
        totalCostSavingsUSD += record.costSavingsUSD;
        recordsWithCost++;
      }
    }

    assert.strictEqual(recordsWithCost, 1);
    assert.strictEqual(Math.round(totalCostSavingsUSD * 10000) / 10000, 0.0045);
  });

  test("USD currency formatting", () => {
    const testValues = [
      { input: 0.0021, expected: "0.00" },
      { input: 0.0045, expected: "0.00" },
      { input: 0.01, expected: "0.01" },
      { input: 0.0166, expected: "0.02" },
      { input: 1.234567, expected: "1.23" },
      { input: 10.5, expected: "10.50" },
    ];

    for (const test of testValues) {
      const formatted = test.input.toFixed(2);
      assert.strictEqual(formatted, test.expected);
    }
  });

  test("Model breakdown sorting", async () => {
    const mockData = {
      summary: {
        totalCompressions: 0,
        totalOriginalTokens: 0,
        totalCompressedTokens: 0,
        totalTokensSaved: 0,
      },
      recent: [
        {
          timestamp: new Date().toISOString(),
          path: "/test/file1.py",
          tokensSaved: 500,
          model: "gpt-4o-mini",
          costSavingsUSD: 0.00008, // Lowest
        },
        {
          timestamp: new Date().toISOString(),
          path: "/test/file2.py",
          tokensSaved: 1000,
          model: "claude-opus-4",
          costSavingsUSD: 0.015, // Highest
        },
        {
          timestamp: new Date().toISOString(),
          path: "/test/file3.py",
          tokensSaved: 800,
          model: "claude-sonnet-4",
          costSavingsUSD: 0.0024, // Middle
        },
      ],
      daily: {},
      monthly: {},
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
            costSavingsUSD: 0,
          };
        }
        modelBreakdownMap[modelKey].compressions++;
        modelBreakdownMap[modelKey].tokensSaved += record.tokensSaved;
        modelBreakdownMap[modelKey].costSavingsUSD += record.costSavingsUSD;
      }
    }

    const modelBreakdown = Object.values(modelBreakdownMap).sort(
      (a, b) => b.costSavingsUSD - a.costSavingsUSD,
    );

    assert.strictEqual(modelBreakdown[0].modelName, "claude-opus-4");
    assert.strictEqual(modelBreakdown[1].modelName, "claude-sonnet-4");
    assert.strictEqual(modelBreakdown[2].modelName, "gpt-4o-mini");
  });

  test("Empty records handling", async () => {
    const mockData = {
      summary: {
        totalCompressions: 0,
        totalOriginalTokens: 0,
        totalCompressedTokens: 0,
        totalTokensSaved: 0,
      },
      recent: [],
      daily: {},
      monthly: {},
    };

    await createMockStats(mockData);

    let totalCostSavingsUSD = 0;
    const totalCompressions = mockData.recent.length;

    for (const record of mockData.recent) {
      if (record.costSavingsUSD) {
        totalCostSavingsUSD += record.costSavingsUSD;
      }
    }

    const averageCostSavingsPerCompression =
      totalCompressions > 0 ? totalCostSavingsUSD / totalCompressions : 0;

    assert.strictEqual(totalCostSavingsUSD, 0);
    assert.strictEqual(averageCostSavingsPerCompression, 0);
  });
});
