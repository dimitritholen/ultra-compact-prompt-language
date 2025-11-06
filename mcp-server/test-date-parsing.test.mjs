/**
 * Unit Tests for parseFlexibleDate() Function
 *
 * Tests the date parsing logic independently of the MCP server.
 * Migrated to node:test format.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Parse flexible date input to Date object
 * Supports:
 * - ISO dates: "2025-01-01", "2025-01-01T12:00:00Z"
 * - Relative: "-7d", "-2w", "-1m", "-1y"
 * - Special: "now", "today"
 */
function parseFlexibleDate(value) {
  if (!value || value === 'now') {
    return new Date();
  }

  if (value === 'today') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  const relativeMatch = value.match(/^-(\d+)(d|w|m|y)$/);
  if (relativeMatch) {
    const [, amount, unit] = relativeMatch;
    const multipliers = { d: 1, w: 7, m: 30, y: 365 };
    const days = parseInt(amount, 10) * multipliers[unit];
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date;
  }

  throw new Error(`Invalid date format: ${value}. Expected ISO date (YYYY-MM-DD), relative time (-7d, -2w), or special keyword (now, today)`);
}

describe('parseFlexibleDate() Function', () => {
  describe('Special Keywords', () => {
    test('"now" returns current time', () => {
      const result = parseFlexibleDate('now');
      const diff = Math.abs(result.getTime() - Date.now());
      assert.ok(diff < 1000, 'Result should be within 1 second of current time');
    });

    test('"today" returns midnight today', () => {
      const result = parseFlexibleDate('today');
      assert.strictEqual(result.getHours(), 0);
      assert.strictEqual(result.getMinutes(), 0);
      assert.strictEqual(result.getSeconds(), 0);
      assert.strictEqual(result.getMilliseconds(), 0);
    });

    test('null/undefined returns current time', () => {
      const result = parseFlexibleDate(null);
      const diff = Math.abs(result.getTime() - Date.now());
      assert.ok(diff < 1000, 'Result should be within 1 second of current time');
    });
  });

  describe('Relative Date Parsing', () => {
    test('"-7d" returns 7 days ago', () => {
      const result = parseFlexibleDate('-7d');
      const expected = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const diff = Math.abs(result.getTime() - expected.getTime());
      assert.ok(diff < 1000, 'Result should be within 1 second of 7 days ago');
    });

    test('"-2w" returns 14 days ago', () => {
      const result = parseFlexibleDate('-2w');
      const expected = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const diff = Math.abs(result.getTime() - expected.getTime());
      assert.ok(diff < 1000, 'Result should be within 1 second of 14 days ago');
    });

    test('"-1m" returns ~30 days ago', () => {
      const result = parseFlexibleDate('-1m');
      const expected = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const diff = Math.abs(result.getTime() - expected.getTime());
      assert.ok(diff < 1000, 'Result should be within 1 second of 30 days ago');
    });

    test('"-1y" returns ~365 days ago', () => {
      const result = parseFlexibleDate('-1y');
      const expected = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const diff = Math.abs(result.getTime() - expected.getTime());
      assert.ok(diff < 1000, 'Result should be within 1 second of 365 days ago');
    });
  });

  describe('ISO Date Parsing', () => {
    test('ISO date "2025-01-01"', () => {
      const result = parseFlexibleDate('2025-01-01');
      assert.strictEqual(result.getFullYear(), 2025);
      assert.strictEqual(result.getMonth(), 0); // January
      assert.strictEqual(result.getDate(), 1);
    });

    test('Full ISO timestamp', () => {
      const result = parseFlexibleDate('2025-01-15T12:30:00.000Z');
      assert.strictEqual(result.getFullYear(), 2025);
      assert.strictEqual(result.getMonth(), 0);
      assert.strictEqual(result.getDate(), 15);
      assert.strictEqual(result.getUTCHours(), 12);
      assert.strictEqual(result.getUTCMinutes(), 30);
    });
  });

  describe('Error Handling', () => {
    test('Invalid format throws error', () => {
      assert.throws(
        () => parseFlexibleDate('invalid-date'),
        { message: /Invalid date format/ }
      );
    });

    test('Invalid relative format throws error', () => {
      assert.throws(
        () => parseFlexibleDate('-7x'),
        { message: /Invalid date format/ }
      );
    });

    test('Relative with missing unit is parsed as ISO date', () => {
      // "-7" is actually valid as year -7 in ISO format
      const result = parseFlexibleDate('-7');
      assert.ok(result instanceof Date);
      assert.ok(!isNaN(result.getTime()));
    });
  });
});
