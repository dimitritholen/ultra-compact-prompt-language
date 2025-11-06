/**
 * Example Test File - node:test Migration Pattern
 *
 * This file demonstrates the recommended patterns for writing tests with node:test.
 * Use this as a reference when migrating existing test files.
 *
 * Key Features Demonstrated:
 * - describe/test structure for organizing tests
 * - beforeEach/afterEach hooks for setup/teardown
 * - before/after hooks for suite-level setup/teardown
 * - Async test handling
 * - Native assert module usage
 * - Test context for diagnostic output
 */

import { describe, test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('Example Test Suite', () => {
  // Suite-level variables
  let testDir;
  let testFile;

  /**
   * before() - Runs once before all tests in this suite
   * Use for expensive setup operations (database connections, file system setup, etc.)
   */
  before(async () => {
    testDir = path.join(os.tmpdir(), `node-test-example-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    console.log(`Setup: Created test directory at ${testDir}`);
  });

  /**
   * after() - Runs once after all tests in this suite
   * Use for cleanup operations (close connections, remove temp files, etc.)
   */
  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    console.log(`Teardown: Removed test directory`);
  });

  /**
   * beforeEach() - Runs before each individual test
   * Use for per-test setup (reset state, create fresh test data, etc.)
   */
  beforeEach(async () => {
    testFile = path.join(testDir, `test-${Date.now()}.txt`);
    await fs.writeFile(testFile, 'initial content', 'utf8');
  });

  /**
   * afterEach() - Runs after each individual test
   * Use for per-test cleanup (remove test-specific files, reset mocks, etc.)
   */
  afterEach(async () => {
    try {
      await fs.unlink(testFile);
    } catch (error) {
      // File might not exist if test deleted it - that's ok
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  });

  describe('File Operations', () => {
    test('should read file content', async () => {
      const content = await fs.readFile(testFile, 'utf8');
      assert.strictEqual(content, 'initial content');
    });

    test('should write file content', async () => {
      const newContent = 'updated content';
      await fs.writeFile(testFile, newContent, 'utf8');
      const content = await fs.readFile(testFile, 'utf8');
      assert.strictEqual(content, newContent);
    });

    test('should delete file', async () => {
      await fs.unlink(testFile);
      await assert.rejects(
        async () => await fs.readFile(testFile, 'utf8'),
        { code: 'ENOENT' }
      );
    });
  });

  describe('Assertions Examples', () => {
    test('should use strict equality', () => {
      assert.strictEqual(1 + 1, 2);
      assert.strictEqual('hello', 'hello');
    });

    test('should use deep strict equality for objects', () => {
      const obj1 = { name: 'test', value: 42 };
      const obj2 = { name: 'test', value: 42 };
      assert.deepStrictEqual(obj1, obj2);
    });

    test('should check truthiness', () => {
      assert.ok(true);
      assert.ok(1);
      assert.ok('non-empty string');
    });

    test('should check for exceptions', () => {
      assert.throws(() => {
        throw new Error('Expected error');
      }, Error);
    });

    test('should check for async rejections', async () => {
      await assert.rejects(
        async () => {
          throw new Error('Async error');
        },
        { message: 'Async error' }
      );
    });

    test('should use not equal assertions', () => {
      assert.notStrictEqual(1, 2);
      assert.notDeepStrictEqual({ a: 1 }, { a: 2 });
    });
  });

  describe('Async Patterns', () => {
    test('should handle promises', async () => {
      const result = await Promise.resolve('success');
      assert.strictEqual(result, 'success');
    });

    test('should handle async/await', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.ok(true, 'Async operation completed');
    });

    test('should handle multiple async operations', async () => {
      const [result1, result2] = await Promise.all([
        Promise.resolve('first'),
        Promise.resolve('second')
      ]);
      assert.strictEqual(result1, 'first');
      assert.strictEqual(result2, 'second');
    });
  });

  describe('Test Context Usage', () => {
    test('should use test context for diagnostics', (t) => {
      t.diagnostic('This is a diagnostic message for debugging');
      assert.ok(true);
    });

    test('should access test name from context', (t) => {
      assert.ok(t.name.includes('should access test name'));
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle null and undefined', () => {
      assert.strictEqual(null, null);
      assert.strictEqual(undefined, undefined);
      assert.notStrictEqual(null, undefined);
    });

    test('should handle empty collections', () => {
      assert.deepStrictEqual([], []);
      assert.deepStrictEqual({}, {});
    });

    test('should validate error messages', () => {
      assert.throws(
        () => {
          throw new Error('Specific error message');
        },
        { message: 'Specific error message' }
      );
    });

    test('should validate error types', () => {
      class CustomError extends Error {
        constructor(message) {
          super(message);
          this.name = 'CustomError';
        }
      }

      assert.throws(
        () => {
          throw new CustomError('Custom error');
        },
        CustomError
      );
    });
  });
});

/**
 * Top-level test (not in describe block)
 * These are valid but less organized - prefer describe blocks for grouping
 */
test('standalone test example', () => {
  assert.strictEqual(typeof test, 'function');
  assert.strictEqual(typeof describe, 'function');
});

/**
 * Nested describe blocks for hierarchical organization
 */
describe('Parent Suite', () => {
  describe('Child Suite 1', () => {
    test('should run in child suite 1', () => {
      assert.ok(true);
    });
  });

  describe('Child Suite 2', () => {
    test('should run in child suite 2', () => {
      assert.ok(true);
    });
  });
});
