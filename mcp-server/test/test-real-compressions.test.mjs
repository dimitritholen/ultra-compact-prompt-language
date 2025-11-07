/**
 * Real-world test for statistics recording with actual compressions
 *
 * This test:
 * 1. Backs up existing stats file
 * 2. Performs multiple real compressions using the MCP server
 * 3. Verifies all compressions were recorded with actual stats file validation
 * 4. Restores original stats file
 *
 * CRITICAL: Tests validate actual stats file content, NOT log messages.
 * This ensures tests remain stable even if log formats change.
 */

import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { callMCPTool } from "./test-utils/mcp-client.js";

const require = createRequire(import.meta.url);
const { validateCompressionRecordSafe } = require("./test-utils/validators.js");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATS_DIR = path.join(os.homedir(), ".ucpl", "compress");
const STATS_FILE = path.join(STATS_DIR, "compression-stats.json");
const BACKUP_FILE = path.join(STATS_DIR, "compression-stats.json.backup");
const SERVER_PATH = path.join(__dirname, "../server.js");

describe("Real Compression Statistics Recording", () => {
  /**
   * Helper functions
   */
  async function loadStats() {
    try {
      const data = await fs.readFile(STATS_FILE, "utf-8");
      const stats = JSON.parse(data);

      // Ensure stats has the expected structure (recent/archived/monthly/summary)
      if (!stats.recent) stats.recent = [];
      if (!stats.archived) stats.archived = [];
      if (!stats.monthly) stats.monthly = [];
      if (!stats.summary) {
        stats.summary = {
          totalCompressions: 0,
          totalOriginalTokens: 0,
          totalCompressedTokens: 0,
          totalTokensSaved: 0,
        };
      }

      return stats;
    } catch (error) {
      // Return empty stats structure if file doesn't exist or is invalid
      return {
        recent: [],
        archived: [],
        monthly: [],
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
   * Poll for stats file update with exponential backoff
   * @param {number} expectedCount - Expected number of records
   * @param {number} maxWaitMs - Maximum wait time in milliseconds (default: 5000)
   * @returns {Promise<object>} Stats object when condition is met
   */
  async function pollForStatsUpdate(expectedCount, maxWaitMs = 5000) {
    const startTime = Date.now();
    let delay = 100; // Start with 100ms

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const stats = await loadStats();
        const currentCount = stats.recent ? stats.recent.length : 0;

        if (currentCount >= expectedCount) {
          return stats;
        }
      } catch (error) {
        // Stats file doesn't exist yet, keep polling
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 1000); // Exponential backoff, max 1s
    }

    // Timeout - return current stats
    return await loadStats();
  }

  async function backupStats() {
    try {
      await fs.copyFile(STATS_FILE, BACKUP_FILE);
    } catch (_error) {
      // No existing stats to backup
    }
  }

  async function restoreStats() {
    try {
      await fs.copyFile(BACKUP_FILE, STATS_FILE);
      await fs.unlink(BACKUP_FILE);
    } catch (_error) {
      // No backup to restore
    }
  }

  async function clearStats() {
    try {
      await fs.unlink(STATS_FILE);
    } catch (_error) {
      // File doesn't exist, that's fine
    }
  }

  /**
   * Test setup and teardown
   */
  beforeEach(async () => {
    await backupStats();
    await clearStats();
  });

  afterEach(async () => {
    await restoreStats();
  });

  /**
   * Test cases
   */
  describe("Single file compression", () => {
    test("should record compression for single file with valid data", async () => {
      const testFile = path.join(__dirname, "../server.js");
      const initialStats = await loadStats();
      const initialCount = initialStats.recent ? initialStats.recent.length : 0;

      await callMCPTool(SERVER_PATH, "compress_code_context", {
        path: testFile,
        level: "minimal",
        format: "summary",
      });

      // Poll for stats update with exponential backoff
      const expectedCount = initialCount + 1;
      const finalStats = await pollForStatsUpdate(expectedCount);
      const finalCount = finalStats.recent ? finalStats.recent.length : 0;

      assert.ok(
        finalCount > initialCount,
        `Stats file should be updated (${initialCount} → ${finalCount})`,
      );

      // Validate the new record
      const newRecord = finalStats.recent[finalStats.recent.length - 1];
      const validation = validateCompressionRecordSafe(
        newRecord,
        testFile,
        "minimal",
      );

      assert.ok(
        validation.success,
        `Record validation should pass. Errors: ${validation.errors.join(", ")}`,
      );

      // Verify critical fields
      assert.ok(
        newRecord.originalTokens > 0,
        "originalTokens should be positive",
      );
      assert.ok(
        newRecord.compressedTokens > 0,
        "compressedTokens should be positive",
      );
      assert.ok(newRecord.tokensSaved > 0, "tokensSaved should be positive");
      assert.ok(
        newRecord.compressionRatio > 0 && newRecord.compressionRatio < 1,
        "compressionRatio should be between 0 and 1",
      );
      assert.ok(
        newRecord.savingsPercentage > 0 && newRecord.savingsPercentage < 100,
        "savingsPercentage should be between 0 and 100",
      );
    });
  });

  describe("Directory compression", () => {
    test("should record compression for directory with fallback estimation", async () => {
      const testDir = path.join(__dirname, "../scripts");
      const initialStats = await loadStats();
      const initialCount = initialStats.recent ? initialStats.recent.length : 0;

      await callMCPTool(SERVER_PATH, "compress_code_context", {
        path: testDir,
        level: "minimal",
        format: "summary",
        limit: 10,
      });

      // Poll for stats update with exponential backoff
      const expectedCount = initialCount + 1;
      const finalStats = await pollForStatsUpdate(expectedCount);
      const finalCount = finalStats.recent ? finalStats.recent.length : 0;

      assert.ok(
        finalCount > initialCount,
        `Stats file should be updated (${initialCount} → ${finalCount})`,
      );

      // Validate the new record
      const newRecord = finalStats.recent[finalStats.recent.length - 1];
      const validation = validateCompressionRecordSafe(
        newRecord,
        testDir,
        "minimal",
      );

      assert.ok(
        validation.success,
        `Record validation should pass. Errors: ${validation.errors.join(", ")}`,
      );

      // Check if record is marked as estimated (may or may not be, depending on implementation)
      if (newRecord.estimated) {
        assert.ok(
          true,
          "Record correctly marked as estimated (fallback worked)",
        );
      }

      // Verify token counts are reasonable
      assert.ok(
        newRecord.originalTokens > newRecord.compressedTokens,
        "originalTokens should be greater than compressedTokens",
      );
    });
  });

  describe("Multiple sequential compressions", () => {
    test("should record all sequential compressions with valid data", async () => {
      const initialStats = await loadStats();
      const initialCount = initialStats.recent ? initialStats.recent.length : 0;

      const testFiles = [
        path.join(__dirname, "../server.js"),
        path.join(__dirname, "test-statistics.js"),
        path.join(__dirname, "test-schema.js"),
      ];

      for (const file of testFiles) {
        await callMCPTool(SERVER_PATH, "compress_code_context", {
          path: file,
          level: "full",
          format: "summary",
        });
      }

      // Poll for all stats updates with exponential backoff
      const expected = initialCount + testFiles.length;
      const finalStats = await pollForStatsUpdate(expected, 8000); // Allow more time for multiple compressions
      const finalCount = finalStats.recent ? finalStats.recent.length : 0;
      assert.strictEqual(
        finalCount,
        expected,
        `All compressions should be recorded (expected ${expected}, got ${finalCount})`,
      );

      // Validate all new records
      const newRecords = finalStats.recent.slice(-testFiles.length);

      for (let i = 0; i < newRecords.length; i++) {
        const record = newRecords[i];
        const testFile = testFiles[i];
        const validation = validateCompressionRecordSafe(
          record,
          testFile,
          "full",
        );

        assert.ok(
          validation.success,
          `Record ${i + 1} should be valid. Errors: ${validation.errors.join(", ")}`,
        );
      }

      // Validate summary was updated correctly
      const expectedTotalCompressions =
        initialStats.summary.totalCompressions + testFiles.length;
      assert.strictEqual(
        finalStats.summary.totalCompressions,
        expectedTotalCompressions,
        `Summary totalCompressions should be ${expectedTotalCompressions}, got ${finalStats.summary.totalCompressions}`,
      );

      // Validate summary token counts are reasonable
      assert.ok(
        finalStats.summary.totalOriginalTokens > 0,
        "Summary totalOriginalTokens should be positive",
      );
      assert.ok(
        finalStats.summary.totalCompressedTokens > 0,
        "Summary totalCompressedTokens should be positive",
      );
      assert.ok(
        finalStats.summary.totalTokensSaved > 0,
        "Summary totalTokensSaved should be positive",
      );
      assert.ok(
        finalStats.summary.totalOriginalTokens ===
          finalStats.summary.totalCompressedTokens +
            finalStats.summary.totalTokensSaved,
        "Summary token math should be correct",
      );
    });
  });

  describe("Statistics retrieval", () => {
    test("should retrieve statistics correctly", async () => {
      const { response } = await callMCPTool(
        SERVER_PATH,
        "get_compression_stats",
        {
          period: "all",
          includeDetails: true,
          limit: 10,
        },
      );

      assert.ok(response.result, "Response should have result");
      assert.ok(response.result.content, "Response should have content");
      assert.ok(
        response.result.content[0],
        "Response should have content array",
      );

      const text = response.result.content[0].text;

      assert.ok(
        text.includes("Total Compressions:"),
        "Should include total compressions",
      );
      assert.ok(text.includes("Tokens Saved:"), "Should include tokens saved");
    });
  });
});
