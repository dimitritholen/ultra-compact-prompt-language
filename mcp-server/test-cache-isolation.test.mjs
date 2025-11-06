/**
 * Test suite for cache isolation verification
 *
 * This test file verifies that the cache module properly isolates
 * test state between tests, preventing cache pollution.
 */

import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCachedLLMClient,
  setCachedLLMClient,
  getLLMDetectionCallCount,
  incrementLLMDetectionCallCount,
  resetCache
} from './test-cache.mjs';

describe('Cache Isolation', () => {
  afterEach(() => {
    // Reset cache after each test for isolation
    resetCache();
  });

  test('Test 1: Cache starts empty', () => {
    const cached = getCachedLLMClient();
    const count = getLLMDetectionCallCount();

    assert.strictEqual(cached, null, 'Cache should be null initially');
    assert.strictEqual(count, 0, 'Call count should be 0 initially');
  });

  test('Test 2: Cache can be set and retrieved', () => {
    const client = { client: 'test', model: 'test-model' };
    setCachedLLMClient(client);

    const retrieved = getCachedLLMClient();
    assert.strictEqual(retrieved, client, 'Should retrieve the cached client');
  });

  test('Test 3: Cache is isolated from previous test', () => {
    // This test should NOT see the cache from Test 2
    const cached = getCachedLLMClient();
    assert.strictEqual(cached, null, 'Cache should be reset between tests');
  });

  test('Test 4: Call count increments correctly', () => {
    incrementLLMDetectionCallCount();
    incrementLLMDetectionCallCount();
    incrementLLMDetectionCallCount();

    const count = getLLMDetectionCallCount();
    assert.strictEqual(count, 3, 'Call count should be 3');
  });

  test('Test 5: Call count is isolated from previous test', () => {
    // This test should NOT see the count from Test 4
    const count = getLLMDetectionCallCount();
    assert.strictEqual(count, 0, 'Call count should be reset between tests');
  });

  test('Test 6: Multiple resets are safe (idempotent)', () => {
    const client = { client: 'test', model: 'test-model' };
    setCachedLLMClient(client);
    incrementLLMDetectionCallCount();

    // Reset multiple times
    resetCache();
    resetCache();
    resetCache();

    const cached = getCachedLLMClient();
    const count = getLLMDetectionCallCount();

    assert.strictEqual(cached, null, 'Cache should be null after resets');
    assert.strictEqual(count, 0, 'Call count should be 0 after resets');
  });

  test('Test 7: Cache state before reset', () => {
    // Set some state
    setCachedLLMClient({ client: 'test', model: 'test-model' });
    incrementLLMDetectionCallCount();
    incrementLLMDetectionCallCount();

    // Verify state exists before reset
    assert.ok(getCachedLLMClient() !== null, 'Cache should exist before reset');
    assert.strictEqual(getLLMDetectionCallCount(), 2, 'Call count should be 2 before reset');

    // Reset manually
    resetCache();

    // Verify state cleared after reset
    assert.strictEqual(getCachedLLMClient(), null, 'Cache should be null after reset');
    assert.strictEqual(getLLMDetectionCallCount(), 0, 'Call count should be 0 after reset');
  });
});

describe('Cache Isolation - Random Order Test', () => {
  afterEach(() => {
    resetCache();
  });

  // These tests should pass regardless of execution order
  test('Random test A: Sets cache to value A', () => {
    setCachedLLMClient({ value: 'A' });
    assert.strictEqual(getCachedLLMClient().value, 'A');
  });

  test('Random test B: Sets cache to value B', () => {
    setCachedLLMClient({ value: 'B' });
    assert.strictEqual(getCachedLLMClient().value, 'B');
  });

  test('Random test C: Sets cache to value C', () => {
    setCachedLLMClient({ value: 'C' });
    assert.strictEqual(getCachedLLMClient().value, 'C');
  });

  test('Random test D: Verifies cache starts empty', () => {
    assert.strictEqual(getCachedLLMClient(), null);
  });

  test('Random test E: Increments count to 5', () => {
    for (let i = 0; i < 5; i++) {
      incrementLLMDetectionCallCount();
    }
    assert.strictEqual(getLLMDetectionCallCount(), 5);
  });

  test('Random test F: Verifies count starts at 0', () => {
    assert.strictEqual(getLLMDetectionCallCount(), 0);
  });
});
