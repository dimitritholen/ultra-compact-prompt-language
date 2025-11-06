#!/usr/bin/env node

/**
 * Unit Tests for parseFlexibleDate() Function
 *
 * Tests the date parsing logic independently of the MCP server.
 */

const assert = require('assert');

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

// Test runner
function runTests() {
  console.log('🧪 Testing parseFlexibleDate() Function\n');

  let passed = 0;
  let failed = 0;

  const tests = [
    {
      name: 'Test 1: "now" returns current time',
      input: 'now',
      validate: (result) => {
        const diff = Math.abs(result.getTime() - Date.now());
        return diff < 1000; // Within 1 second
      }
    },
    {
      name: 'Test 2: "today" returns midnight today',
      input: 'today',
      validate: (result) => {
        return result.getHours() === 0 &&
               result.getMinutes() === 0 &&
               result.getSeconds() === 0 &&
               result.getMilliseconds() === 0;
      }
    },
    {
      name: 'Test 3: "-7d" returns 7 days ago',
      input: '-7d',
      validate: (result) => {
        const expected = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const diff = Math.abs(result.getTime() - expected.getTime());
        return diff < 1000; // Within 1 second
      }
    },
    {
      name: 'Test 4: "-2w" returns 14 days ago',
      input: '-2w',
      validate: (result) => {
        const expected = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const diff = Math.abs(result.getTime() - expected.getTime());
        return diff < 1000;
      }
    },
    {
      name: 'Test 5: "-1m" returns ~30 days ago',
      input: '-1m',
      validate: (result) => {
        const expected = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const diff = Math.abs(result.getTime() - expected.getTime());
        return diff < 1000;
      }
    },
    {
      name: 'Test 6: "-1y" returns ~365 days ago',
      input: '-1y',
      validate: (result) => {
        const expected = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        const diff = Math.abs(result.getTime() - expected.getTime());
        return diff < 1000;
      }
    },
    {
      name: 'Test 7: ISO date "2025-01-01"',
      input: '2025-01-01',
      validate: (result) => {
        return result.getFullYear() === 2025 &&
               result.getMonth() === 0 && // January
               result.getDate() === 1;
      }
    },
    {
      name: 'Test 8: Full ISO timestamp',
      input: '2025-01-15T12:30:00.000Z',
      validate: (result) => {
        return result.getFullYear() === 2025 &&
               result.getMonth() === 0 &&
               result.getDate() === 15 &&
               result.getUTCHours() === 12 &&
               result.getUTCMinutes() === 30;
      }
    },
    {
      name: 'Test 9: null/undefined returns current time',
      input: null,
      validate: (result) => {
        const diff = Math.abs(result.getTime() - Date.now());
        return diff < 1000;
      }
    },
    {
      name: 'Test 10: Invalid format throws error',
      input: 'invalid-date',
      shouldThrow: true,
      errorMatch: /Invalid date format/
    },
    {
      name: 'Test 11: Invalid relative format throws error',
      input: '-7x',
      shouldThrow: true,
      errorMatch: /Invalid date format/
    },
    {
      name: 'Test 12: Relative with missing unit throws error',
      input: '-7',
      shouldThrow: true,
      errorMatch: /Invalid date format/
    }
  ];

  for (const test of tests) {
    try {
      const result = parseFlexibleDate(test.input);

      if (test.shouldThrow) {
        console.log(`❌ ${test.name}`);
        console.log(`   Expected error but got: ${result}`);
        failed++;
      } else if (test.validate(result)) {
        console.log(`✅ ${test.name}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   Validation failed for result: ${result}`);
        failed++;
      }
    } catch (error) {
      if (test.shouldThrow) {
        if (test.errorMatch && test.errorMatch.test(error.message)) {
          console.log(`✅ ${test.name}`);
          console.log(`   Correctly threw: ${error.message.substring(0, 50)}...`);
          passed++;
        } else {
          console.log(`❌ ${test.name}`);
          console.log(`   Wrong error: ${error.message}`);
          failed++;
        }
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   Unexpected error: ${error.message}`);
        failed++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n🎯 Test Results: ${passed} passed, ${failed} failed\n`);

  if (failed === 0) {
    console.log('✅ All parseFlexibleDate() tests passed!\n');
    return 0;
  } else {
    console.log('❌ Some tests failed.\n');
    return 1;
  }
}

// Run tests
const exitCode = runTests();
process.exit(exitCode);
