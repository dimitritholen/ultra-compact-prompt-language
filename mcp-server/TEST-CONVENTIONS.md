# Test Conventions and Guidelines

This document outlines testing patterns, best practices, and conventions for the mcp-server project.

## Table of Contents

- [File Organization](#file-organization)
- [Test Structure](#test-structure)
- [Best Practices](#best-practices)
- [Shared Utilities](#shared-utilities)
- [Running Tests](#running-tests)
- [CI/CD Considerations](#cicd-considerations)

## File Organization

### File Naming

All test files must use the `.test.mjs` extension:

```
src/
  feature.js
  feature.test.mjs  ← Test file co-located with source
```

**Rationale**: Consistent `.test.mjs` extension enables:
- Node.js test runner auto-discovery
- Clear identification of test files
- Proper ESM module handling

### Directory Structure

```
mcp-server/
├── test-utils/              # Shared test utilities
│   ├── helpers.js           # Common test helpers
│   ├── mcp-client.js        # MCP protocol client
│   ├── fixtures.js          # Test data generators
│   ├── validators.js        # Validation functions
│   └── README.md            # Utility documentation
├── *.test.mjs               # Test files (co-located with source)
├── test-date-helpers.js     # Date generation utilities
├── test-utils.js            # Floating-point assertion utilities
└── test-validation-helpers.js  # Additional validation helpers
```

**Helper Modules** (don't have `.test.mjs` extension):
- `test-utils.js` - Floating-point comparison utilities
- `test-date-helpers.js` - Dynamic date generation for tests
- `test-validation-helpers.js` - Validation helper functions

## Test Structure

### Framework

Use **Node.js built-in test runner** (`node:test` module):

```javascript
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

describe('Feature Name', () => {
  beforeEach(async () => {
    // Setup before each test
  });

  afterEach(async () => {
    // Cleanup after each test
  });

  test('should do something specific', async () => {
    // Arrange
    const input = 'test data';

    // Act
    const result = await someFunction(input);

    // Assert
    assert.strictEqual(result, 'expected output');
  });
});
```

### Import Syntax

Use **ESM imports** (not CommonJS `require()`):

```javascript
// ✅ Correct (ESM)
import { promises as fs } from 'fs';
import path from 'path';
import assert from 'node:assert';
import { test } from 'node:test';

// ❌ Incorrect (CommonJS)
const fs = require('fs').promises;
const path = require('path');
```

### Test Organization

**Group related tests with `describe()` blocks:**

```javascript
describe('Compression Statistics', () => {
  describe('Cost Tracking', () => {
    test('should calculate cost savings correctly', () => {
      // Test implementation
    });

    test('should handle missing cost data gracefully', () => {
      // Test implementation
    });
  });

  describe('Record Validation', () => {
    test('should validate required fields', () => {
      // Test implementation
    });
  });
});
```

### Lifecycle Hooks

```javascript
describe('Feature Tests', () => {
  let testData;

  beforeEach(async () => {
    // Runs before each test
    testData = await setupTestData();
  });

  afterEach(async () => {
    // Runs after each test (even on failure)
    await cleanupTestData(testData);
  });

  test('should use test data', () => {
    assert.ok(testData);
  });
});
```

## Best Practices

### 1. Avoid Mocks Unless Necessary

**Prefer real operations** over mocks:

```javascript
// ✅ Preferred: Use real file operations
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

test('should write and read stats file', async () => {
  const testFile = path.join(os.tmpdir(), 'test-stats.json');

  await fs.writeFile(testFile, JSON.stringify({ test: true }));
  const data = JSON.parse(await fs.readFile(testFile, 'utf-8'));

  assert.strictEqual(data.test, true);

  // Cleanup
  await fs.unlink(testFile);
});

// ❌ Avoid: Mocking file system
// Only mock when testing external slow APIs or databases
```

### 2. Use CI-Aware Timeouts

Tests on CI may be slower. Use environment-aware timeouts:

```javascript
const MAX_WAIT_MS = process.env.CI ? 300000 : 60000; // 5min on CI, 1min local

test('should complete within timeout', async () => {
  await pollForCondition(
    async () => await checkCondition(),
    { maxWaitMs: MAX_WAIT_MS }
  );
});
```

### 3. Cross-Platform Paths

Always use `path.normalize()` or `path.join()` for paths:

```javascript
// ✅ Correct: Cross-platform paths
const recordPath = path.normalize(record.path);
const expectedPath = path.normalize(expected);
assert.ok(recordPath.includes(expectedPath));

// ❌ Incorrect: Hard-coded separators
assert.ok(record.path.includes('src/file.js')); // Fails on Windows
```

### 4. Strong Assertions

Use **specific assertions** rather than generic ones:

```javascript
// ✅ Preferred: Specific assertions
assert.strictEqual(result.status, 'success');
assert.strictEqual(result.count, 5);
assert.ok(Array.isArray(result.items));
assert.strictEqual(result.items.length, 3);

// ❌ Avoid: Generic assertions
assert.ok(result); // Too vague
assert.ok(result.count); // Doesn't check exact value
```

### 5. Descriptive Test Names

Write test names that describe **behavior**, not implementation:

```javascript
// ✅ Preferred: Behavior-focused
test('should save compression stats with cost data', () => {});
test('should handle missing stats file gracefully', () => {});
test('should validate timestamp is within last 60 seconds', () => {});

// ❌ Avoid: Implementation-focused
test('calls recordCompression function', () => {});
test('test stats file', () => {});
```

### 6. Cleanup Resources

Always clean up resources, even when tests fail:

```javascript
// ✅ Preferred: Cleanup in afterEach
import { cleanupFiles } from './test-utils/helpers.js';

afterEach(async () => {
  await cleanupFiles(
    '/tmp/test-stats.json',
    '/tmp/test-stats.json.backup'
  );
});

// ❌ Avoid: Manual cleanup (may be skipped on failure)
test('should do something', async () => {
  await fs.writeFile('/tmp/test.json', '{}');
  // Test logic...
  await fs.unlink('/tmp/test.json'); // May not run if test fails
});
```

### 7. Test Real Inputs and Outputs

Avoid synthetic/fake data when possible:

```javascript
// ✅ Preferred: Test with real data
test('should compress actual file', async () => {
  const result = await compress('./test-utils/fixtures.js', 'full');
  assert.ok(result.originalTokens > 0);
  assert.ok(result.compressedTokens > 0);
});

// ❌ Avoid: Synthetic data that doesn't reflect reality
test('should compress fake data', () => {
  const result = compress({ fakeField: 'fake' }, 'full');
  assert.ok(result); // Doesn't test real behavior
});
```

## Shared Utilities

The `test-utils/` directory provides reusable testing utilities:

### helpers.js

```javascript
import { fileExists, pollForCondition, cleanupFiles } from './test-utils/helpers.js';

// Check file existence
if (await fileExists('/path/to/file')) {
  // File exists
}

// Wait for condition with exponential backoff
const stats = await pollForCondition(
  async () => {
    const data = await fs.readFile(statsFile, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.recent.length >= 3 ? parsed : null;
  },
  { maxWaitMs: 5000 }
);

// Clean up multiple files
await cleanupFiles(file1, file2, file3);
```

### mcp-client.js

```javascript
import { callMCPTool } from './test-utils/mcp-client.js';

// Call MCP tool
const { response, stderr } = await callMCPTool(
  '/path/to/server.js',
  'compress_code_context',
  { path: './src/index.js', level: 'full' }
);
```

### fixtures.js

```javascript
import { generateStatsWithCost } from './test-utils/fixtures.js';

// Generate test statistics
const testStats = generateStatsWithCost();
await fs.writeFile(statsFile, JSON.stringify(testStats, null, 2));
```

### validators.js

```javascript
import {
  validateCompressionRecord,
  validateCompressionRecordSafe,
  validateTokenCounts,
  validateTimestamp
} from './test-utils/validators.js';

// Validate compression record (throws on error)
validateCompressionRecord(
  stats.recent[0],
  './src/index.js',
  'full',
  { maxAgeSeconds: 60 }
);

// Non-throwing validation (returns errors)
const { success, errors } = validateCompressionRecordSafe(
  record,
  expectedPath,
  'full'
);
```

### test-utils.js

```javascript
import { assertAlmostEqual, DEFAULT_EPSILON } from './test-utils.js';

// Assert floating-point equality with tolerance
assertAlmostEqual(0.1 + 0.2, 0.3); // Handles floating-point imprecision
assertAlmostEqual(totalCost, 0.0166, 0.0001); // Custom epsilon
```

### test-date-helpers.js

```javascript
import {
  today,
  daysAgo,
  weeksAgo,
  startOfCurrentYear
} from './test-date-helpers.js';

// Generate relative dates (avoids hardcoded years)
const lastWeek = daysAgo(7);
const yesterday = daysAgo(1);
const startOfYear = startOfCurrentYear();
```

## Running Tests

### Run All Tests

```bash
npm test
```

This runs: `node --test --test-reporter=spec`

Node.js automatically discovers all `.test.mjs` files and files containing `describe()` or `test()` calls.

### Run Specific Test File

```bash
npm test -- test-statistics.test.mjs
```

### Watch Mode

```bash
npm run test:watch
```

Re-runs tests automatically when files change.

### Coverage Report

```bash
npm run test:coverage
```

Generates code coverage report using Node.js built-in coverage.

## CI/CD Considerations

### Environment Detection

Tests automatically detect CI environment:

```javascript
const isCI = process.env.CI === 'true';
const timeout = isCI ? 300000 : 60000; // 5min on CI, 1min local
```

### Longer Timeouts on CI

CI environments may be slower. Use increased timeouts:

```javascript
// CI-aware timeout
const defaultMaxAge = process.env.CI ? 300 : 60; // seconds

validateTimestamp(record, defaultMaxAge);
```

### Avoid Flaky Tests

- Use `pollForCondition()` instead of fixed `setTimeout()`
- Always clean up resources in `afterEach()`
- Use relative dates instead of hardcoded dates
- Normalize paths with `path.normalize()`

## Examples from Real Tests

### Example: Integration Test with Real Files

```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { callMCPTool } from './test-utils/mcp-client.js';
import { validateCompressionRecord } from './test-utils/validators.js';

describe('Real Compression Tests', () => {
  test('should compress actual source file and record stats', async () => {
    const serverPath = new URL('./server.js', import.meta.url).pathname;

    // Perform real compression
    const { response } = await callMCPTool(
      serverPath,
      'compress_code_context',
      { path: './test-utils/fixtures.js', level: 'full', format: 'text' }
    );

    // Validate response structure
    assert.ok(response.result);
    assert.ok(response.result.content);

    // Read recorded stats
    const statsData = await fs.readFile(STATS_FILE, 'utf-8');
    const stats = JSON.parse(statsData);

    // Validate stats record
    validateCompressionRecord(
      stats.recent[0],
      './test-utils/fixtures.js',
      'full'
    );
  });
});
```

### Example: Testing with Cleanup

```javascript
import { test, beforeEach, afterEach } from 'node:test';
import { cleanupFiles } from './test-utils/helpers.js';

const TEMP_FILES = [
  '/tmp/test-stats.json',
  '/tmp/test-stats.json.backup'
];

beforeEach(async () => {
  // Setup test state
  await fs.writeFile(TEMP_FILES[0], JSON.stringify({}));
});

afterEach(async () => {
  // Cleanup (runs even if test fails)
  await cleanupFiles(...TEMP_FILES);
});

test('should perform operations safely', async () => {
  // Test logic using TEMP_FILES
});
```

### Example: CI-Aware Polling

```javascript
import { pollForCondition } from './test-utils/helpers.js';

test('should wait for stats to update', async () => {
  const CI_TIMEOUT = 300000; // 5 minutes on CI
  const LOCAL_TIMEOUT = 60000; // 1 minute locally
  const maxWait = process.env.CI ? CI_TIMEOUT : LOCAL_TIMEOUT;

  const stats = await pollForCondition(
    async () => {
      if (!await fileExists(STATS_FILE)) return null;
      const data = JSON.parse(await fs.readFile(STATS_FILE, 'utf-8'));
      return data.recent.length >= 2 ? data : null;
    },
    { maxWaitMs: maxWait }
  );

  assert.ok(stats);
  assert.strictEqual(stats.recent.length, 2);
});
```

## Summary

1. **Use `.test.mjs` extension** for all test files
2. **Use ESM imports** (not CommonJS `require()`)
3. **Avoid mocks** - prefer real operations
4. **Always clean up** resources in `afterEach()`
5. **Use strong, specific assertions**
6. **Make tests CI-aware** with timeouts
7. **Normalize paths** for cross-platform compatibility
8. **Leverage test-utils/** for common patterns
9. **Test with real data** whenever possible
10. **Write descriptive test names** that describe behavior

---

For more information, see:
- Node.js Test Runner: https://nodejs.org/docs/latest/api/test.html
- Test Utilities README: ./test-utils/README.md
