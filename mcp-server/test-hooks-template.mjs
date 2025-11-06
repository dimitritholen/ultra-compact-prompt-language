/**
 * Test Lifecycle Hooks Template
 *
 * This template provides reusable patterns for test setup and teardown
 * using node:test hooks. Copy and adapt these patterns for your tests.
 *
 * Hook Execution Order:
 * 1. before() - once before all tests in suite
 * 2. beforeEach() - before each test
 * 3. test() - the actual test
 * 4. afterEach() - after each test (runs even if test fails)
 * 5. after() - once after all tests in suite (runs even if tests fail)
 */

import { describe, test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// TEMPLATE 1: File System Setup/Teardown
// ============================================================================

/**
 * Use this pattern when tests need temporary files or directories.
 * The before/after hooks create and clean up a temporary directory.
 * The beforeEach/afterEach hooks can create/clean per-test resources.
 */
describe('File System Test Template', () => {
  let testDir;

  before(async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const os = await import('node:os');

    testDir = path.join(os.tmpdir(), `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  after(async () => {
    const fs = await import('node:fs/promises');
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('example test', () => {
    assert.ok(testDir);
  });
});

// ============================================================================
// TEMPLATE 2: State Reset Between Tests
// ============================================================================

/**
 * Use this pattern when tests modify shared state that needs reset.
 * The beforeEach hook ensures each test starts with clean state.
 */
describe('State Reset Test Template', () => {
  let testState;

  beforeEach(() => {
    // Reset state before each test
    testState = {
      counter: 0,
      data: [],
      config: { enabled: true }
    };
  });

  afterEach(() => {
    // Optional: verify state was used correctly
    assert.ok(testState !== null, 'State should be initialized');
  });

  test('test 1 modifies state', () => {
    testState.counter = 5;
    assert.strictEqual(testState.counter, 5);
  });

  test('test 2 has fresh state', () => {
    // Counter should be 0, not 5 from previous test
    assert.strictEqual(testState.counter, 0);
  });
});

// ============================================================================
// TEMPLATE 3: Resource Cleanup (Database, Network, etc.)
// ============================================================================

/**
 * Use this pattern for resources that need explicit cleanup.
 * The after hook ensures cleanup happens even if tests fail.
 */
describe('Resource Cleanup Test Template', () => {
  let resource;

  before(async () => {
    // Initialize expensive resource once
    resource = {
      connect: async () => ({ connected: true }),
      disconnect: async () => ({ connected: false })
    };
    await resource.connect();
  });

  after(async () => {
    // Cleanup runs even if tests fail
    if (resource) {
      await resource.disconnect();
    }
  });

  test('example test using resource', () => {
    assert.ok(resource);
  });
});

// ============================================================================
// TEMPLATE 4: Environment Variable Management
// ============================================================================

/**
 * Use this pattern when tests need to modify environment variables.
 * The beforeEach/afterEach pattern ensures env vars are restored.
 */
describe('Environment Variable Test Template', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  test('test with custom env vars', () => {
    process.env.TEST_VAR = 'test-value';
    assert.strictEqual(process.env.TEST_VAR, 'test-value');
  });

  test('env vars are restored', () => {
    // TEST_VAR should not exist from previous test
    assert.strictEqual(process.env.TEST_VAR, undefined);
  });
});

// ============================================================================
// TEMPLATE 5: Mock/Stub Management
// ============================================================================

/**
 * Use this pattern when using node:test's built-in mocking.
 * The test context provides automatic cleanup of mocks.
 */
describe('Mock Management Test Template', () => {
  test('mocking with automatic cleanup', (t) => {
    // Create mock function
    const mockFn = t.mock.fn(() => 'mocked value');

    // Use mock
    const result = mockFn();
    assert.strictEqual(result, 'mocked value');
    assert.strictEqual(mockFn.mock.callCount(), 1);

    // Mock is automatically cleaned up after test
  });

  test('mocking methods', (t) => {
    const obj = {
      method: () => 'original'
    };

    // Mock the method
    t.mock.method(obj, 'method', () => 'mocked');

    assert.strictEqual(obj.method(), 'mocked');
    // Original method is restored automatically after test
  });
});

// ============================================================================
// TEMPLATE 6: Async Setup with Error Handling
// ============================================================================

/**
 * Use this pattern when setup can fail and needs error handling.
 * Shows how to handle setup failures gracefully.
 */
describe('Async Setup with Error Handling Template', () => {
  let setupSucceeded = false;

  before(async () => {
    try {
      // Simulate async setup (e.g., database connection)
      await new Promise(resolve => setTimeout(resolve, 10));
      setupSucceeded = true;
    } catch (error) {
      console.error('Setup failed:', error);
      throw error; // Fail fast if setup fails
    }
  });

  beforeEach(function () {
    if (!setupSucceeded) {
      this.skip('Skipping test due to setup failure');
    }
  });

  test('runs only if setup succeeded', () => {
    assert.ok(setupSucceeded);
  });
});

// ============================================================================
// TEMPLATE 7: Per-Test Timeout Configuration
// ============================================================================

/**
 * Use this pattern for tests that need custom timeout values.
 * Some tests might need more time than the default.
 */
describe('Custom Timeout Test Template', () => {
  test('fast test with default timeout', () => {
    assert.ok(true);
  });

  test('slow test with custom timeout', { timeout: 5000 }, async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(true);
  });
});

// ============================================================================
// TEMPLATE 8: Nested Describe Blocks with Shared Setup
// ============================================================================

/**
 * Use this pattern for hierarchical test organization.
 * Child suites inherit parent hooks and can add their own.
 */
describe('Parent Suite Template', () => {
  let parentResource;

  before(() => {
    parentResource = 'shared resource';
  });

  describe('Child Suite 1', () => {
    let childResource1;

    beforeEach(() => {
      childResource1 = 'child 1 resource';
    });

    test('has access to both resources', () => {
      assert.ok(parentResource);
      assert.ok(childResource1);
    });
  });

  describe('Child Suite 2', () => {
    let childResource2;

    beforeEach(() => {
      childResource2 = 'child 2 resource';
    });

    test('has access to parent but not sibling resources', () => {
      assert.ok(parentResource);
      assert.ok(childResource2);
      // childResource1 is not available here
    });
  });
});

// ============================================================================
// TEMPLATE 9: Conditional Test Execution
// ============================================================================

/**
 * Use this pattern to skip tests based on conditions.
 * Useful for platform-specific or environment-specific tests.
 */
describe('Conditional Test Execution Template', () => {
  const isLinux = process.platform === 'linux';
  const isCI = process.env.CI === 'true';

  test('runs on all platforms', () => {
    assert.ok(true);
  });

  test('linux-only test', { skip: !isLinux }, () => {
    assert.strictEqual(process.platform, 'linux');
  });

  test('skip in CI', { skip: isCI }, () => {
    // This test runs locally but not in CI
    assert.ok(!process.env.CI);
  });
});

// ============================================================================
// TEMPLATE 10: Test Fixture Factory Pattern
// ============================================================================

/**
 * Use this pattern to create reusable test fixtures.
 * The factory function creates fresh instances for each test.
 */
describe('Test Fixture Factory Template', () => {
  /**
   * Factory function to create test fixtures
   * @returns {Object} Fresh test data
   */
  function createTestFixture() {
    return {
      user: { id: 1, name: 'Test User' },
      posts: [
        { id: 1, title: 'Post 1' },
        { id: 2, title: 'Post 2' }
      ],
      metadata: { created: new Date(), version: 1 }
    };
  }

  test('uses fixture instance 1', () => {
    const fixture = createTestFixture();
    fixture.user.name = 'Modified';
    assert.strictEqual(fixture.user.name, 'Modified');
  });

  test('uses fresh fixture instance 2', () => {
    const fixture = createTestFixture();
    // Name should be original, not 'Modified'
    assert.strictEqual(fixture.user.name, 'Test User');
  });
});

// ============================================================================
// COMMON PATTERNS SUMMARY
// ============================================================================

/**
 * Quick Reference:
 *
 * 1. Use before/after for expensive setup/cleanup (once per suite)
 * 2. Use beforeEach/afterEach for per-test setup/cleanup
 * 3. Always clean up resources in after/afterEach (they run even on failure)
 * 4. Use factory functions for creating fresh test data
 * 5. Store original state before modification, restore in afterEach
 * 6. Use test context (t) for mocks - they auto-cleanup
 * 7. Use { skip: condition } for conditional test execution
 * 8. Use { timeout: ms } for tests needing more time
 * 9. Prefer nested describe blocks for hierarchical organization
 * 10. Use async/await consistently for async operations
 */
