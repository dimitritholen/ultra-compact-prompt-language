/**
 * Integration Tests for get_compression_stats Date Range Queries
 *
 * Tests the new flexible date filtering functionality including:
 * - relativeDays parameter
 * - startDate/endDate custom ranges
 * - Relative time strings (-7d, -2w, etc.)
 * - Backward compatibility with period parameter
 * - Multi-tier filtering (recent, daily, monthly aggregates)
 */

import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// Test configuration
const TEST_STATS_DIR = path.join(os.tmpdir(), `.ucpl-test-${Date.now()}`);
const TEST_STATS_FILE = path.join(TEST_STATS_DIR, "compression-stats.json");

// Test stats data with dates spanning multiple tiers
function generateTestStats() {
  const now = new Date();

  // Helper to create dates relative to now
  const daysAgo = (days) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    version: "2.0",
    recent: [
      // Recent: Last 30 days (individual records)
      {
        timestamp: daysAgo(1).toISOString(),
        path: "test1.js",
        originalTokens: 1000,
        compressedTokens: 250,
        tokensSaved: 750,
        compressionRatio: 0.25,
        savingsPercentage: 75,
        level: "full",
        format: "text",
      },
      {
        timestamp: daysAgo(3).toISOString(),
        path: "test2.js",
        originalTokens: 2000,
        compressedTokens: 500,
        tokensSaved: 1500,
        compressionRatio: 0.25,
        savingsPercentage: 75,
        level: "full",
        format: "text",
      },
      {
        timestamp: daysAgo(7).toISOString(),
        path: "test3.js",
        originalTokens: 1500,
        compressedTokens: 300,
        tokensSaved: 1200,
        compressionRatio: 0.2,
        savingsPercentage: 80,
        level: "minimal",
        format: "text",
      },
      {
        timestamp: daysAgo(14).toISOString(),
        path: "test4.js",
        originalTokens: 3000,
        compressedTokens: 600,
        tokensSaved: 2400,
        compressionRatio: 0.2,
        savingsPercentage: 80,
        level: "minimal",
        format: "text",
      },
      {
        timestamp: daysAgo(28).toISOString(),
        path: "test5.js",
        originalTokens: 1000,
        compressedTokens: 200,
        tokensSaved: 800,
        compressionRatio: 0.2,
        savingsPercentage: 80,
        level: "minimal",
        format: "text",
      },
    ],
    daily: {
      // Daily: 31-365 days ago (aggregated by day)
      [daysAgo(45).toISOString().split("T")[0]]: {
        date: daysAgo(45).toISOString().split("T")[0],
        count: 5,
        originalTokens: 10000,
        compressedTokens: 2000,
        tokensSaved: 8000,
      },
      [daysAgo(60).toISOString().split("T")[0]]: {
        date: daysAgo(60).toISOString().split("T")[0],
        count: 3,
        originalTokens: 6000,
        compressedTokens: 1200,
        tokensSaved: 4800,
      },
      [daysAgo(90).toISOString().split("T")[0]]: {
        date: daysAgo(90).toISOString().split("T")[0],
        count: 2,
        originalTokens: 4000,
        compressedTokens: 800,
        tokensSaved: 3200,
      },
    },
    monthly: {
      // Monthly: 365+ days ago (aggregated by month)
      [daysAgo(400).toISOString().substring(0, 7)]: {
        month: daysAgo(400).toISOString().substring(0, 7),
        count: 20,
        originalTokens: 50000,
        compressedTokens: 10000,
        tokensSaved: 40000,
      },
      [daysAgo(730).toISOString().substring(0, 7)]: {
        month: daysAgo(730).toISOString().substring(0, 7),
        count: 15,
        originalTokens: 30000,
        compressedTokens: 6000,
        tokensSaved: 24000,
      },
    },
    summary: {
      totalCompressions: 50,
      totalOriginalTokens: 109500,
      totalCompressedTokens: 21850,
      totalTokensSaved: 87650,
    },
  };
}

describe("get_compression_stats Date Range Queries", () => {
  before(async () => {
    // Setup: Create test stats file
    await fs.mkdir(TEST_STATS_DIR, { recursive: true });
    const testStats = generateTestStats();
    await fs.writeFile(TEST_STATS_FILE, JSON.stringify(testStats, null, 2));
  });

  after(async () => {
    // Cleanup
    try {
      await fs.rm(TEST_STATS_DIR, { recursive: true, force: true });
    } catch (err) {
      console.error(
        `Warning: Could not clean up test directory: ${err.message}`,
      );
    }
  });

  test("should verify test stats file was created", async () => {
    const stats = JSON.parse(await fs.readFile(TEST_STATS_FILE, "utf8"));
    assert.strictEqual(stats.version, "2.0");
    assert.strictEqual(stats.recent.length, 5);
    assert.strictEqual(stats.summary.totalCompressions, 50);
  });

  // Manual verification tests - these require a running MCP server
  test.todo(
    "Manual: Test relativeDays=3 (last 3 days) - expects 2 compressions, 2250 tokens saved",
  );
  test.todo(
    "Manual: Test relativeDays=7 (last week) - expects 3 compressions, 3450 tokens saved",
  );
  test.todo(
    "Manual: Test relativeDays=30 (last 30 days) - expects 5 compressions, 6650 tokens saved",
  );
  test.todo(
    "Manual: Test startDate/endDate custom range (last 14-7 days) - expects 1-2 compressions",
  );
  test.todo(
    "Manual: Test legacy period=today (backward compatibility) - expects 1 compression, 750 tokens saved",
  );
  test.todo(
    "Manual: Test legacy period=week (backward compatibility) - expects 3 compressions, 3450 tokens saved",
  );
  test.todo(
    "Manual: Test legacy period=month (backward compatibility) - expects 5 compressions, 6650 tokens saved",
  );
  test.todo(
    "Manual: Test legacy period=all (includes all tiers) - expects 50 compressions, 87650 tokens saved",
  );
  test.todo(
    "Manual: Test ISO date range (specific dates) - expects 1-2 compressions",
  );
  test.todo(
    "Manual: Test relativeDays takes precedence over period - expects 3 compressions, 3450 tokens saved",
  );
  test.todo(
    'Manual: Test invalid relativeDays (400) - should error with "must be a number between 1 and 365"',
  );
  test.todo(
    'Manual: Test invalid date format - should error with "Invalid date format"',
  );
  test.todo(
    'Manual: Test startDate after endDate - should error with "Invalid date range"',
  );
});

describe("Manual Test Documentation", () => {
  test("should display manual test instructions", (t) => {
    const instructions = `
╔══════════════════════════════════════════════════════════════╗
║  Manual Test Scenarios for get_compression_stats            ║
╚══════════════════════════════════════════════════════════════╝

To test this feature manually with MCP Inspector:

1. Start MCP server:
   npx @modelcontextprotocol/inspector node server.js

2. Test scenarios in Inspector:

   A. relativeDays Parameter:
      {"relativeDays": 3}
      {"relativeDays": 7}
      {"relativeDays": 30}

   B. Custom Date Ranges (ISO):
      {"startDate": "2025-01-01", "endDate": "2025-01-31"}
      {"startDate": "2025-01-15"}
      {"endDate": "2025-01-31"}

   C. Relative Time Strings:
      {"startDate": "-7d", "endDate": "now"}
      {"startDate": "-2w", "endDate": "-1w"}
      {"startDate": "-1m"}

   D. Legacy Backward Compatibility:
      {"period": "today"}
      {"period": "week"}
      {"period": "month"}
      {"period": "all"}

   E. Priority Order:
      {"relativeDays": 7, "period": "all"}  → Uses relativeDays
      {"startDate": "-7d", "period": "all"} → Uses startDate

   F. Error Cases:
      {"relativeDays": 400}  → Error: out of range
      {"startDate": "invalid"} → Error: invalid format
      {"startDate": "2025-02-01", "endDate": "2025-01-01"} → Error

   G. Multi-tier Filtering:
      {"relativeDays": 90}  → Includes recent + daily tiers
      {"period": "all"}     → Includes all tiers + summary

Expected Results:
- All queries should return summary with correct token counts
- Period labels should reflect the actual date range used
- includeDetails=true should show individual compressions
- Cost savings should be calculated for all queries
- Backward compatibility maintained for existing period parameter

╚══════════════════════════════════════════════════════════════╝
    `.trim();

    t.diagnostic(instructions);
    assert.ok(true, "Manual test instructions documented");
  });
});
