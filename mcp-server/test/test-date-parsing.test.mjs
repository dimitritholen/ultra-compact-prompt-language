/**
 * Unit Tests for parseFlexibleDate() Function
 *
 * Tests the date parsing logic independently of the MCP server.
 * Migrated to node:test format.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Import production function from server.js
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, "../server.js");
const { parseFlexibleDate } = require(SERVER_PATH);

describe("parseFlexibleDate() Function", () => {
  describe("Special Keywords", () => {
    test('"now" returns current time', () => {
      const result = parseFlexibleDate("now");
      const diff = Math.abs(result.getTime() - Date.now());
      assert.ok(
        diff < 1000,
        "Result should be within 1 second of current time",
      );
    });

    test('"today" returns midnight today', () => {
      const result = parseFlexibleDate("today");
      assert.strictEqual(result.getHours(), 0);
      assert.strictEqual(result.getMinutes(), 0);
      assert.strictEqual(result.getSeconds(), 0);
      assert.strictEqual(result.getMilliseconds(), 0);
    });

    test("null/undefined returns current time", () => {
      const result = parseFlexibleDate(null);
      const diff = Math.abs(result.getTime() - Date.now());
      assert.ok(
        diff < 1000,
        "Result should be within 1 second of current time",
      );
    });
  });

  describe("Relative Date Parsing", () => {
    test('"-7d" returns 7 days ago', () => {
      const result = parseFlexibleDate("-7d");
      const expected = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const diff = Math.abs(result.getTime() - expected.getTime());
      assert.ok(diff < 1000, "Result should be within 1 second of 7 days ago");
    });

    test('"-2w" returns 14 days ago', () => {
      const result = parseFlexibleDate("-2w");
      const expected = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const diff = Math.abs(result.getTime() - expected.getTime());
      assert.ok(diff < 1000, "Result should be within 1 second of 14 days ago");
    });

    test('"-1m" returns ~30 days ago', () => {
      const result = parseFlexibleDate("-1m");
      const expected = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const diff = Math.abs(result.getTime() - expected.getTime());
      assert.ok(diff < 1000, "Result should be within 1 second of 30 days ago");
    });

    test('"-1y" returns ~365 days ago', () => {
      const result = parseFlexibleDate("-1y");
      const expected = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const diff = Math.abs(result.getTime() - expected.getTime());
      assert.ok(
        diff < 1000,
        "Result should be within 1 second of 365 days ago",
      );
    });
  });

  describe("ISO Date Parsing", () => {
    test('ISO date "2025-01-01"', () => {
      const result = parseFlexibleDate("2025-01-01");
      assert.strictEqual(result.getFullYear(), 2025);
      assert.strictEqual(result.getMonth(), 0); // January
      assert.strictEqual(result.getDate(), 1);
    });

    test("Full ISO timestamp", () => {
      const result = parseFlexibleDate("2025-01-15T12:30:00.000Z");
      assert.strictEqual(result.getFullYear(), 2025);
      assert.strictEqual(result.getMonth(), 0);
      assert.strictEqual(result.getDate(), 15);
      assert.strictEqual(result.getUTCHours(), 12);
      assert.strictEqual(result.getUTCMinutes(), 30);
    });
  });

  describe("Error Handling", () => {
    test("Invalid format throws error", () => {
      assert.throws(() => parseFlexibleDate("invalid-date"), {
        message: /Invalid date format/,
      });
    });

    test("Invalid relative format throws error", () => {
      assert.throws(() => parseFlexibleDate("-7x"), {
        message: /Invalid date format/,
      });
    });

    test("Relative with missing unit is parsed as ISO date", () => {
      // "-7" is actually valid as year -7 in ISO format
      const result = parseFlexibleDate("-7");
      assert.ok(result instanceof Date);
      assert.ok(!isNaN(result.getTime()));
    });
  });

  describe("Edge Cases and Error Conditions", () => {
    test('should treat empty string as "now"', () => {
      const result = parseFlexibleDate("");
      const diff = Math.abs(result.getTime() - Date.now());
      assert.ok(diff < 1000, "Empty string should be treated as current time");
    });

    test("should handle malformed relative dates", () => {
      assert.throws(() => parseFlexibleDate("-abc"), /Invalid date format/);
      assert.throws(() => parseFlexibleDate("-7x"), /Invalid date format/);
      assert.throws(() => parseFlexibleDate("7d"), /Invalid date format/); // Missing minus
    });

    test("should handle very large relative dates", () => {
      // Very large dates are valid - they just go far into the past
      const result = parseFlexibleDate("-10000d");
      assert.ok(result instanceof Date);
      assert.ok(!isNaN(result.getTime()));
      assert.ok(result < new Date(), "Should be in the past");
    });

    test("should handle special characters", () => {
      assert.throws(() => parseFlexibleDate("$pecial"), /Invalid date format/);
      assert.throws(
        () => parseFlexibleDate("2025-13-40"),
        /Invalid date format/,
      );
    });

    test("should reject whitespace-only input", () => {
      assert.throws(() => parseFlexibleDate("   "), {
        message: /Invalid date format/,
      });
    });

    test("should handle negative years in ISO format", () => {
      // Negative years are technically valid in ISO 8601 extended format
      const result = parseFlexibleDate("-000001-01-01");
      assert.ok(result instanceof Date);
      assert.ok(!isNaN(result.getTime()));
    });

    test("should handle invalid month in ISO date", () => {
      assert.throws(
        () => parseFlexibleDate("2025-00-01"),
        /Invalid date format/,
      );
      assert.throws(
        () => parseFlexibleDate("2025-13-01"),
        /Invalid date format/,
      );
    });

    test("should auto-correct invalid days (JavaScript Date behavior)", () => {
      // JavaScript Date constructor auto-corrects overflow days
      // Feb 30 becomes March 2 (Feb has 28/29 days)
      const result = parseFlexibleDate("2025-02-30");
      assert.ok(result instanceof Date);
      assert.strictEqual(result.getMonth(), 2); // March (0-indexed)
      assert.strictEqual(result.getDate(), 2);
    });

    test("should handle leap year edge cases", () => {
      // 2024 is a leap year, Feb 29 should be valid
      const leap = parseFlexibleDate("2024-02-29");
      assert.strictEqual(leap.getMonth(), 1); // February
      assert.strictEqual(leap.getDate(), 29);

      // 2025 is not a leap year, Feb 29 auto-corrects to March 1
      const nonLeap = parseFlexibleDate("2025-02-29");
      assert.strictEqual(nonLeap.getMonth(), 2); // March
      assert.strictEqual(nonLeap.getDate(), 1);
    });

    test("should reject truly invalid formats", () => {
      assert.throws(
        () => parseFlexibleDate("not-a-date"),
        /Invalid date format/,
      );
      assert.throws(
        () => parseFlexibleDate("@@invalid@@"),
        /Invalid date format/,
      );
      assert.throws(
        () => parseFlexibleDate("abc-def-ghij"),
        /Invalid date format/,
      );
    });

    test("should parse alternate date formats (JavaScript Date behavior)", () => {
      // JavaScript Date constructor is lenient with date formats
      const result = parseFlexibleDate("01-01-2025");
      assert.ok(result instanceof Date);
      assert.ok(!isNaN(result.getTime()));
    });

    test("should parse slash-separated dates (JavaScript Date behavior)", () => {
      // JavaScript Date constructor accepts slash-separated dates
      const result = parseFlexibleDate("2025/01/01");
      assert.ok(result instanceof Date);
      assert.ok(!isNaN(result.getTime()));
    });
  });
});
