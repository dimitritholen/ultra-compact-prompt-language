# Migration Guide: Custom Test Runners to node:test

This guide provides step-by-step instructions for migrating existing test files from custom test runners to Node.js native `node:test` module.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Step-by-Step Migration Process](#step-by-step-migration-process)
- [Common Migration Patterns](#common-migration-patterns)
- [Before/After Examples](#beforeafter-examples)
- [Common Pitfalls](#common-pitfalls)
- [Testing Your Migration](#testing-your-migration)
- [Resources](#resources)

## Prerequisites

- **Node.js 18.0.0 or higher** (node:test is native in Node 18+)
- Existing test files using custom test runners
- Familiarity with the `assert` module

**Verify your Node.js version:**

```bash
node --version  # Should be v18.0.0 or higher
```

## Quick Start

1. **Update package.json scripts:**

   ```json
   {
     "scripts": {
       "test": "node --test --test-reporter=spec",
       "test:watch": "node --test --watch --test-reporter=spec",
       "test:coverage": "node --test --experimental-test-coverage --test-reporter=spec"
     }
   }
   ```

2. **Rename test files to match pattern:**
   - `test-*.js` → `test-*.test.js` or keep as `test-*.js`
   - `*.spec.js` → `*.test.js`
   - Both patterns work with `node --test`

3. **Run your first test:**
   ```bash
   npm test
   ```

## Step-by-Step Migration Process

### Step 1: Understand Current Test Structure

Before migrating, analyze your current test file:

**Current test file (`test-integration.js`):**

```javascript
#!/usr/bin/env node
const assert = require("assert");

// Custom test tracking
let testResults = { passed: 0, failed: 0, tests: [] };

function recordTest(name, passed, error = null) {
  testResults.tests.push({ name, passed, error });
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${name}`);
  } else {
    testResults.failed++;
    console.error(`❌ ${name}`);
  }
}

async function testDateParsing() {
  console.log("\nTask 001: Date Parsing Tests");
  try {
    const result = parseFlexibleDate("2025-01-01");
    assert.ok(result instanceof Date);
    recordTest("Parse ISO date", true);
  } catch (error) {
    recordTest("Parse ISO date", false, error);
  }
}

// Run tests
(async () => {
  await testDateParsing();
  // ... more test functions

  console.log(
    `\nTests: ${testResults.passed} passed, ${testResults.failed} failed`,
  );
  process.exit(testResults.failed > 0 ? 1 : 0);
})();
```

### Step 2: Convert to node:test Structure

**Migrated test file (`test-integration.test.js`):**

```javascript
import {
  describe,
  test,
  before,
  after,
  beforeEach,
  afterEach,
} from "node:test";
import assert from "node:assert/strict";

describe("Date Parsing Tests", () => {
  test("should parse ISO date", () => {
    const result = parseFlexibleDate("2025-01-01");
    assert.ok(result instanceof Date);
  });

  test("should parse relative date", () => {
    const result = parseFlexibleDate("-7d");
    assert.ok(result instanceof Date);
    assert.ok(result < new Date());
  });

  test("should handle invalid date", () => {
    assert.throws(() => parseFlexibleDate("invalid"), {
      message: /Invalid date format/,
    });
  });
});
```

### Step 3: Migrate Test Organization

#### Before: Custom Test Functions

```javascript
async function testFeatureA() {
  console.log("\nFeature A Tests");
  try {
    // test code
    recordTest("Feature A works", true);
  } catch (error) {
    recordTest("Feature A works", false, error);
  }
}

async function testFeatureB() {
  console.log("\nFeature B Tests");
  // similar pattern
}

// Run all tests
(async () => {
  await testFeatureA();
  await testFeatureB();
})();
```

#### After: node:test describe/test blocks

```javascript
import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("Feature A", () => {
  test("should work correctly", async () => {
    // test code
    assert.ok(true);
  });
});

describe("Feature B", () => {
  test("should work correctly", async () => {
    // test code
    assert.ok(true);
  });
});
```

### Step 4: Migrate Setup/Teardown

#### Before: Manual Setup/Cleanup

```javascript
const TEST_DIR = path.join(os.tmpdir(), `.test-${Date.now()}`);

async function setupTests() {
  await fs.mkdir(TEST_DIR, { recursive: true });
}

async function cleanupTests() {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
}

// Run tests
(async () => {
  await setupTests();
  try {
    await testFeatureA();
    await testFeatureB();
  } finally {
    await cleanupTests();
  }
})();
```

#### After: Lifecycle Hooks

```javascript
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("Integration Tests", () => {
  let testDir;

  before(async () => {
    testDir = path.join(os.tmpdir(), `.test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test("feature A", async () => {
    // test code
  });

  test("feature B", async () => {
    // test code
  });
});
```

### Step 5: Migrate Assertions

#### Before: Basic assert module

```javascript
const assert = require("assert");

// Loose equality (avoid this)
assert.equal(result, expected);
assert.deepEqual(obj1, obj2);
```

#### After: Strict assertions (recommended)

```javascript
import assert from "node:assert/strict";

// Strict equality (recommended)
assert.strictEqual(result, expected);
assert.deepStrictEqual(obj1, obj2);
```

### Step 6: Handle Async Tests

#### Before: Manual promise handling

```javascript
async function testAsyncOperation() {
  try {
    const result = await someAsyncFunction();
    assert.strictEqual(result, "expected");
    recordTest("Async operation", true);
  } catch (error) {
    recordTest("Async operation", false, error);
  }
}
```

#### After: Native async support

```javascript
test("async operation", async () => {
  const result = await someAsyncFunction();
  assert.strictEqual(result, "expected");
});
```

### Step 7: Convert Module System (if needed)

#### Option A: Keep CommonJS

```javascript
const { describe, test } = require("node:test");
const assert = require("node:assert/strict");

describe("CommonJS Test", () => {
  test("works with require", () => {
    assert.ok(true);
  });
});
```

#### Option B: Convert to ES Modules

```javascript
// Add "type": "module" to package.json OR use .mjs extension
import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("ESM Test", () => {
  test("works with import", () => {
    assert.ok(true);
  });
});
```

## Common Migration Patterns

### Pattern 1: Try-Catch to Assertion

#### Before:

```javascript
try {
  await functionThatShouldThrow();
  recordTest("Should throw error", false);
} catch (error) {
  assert.strictEqual(error.message, "Expected error");
  recordTest("Should throw error", true);
}
```

#### After:

```javascript
test("should throw error", async () => {
  await assert.rejects(async () => await functionThatShouldThrow(), {
    message: "Expected error",
  });
});
```

### Pattern 2: Custom Test Counters to Built-in Reporting

#### Before:

```javascript
let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    failed++;
    console.error(`❌ ${name}`);
  }
}
```

#### After:

```javascript
// node:test handles counting and reporting automatically
test("test name", () => {
  // test code
});
```

### Pattern 3: Shared Test State

#### Before:

```javascript
let sharedState;

async function setupSharedState() {
  sharedState = await initializeState();
}

async function test1() {
  // uses sharedState
}

async function test2() {
  // uses sharedState
}
```

#### After:

```javascript
describe("Tests with shared state", () => {
  let sharedState;

  before(async () => {
    sharedState = await initializeState();
  });

  test("test 1", () => {
    // uses sharedState
  });

  test("test 2", () => {
    // uses sharedState
  });
});
```

### Pattern 4: Conditional Test Execution

#### Before:

```javascript
if (process.platform === "linux") {
  await testLinuxSpecific();
}
```

#### After:

```javascript
test("linux-specific test", { skip: process.platform !== "linux" }, () => {
  // linux-specific test code
});
```

## Before/After Examples

### Example 1: Simple Test File

#### Before:

```javascript
#!/usr/bin/env node
const assert = require("assert");

function testAddition() {
  console.log("Testing addition...");
  const result = 1 + 1;
  assert.strictEqual(result, 2);
  console.log("✅ Addition test passed");
}

function testSubtraction() {
  console.log("Testing subtraction...");
  const result = 5 - 3;
  assert.strictEqual(result, 2);
  console.log("✅ Subtraction test passed");
}

testAddition();
testSubtraction();
console.log("All tests passed!");
```

#### After:

```javascript
import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("Math Operations", () => {
  test("addition", () => {
    const result = 1 + 1;
    assert.strictEqual(result, 2);
  });

  test("subtraction", () => {
    const result = 5 - 3;
    assert.strictEqual(result, 2);
  });
});
```

### Example 2: File System Test

#### Before:

```javascript
#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");

const TEST_DIR = path.join(os.tmpdir(), `test-${Date.now()}`);

async function setup() {
  await fs.mkdir(TEST_DIR, { recursive: true });
}

async function cleanup() {
  await fs.rm(TEST_DIR, { recursive: true, force: true });
}

async function testFileCreation() {
  const filePath = path.join(TEST_DIR, "test.txt");
  await fs.writeFile(filePath, "content", "utf8");
  const content = await fs.readFile(filePath, "utf8");
  assert.strictEqual(content, "content");
  console.log("✅ File creation test passed");
}

(async () => {
  try {
    await setup();
    await testFileCreation();
  } finally {
    await cleanup();
  }
})();
```

#### After:

```javascript
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("File Operations", () => {
  let testDir;

  before(async () => {
    testDir = path.join(os.tmpdir(), `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test("file creation", async () => {
    const filePath = path.join(testDir, "test.txt");
    await fs.writeFile(filePath, "content", "utf8");
    const content = await fs.readFile(filePath, "utf8");
    assert.strictEqual(content, "content");
  });
});
```

### Example 3: Error Handling Test

#### Before:

```javascript
async function testErrorHandling() {
  let errorThrown = false;
  try {
    await functionThatThrows();
  } catch (error) {
    errorThrown = true;
    assert.strictEqual(error.message, "Expected error");
  }
  assert.ok(errorThrown, "Expected error to be thrown");
  console.log("✅ Error handling test passed");
}
```

#### After:

```javascript
test("error handling", async () => {
  await assert.rejects(async () => await functionThatThrows(), {
    message: "Expected error",
  });
});
```

## Common Pitfalls

### Pitfall 1: Forgetting to await async tests

**Wrong:**

```javascript
test("async test", () => {
  someAsyncFunction(); // Missing await!
  assert.ok(true); // Runs before async function completes
});
```

**Correct:**

```javascript
test("async test", async () => {
  await someAsyncFunction();
  assert.ok(true);
});
```

### Pitfall 2: Not cleaning up resources

**Wrong:**

```javascript
describe("Tests", () => {
  before(async () => {
    await createResource();
    // No cleanup defined!
  });

  test("uses resource", () => {
    // test code
  });
});
```

**Correct:**

```javascript
describe("Tests", () => {
  let resource;

  before(async () => {
    resource = await createResource();
  });

  after(async () => {
    await resource.cleanup();
  });

  test("uses resource", () => {
    // test code
  });
});
```

### Pitfall 3: Sharing mutable state between tests

**Wrong:**

```javascript
describe("Tests", () => {
  const sharedArray = []; // Mutable state shared across tests

  test("test 1", () => {
    sharedArray.push(1);
    assert.strictEqual(sharedArray.length, 1);
  });

  test("test 2", () => {
    // sharedArray still has item from test 1!
    assert.strictEqual(sharedArray.length, 0); // FAILS
  });
});
```

**Correct:**

```javascript
describe("Tests", () => {
  let sharedArray;

  beforeEach(() => {
    sharedArray = []; // Fresh array for each test
  });

  test("test 1", () => {
    sharedArray.push(1);
    assert.strictEqual(sharedArray.length, 1);
  });

  test("test 2", () => {
    assert.strictEqual(sharedArray.length, 0); // PASSES
  });
});
```

### Pitfall 4: Using loose equality assertions

**Wrong:**

```javascript
test("comparison", () => {
  assert.equal(1, "1"); // Passes due to type coercion
  assert.deepEqual({ a: 1 }, { a: "1" }); // Passes
});
```

**Correct:**

```javascript
import assert from "node:assert/strict";

test("comparison", () => {
  assert.strictEqual(1, 1); // Fails if types differ
  assert.deepStrictEqual({ a: 1 }, { a: 1 }); // Strict comparison
});
```

### Pitfall 5: Module resolution issues

**Issue:** Mixing CommonJS and ES Modules

**Solution:** Be consistent:

- Either use `require()` everywhere (CommonJS)
- Or use `import` everywhere + `"type": "module"` in package.json
- Or use `.mjs` extension for ES Modules

## Testing Your Migration

### Step 1: Run a single test file

```bash
node --test test-integration.test.js
```

### Step 2: Run all tests

```bash
npm test
```

### Step 3: Run with coverage

```bash
npm run test:coverage
```

### Step 4: Run in watch mode (during development)

```bash
npm run test:watch
```

### Step 5: Verify test output

Look for:

- ✓ All tests passing
- ✓ Test count matches original
- ✓ No unhandled promise rejections
- ✓ Clean exit (code 0)

## Migration Checklist

Use this checklist for each test file:

- [ ] File renamed to `*.test.js` or kept as `test-*.js`
- [ ] Imports converted (`node:test`, `node:assert/strict`)
- [ ] Test functions converted to `describe`/`test` blocks
- [ ] Setup code moved to `before` or `beforeEach` hooks
- [ ] Cleanup code moved to `after` or `afterEach` hooks
- [ ] Custom test counters removed (node:test handles this)
- [ ] Try-catch blocks converted to `assert.throws`/`assert.rejects`
- [ ] Async tests use `async`/`await` properly
- [ ] Assertions use strict mode (`assert/strict`)
- [ ] Test runs successfully with `node --test`
- [ ] Coverage reported correctly with `--experimental-test-coverage`

## Resources

### Official Documentation

- [Node.js Test Runner Docs](https://nodejs.org/api/test.html)
- [Node.js Assert Module](https://nodejs.org/api/assert.html)

### Example Files in This Project

- `test-example.test.mjs` - Comprehensive examples of node:test patterns (ES modules)
- `test-hooks-template.mjs` - Reusable lifecycle hook templates (ES modules)

### Command Reference

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
node --test test-integration.test.js

# Run with different reporter
node --test --test-reporter=tap

# Run with verbose output
node --test --test-reporter=spec
```

### Getting Help

If you encounter issues during migration:

1. Check the [Common Pitfalls](#common-pitfalls) section
2. Review example files (`test-example.test.mjs`, `test-hooks-template.mjs`)
3. Consult [official Node.js test documentation](https://nodejs.org/api/test.html)
4. Run tests with `--test-reporter=spec` for detailed output

---

**Migration Status Tracking:**

Current test files to migrate:

- `test-integration.js`
- `test-cost-tracking.js`
- `test-cost-reporting.js`
- `test-date-parsing.js`
- `test-llm-detection.js`
- `test-mcp-stats.js`
- `test-real-compressions.js`
- `test-schema-validation.js`
- `test-schema.js`
- `test-statistics-fallback.js`
- `test-statistics.js`
- `test-stats-query.js`
- `test-stats-retention.js`

**Next Steps:**

1. Start with simplest test file (e.g., `test-schema-validation.js`)
2. Migrate one file at a time
3. Verify each migration works before proceeding
4. Update this guide with any project-specific patterns discovered
