# Test Quality Improvement Implementation Plan

**Created**: 2025-11-06
**Based on**: test-quality-analysis-report.md
**Current Test Quality Score**: 72/100
**Target Score**: 80+/100

---

## Executive Summary

This plan addresses 43 identified issues across 42 test files, focusing on eliminating code duplication, strengthening assertions, and improving test reliability. The approach is phased to minimize risk, with each phase building on the previous one.

**Key Improvements**:
- Remove ~500+ lines of duplicated production code from tests
- Strengthen 12 weak assertions from existence checks to value validation
- Create shared test utilities to eliminate duplication
- Fix 8 brittle tests that fail on slow CI systems
- Improve integration test coverage from 35% to 40%+

**Estimated Total Effort**: 25-35 hours across 4 phases

**Success Metrics**:
- Test Quality Score: 72 → 80+
- Integration Test Coverage: 35% → 40%+
- Code Duplication: High → Low
- All tests pass consistently on CI/CD
- Zero flaky tests

---

## Pre-work / Prerequisites

### PHASE 0: Investigation and Setup (2-3 hours)

**Purpose**: Understand current state before making changes

#### Task 0.1: Verify server.js Export Structure
**File**: `mcp-server/server.js`
**Effort**: 30 minutes
**Action**:
```bash
# Check what's currently exported
grep -n "module.exports\|export {" mcp-server/server.js
```

**Verify these functions are exported or add exports**:
- `parseFlexibleDate`
- `detectLLMClient`
- `calculateCostSavings`
- `MODEL_PRICING` (constant)
- `recordCompression`
- `getCompressionStats`

**Expected Result**: All functions needed by tests are accessible for import

---

#### Task 0.2: Investigate test-cache.mjs Purpose
**File**: `mcp-server/test-cache.mjs`
**Effort**: 30 minutes
**Action**:
- Read the module completely
- Identify which tests depend on it
- Determine if it's solving a real problem or can be replaced with beforeEach/afterEach

**Files that import test-cache**:
```bash
grep -r "from.*test-cache" mcp-server/test-*.{js,mjs}
```

**Decision Point**: Keep if solving race conditions, remove if just managing state

---

#### Task 0.3: Run Baseline Test Suite
**Effort**: 30 minutes
**Action**:
```bash
cd mcp-server
npm test 2>&1 | tee test-baseline-results.txt
```

**Record**:
- Total tests
- Pass/fail count
- Execution time
- Any warnings

**Acceptance Criteria**: Have baseline metrics to compare against after changes

---

#### Task 0.4: Create Feature Branch
**Effort**: 15 minutes
**Action**:
```bash
git checkout -b test-quality-improvements
git push -u origin test-quality-improvements
```

**Acceptance Criteria**: Clean branch ready for incremental commits

---

## Phase 1: Critical Fixes (Quick Wins)

**Estimated Effort**: 4-6 hours
**Risk Level**: Low
**Dependencies**: Phase 0 complete

These are isolated, low-risk fixes that improve test reliability immediately.

---

### Task 1.1: Fix Weak Assertions in Cost Tracking Tests

**File**: `mcp-server/test-cost-tracking.test.mjs:250-265`
**Severity**: High
**Effort**: 30 minutes
**Issue**: Assertions check `!== undefined` instead of validating actual values

**Current Code**:
```javascript
assert.ok(record.model !== undefined, 'model should exist');
assert.ok(record.client !== undefined, 'client should exist');
assert.ok(record.pricePerMTok !== undefined, 'pricePerMTok should exist');
```

**Fixed Code**:
```javascript
// Validate model is a non-empty string
assert.ok(typeof record.model === 'string' && record.model.length > 0,
  `model should be a non-empty string, got: ${record.model}`);

// Validate client is a known value
const validClients = ['anthropic', 'openai', 'auto'];
assert.ok(validClients.includes(record.client),
  `client should be one of [${validClients.join(', ')}], got: ${record.client}`);

// Validate pricePerMTok is a positive number
assert.ok(typeof record.pricePerMTok === 'number' && record.pricePerMTok > 0,
  `pricePerMTok should be a positive number, got: ${record.pricePerMTok}`);
```

**Testing**:
```bash
node --test test-cost-tracking.test.mjs
```

**Acceptance Criteria**: Test fails if fields contain invalid data (null, "", NaN, negative numbers)

---

### Task 1.2: Fix Brittle Timestamp Validation

**File**: `mcp-server/test-real-compressions.test.mjs:264-269`
**Severity**: High
**Effort**: 20 minutes
**Issue**: 60-second timeout too strict for slow CI systems

**Current Code**:
```javascript
const ageSeconds = (now - timestamp) / 1000;
if (ageSeconds < 0 || ageSeconds > 60) {
  errors.push(`Timestamp out of range: ${record.timestamp} (age: ${ageSeconds}s)`);
}
```

**Fixed Code** (Option A - Configurable timeout):
```javascript
const MAX_TIMESTAMP_AGE_SECONDS = process.env.CI ? 300 : 60; // 5 min on CI, 1 min locally
const ageSeconds = (now - timestamp) / 1000;
if (ageSeconds < 0 || ageSeconds > MAX_TIMESTAMP_AGE_SECONDS) {
  errors.push(`Timestamp out of range: ${record.timestamp} (age: ${ageSeconds}s, max: ${MAX_TIMESTAMP_AGE_SECONDS}s)`);
}
```

**Fixed Code** (Option B - Remove strict validation):
```javascript
// Just validate timestamp is recent (within last 24 hours)
const ageSeconds = (now - timestamp) / 1000;
const ONE_DAY_SECONDS = 86400;
if (ageSeconds < 0 || ageSeconds > ONE_DAY_SECONDS) {
  errors.push(`Timestamp unreasonable: ${record.timestamp} (age: ${ageSeconds}s)`);
}
```

**Recommendation**: Use Option A for better validation while allowing CI flexibility

**Testing**: Run on slow machine or add artificial delay

**Acceptance Criteria**: Test passes on CI systems with 2+ minute delays

---

### Task 1.3: Fix Path Comparison for Cross-Platform Compatibility

**File**: `mcp-server/test-real-compressions.test.mjs:232-234`
**Severity**: Medium
**Effort**: 15 minutes
**Issue**: String matching fails with different path separators

**Current Code**:
```javascript
if (record.path && !record.path.includes(path.basename(expectedPath))) {
  errors.push(`Path mismatch: expected ${expectedPath}, got ${record.path}`);
}
```

**Fixed Code**:
```javascript
if (record.path) {
  const normalizedRecordPath = path.normalize(record.path);
  const normalizedExpectedPath = path.normalize(expectedPath);
  const expectedBasename = path.basename(normalizedExpectedPath);

  if (!normalizedRecordPath.includes(expectedBasename)) {
    errors.push(`Path mismatch: expected basename "${expectedBasename}" in path "${normalizedRecordPath}"`);
  }
}
```

**Testing**:
```bash
# Test on Windows and Linux paths
node --test test-real-compressions.test.mjs
```

**Acceptance Criteria**: Works with both forward slashes and backslashes

---

### Task 1.4: Add Minimum Compression Ratio Validation

**File**: `mcp-server/test-statistics.test.mjs:65-67`
**Severity**: Medium
**Effort**: 20 minutes
**Issue**: Test passes even if compression saves only 1 token

**Current Code**:
```javascript
assert.ok(originalTokens.length > compressedTokens.length,
  'Compressed content should have fewer tokens than original');
```

**Fixed Code**:
```javascript
const MIN_COMPRESSION_RATIO = 0.7; // At least 30% reduction
const compressionRatio = compressedTokens.length / originalTokens.length;

assert.ok(originalTokens.length > compressedTokens.length,
  'Compressed content should have fewer tokens than original');

assert.ok(compressionRatio <= MIN_COMPRESSION_RATIO,
  `Compression should reduce tokens by at least 30%. Ratio: ${compressionRatio.toFixed(2)} (${originalTokens.length} → ${compressedTokens.length} tokens)`);
```

**Testing**: Verify with known compression results

**Acceptance Criteria**: Test fails if compression ratio > 0.7 (less than 30% reduction)

---

### Task 1.5: Fix Range Validation for Compression Ratios

**File**: `mcp-server/test-real-compressions.test.mjs:318-322`
**Severity**: Medium
**Effort**: 15 minutes

**Current Code**:
```javascript
assert.ok(newRecord.compressionRatio > 0 && newRecord.compressionRatio < 1,
  'compressionRatio should be between 0 and 1');
```

**Fixed Code**:
```javascript
const MAX_MEANINGFUL_RATIO = 0.8; // Should save at least 20%
assert.ok(newRecord.compressionRatio > 0 && newRecord.compressionRatio <= MAX_MEANINGFUL_RATIO,
  `compressionRatio should be between 0 and ${MAX_MEANINGFUL_RATIO} (at least 20% reduction), got: ${newRecord.compressionRatio}`);
```

**Testing**: Check with real compression results

**Acceptance Criteria**: Validates meaningful compression occurred

---

### Task 1.6: Improve Debug Output Truncation

**File**: `mcp-server/test-real-compressions.test.mjs:163-165`
**Severity**: Medium
**Effort**: 15 minutes
**Issue**: 200 character truncation hides useful error context

**Current Code**:
```javascript
const debugOutput = lines.length > 0 ? `\nFirst line: ${lines[0].substring(0, 200)}` : '\nNo lines';
```

**Fixed Code**:
```javascript
const MAX_DEBUG_LINES = 5;
const MAX_LINE_LENGTH = 500;

const debugOutput = lines.length > 0
  ? '\nFirst lines:\n' + lines.slice(0, MAX_DEBUG_LINES).map((line, i) =>
      `  ${i + 1}: ${line.substring(0, MAX_LINE_LENGTH)}${line.length > MAX_LINE_LENGTH ? '...' : ''}`
    ).join('\n')
  : '\nNo lines';
```

**Testing**: Trigger a failure and check error message

**Acceptance Criteria**: Debug output shows multiple lines with sufficient context

---

### Task 1.7: Add Tolerance to Currency Rounding Tests

**File**: `mcp-server/test-cost-tracking.test.mjs:431-441`
**Severity**: Low
**Effort**: 15 minutes
**Issue**: Exact rounding validation is brittle

**Current Code**:
```javascript
const costInfo1 = calculateCostSavings(1000);
assert.strictEqual(costInfo1.costSavingsUSD, 0.00);
```

**Fixed Code**:
```javascript
const CURRENCY_TOLERANCE = 0.01; // Allow $0.01 difference

function assertCostWithinTolerance(actual, expected, message) {
  const diff = Math.abs(actual - expected);
  assert.ok(diff <= CURRENCY_TOLERANCE,
    `${message}: expected ${expected}, got ${actual}, diff: ${diff}`);
}

const costInfo1 = calculateCostSavings(1000);
assertCostWithinTolerance(costInfo1.costSavingsUSD, 0.00, 'Cost for 1000 tokens');
```

**Testing**: Verify with various token amounts

**Acceptance Criteria**: Tests pass with minor rounding differences

---

### Task 1.8: Split Combined Assertions

**File**: `mcp-server/test-real-compressions.test.mjs:309-310`
**Severity**: Medium
**Effort**: 15 minutes
**Issue**: Generic error message doesn't indicate what failed

**Current Code**:
```javascript
assert.ok(finalCount > initialCount,
  `Stats file should be updated (${initialCount} → ${finalCount})`);
```

**Fixed Code**:
```javascript
// First, verify stats file exists
assert.ok(await fileExists(STATS_FILE),
  'Stats file should exist after compression');

// Then verify count increased
assert.ok(finalCount > initialCount,
  `Compression count should increase: ${initialCount} → ${finalCount}`);

// Verify it increased by exactly 1 (or expected amount)
assert.strictEqual(finalCount - initialCount, 1,
  'Should add exactly one compression record');
```

**Testing**: Test with missing file and with unchanged file

**Acceptance Criteria**: Clear error messages for each failure mode

---

### Phase 1 Rollout

**Steps**:
1. Create sub-branch: `git checkout -b phase-1-quick-fixes`
2. Apply all fixes above
3. Run full test suite: `npm test`
4. Commit with message: "fix: strengthen assertions and improve test reliability"
5. Merge to feature branch if all tests pass

**Success Criteria**:
- All tests pass
- No new flaky tests introduced
- Test output provides better error messages

**Rollback Plan**: If tests fail, revert commits and investigate which change caused failure

---

## Phase 2: Foundation - Shared Utilities and Exports

**Estimated Effort**: 6-8 hours
**Risk Level**: Medium
**Dependencies**: Phase 1 complete

This phase creates the infrastructure needed for Phase 3's refactoring.

---

### Task 2.1: Ensure server.js Exports All Required Functions

**File**: `mcp-server/server.js`
**Severity**: High
**Effort**: 1-2 hours
**Issue**: Tests duplicate production code because functions aren't exported

**Action**: Add or verify exports at end of server.js

**Code to Add**:
```javascript
// At the end of server.js, add module exports
module.exports = {
  // Core functions
  parseFlexibleDate,
  detectLLMClient,
  calculateCostSavings,
  recordCompression,
  getCompressionStats,

  // Constants
  MODEL_PRICING,

  // Utilities (if not already exported)
  formatTimestamp,
  validateStatsStructure,

  // For testing purposes
  __testing__: {
    // Internal functions that need testing but shouldn't be public API
    calculateTokenSavings,
    detectClientFromConfig
  }
};
```

**Important**: Verify this doesn't break the MCP server startup

**Testing**:
```bash
# Test server still starts
node server.js &
SERVER_PID=$!
sleep 2
kill $SERVER_PID

# Test imports work
node -e "const { parseFlexibleDate } = require('./server.js'); console.log(parseFlexibleDate);"
```

**Acceptance Criteria**:
- Server starts successfully
- All functions are importable from server.js
- No circular dependencies introduced

---

### Task 2.2: Create Shared Test Utilities Module

**New File**: `mcp-server/test-utils/index.mjs`
**Severity**: High
**Effort**: 2-3 hours
**Issue**: Duplicate helpers across multiple test files

**Create Directory**:
```bash
mkdir -p mcp-server/test-utils
```

**File Content**:
```javascript
/**
 * Shared test utilities for MCP server test suite
 * @module test-utils
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

/**
 * Check if file exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>}
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read JSON file safely
 * @param {string} filePath - Path to JSON file
 * @returns {Promise<Object|null>}
 */
export async function readJSON(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to read JSON from ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Write JSON file with formatting
 * @param {string} filePath - Path to write
 * @param {Object} data - Data to write
 */
export async function writeJSON(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Generate test fixture data with timestamps
 * @param {Object} options - Configuration
 * @returns {Object} Test data
 */
export function generateTestFixtures(options = {}) {
  const now = new Date();
  const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    now,
    daysAgo,
    timestamps: {
      today: now.toISOString(),
      yesterday: daysAgo(1).toISOString(),
      lastWeek: daysAgo(7).toISOString(),
      lastMonth: daysAgo(30).toISOString()
    },
    ...options
  };
}

/**
 * Create temporary test directory with cleanup
 * @param {string} prefix - Directory name prefix
 * @returns {Promise<{path: string, cleanup: Function}>}
 */
export async function createTempDir(prefix = 'ucpl-test') {
  const os = await import('os');
  const crypto = await import('crypto');

  const uuid = crypto.randomUUID().slice(0, 8);
  const tempPath = path.join(os.tmpdir(), `${prefix}-${uuid}`);

  await fs.mkdir(tempPath, { recursive: true });

  return {
    path: tempPath,
    cleanup: async () => {
      try {
        await fs.rm(tempPath, { recursive: true, force: true });
      } catch (error) {
        console.error(`Failed to cleanup temp dir ${tempPath}:`, error.message);
      }
    }
  };
}

/**
 * Poll for condition with exponential backoff
 * @param {Function} condition - Function returning boolean
 * @param {Object} options - Configuration
 * @returns {Promise<boolean>}
 */
export async function pollForCondition(condition, options = {}) {
  const {
    maxAttempts = 10,
    initialDelay = 100,
    maxDelay = 5000,
    backoffFactor = 2
  } = options;

  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (await condition()) {
      return true;
    }

    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  return false;
}

/**
 * Poll for stats file update
 * @param {string} statsPath - Path to stats file
 * @param {number} expectedCount - Expected compression count
 * @param {Object} options - Polling options
 * @returns {Promise<boolean>}
 */
export async function pollForStatsUpdate(statsPath, expectedCount, options = {}) {
  return pollForCondition(async () => {
    if (!await fileExists(statsPath)) {
      return false;
    }

    const stats = await readJSON(statsPath);
    const currentCount = stats?.recent?.length || 0;
    return currentCount >= expectedCount;
  }, options);
}

/**
 * Validate stats structure
 * @param {Object} stats - Stats object to validate
 * @throws {Error} If structure is invalid
 */
export function validateStatsStructure(stats) {
  if (!stats || typeof stats !== 'object') {
    throw new Error('Stats must be an object');
  }

  const required = ['recent', 'archived', 'monthly', 'summary'];
  for (const field of required) {
    if (!(field in stats)) {
      throw new Error(`Stats missing required field: ${field}`);
    }
  }

  if (!Array.isArray(stats.recent)) {
    throw new Error('stats.recent must be an array');
  }

  if (!Array.isArray(stats.archived)) {
    throw new Error('stats.archived must be an array');
  }

  if (typeof stats.summary !== 'object') {
    throw new Error('stats.summary must be an object');
  }
}
```

**Testing**:
```bash
# Create test file for utilities
cat > mcp-server/test-utils/index.test.mjs << 'EOF'
import test from 'node:test';
import assert from 'node:assert';
import { fileExists, createTempDir, pollForCondition } from './index.mjs';

test('fileExists returns false for non-existent file', async () => {
  const result = await fileExists('/tmp/non-existent-file-xyz.txt');
  assert.strictEqual(result, false);
});

test('createTempDir creates and cleans up directory', async () => {
  const { path, cleanup } = await createTempDir('test');
  assert.ok(await fileExists(path));
  await cleanup();
  assert.ok(!await fileExists(path));
});

test('pollForCondition succeeds when condition met', async () => {
  let counter = 0;
  const condition = () => ++counter >= 3;

  const result = await pollForCondition(condition, {
    maxAttempts: 5,
    initialDelay: 10
  });

  assert.strictEqual(result, true);
  assert.strictEqual(counter, 3);
});
EOF

node --test test-utils/index.test.mjs
```

**Acceptance Criteria**:
- Module exports all utilities
- All utility functions have JSDoc comments
- Utilities are tested
- No external dependencies beyond Node.js built-ins

---

### Task 2.3: Create MCP Client Test Utility

**New File**: `mcp-server/test-utils/mcp-client.mjs`
**Severity**: High
**Effort**: 1-2 hours
**Issue**: 85-line `callMCPTool()` helper duplicated in tests

**Extract from**: `test-real-compressions.test.mjs:124-209`

**File Content**:
```javascript
/**
 * MCP Protocol test client utilities
 * @module test-utils/mcp-client
 */

import { spawn } from 'child_process';

/**
 * Call MCP tool via stdio transport
 * @param {string} serverPath - Path to server.js
 * @param {string} toolName - Tool name to call
 * @param {Object} args - Tool arguments
 * @param {Object} options - Client options
 * @returns {Promise<Object>} Tool result
 */
export async function callMCPTool(serverPath, toolName, args, options = {}) {
  const { timeout = 30000 } = options;

  return new Promise((resolve, reject) => {
    const server = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' }
    });

    let stdout = '';
    let stderr = '';
    let jsonRpcId = 1;

    const timeoutHandle = setTimeout(() => {
      server.kill();
      reject(new Error(`MCP call timeout after ${timeout}ms`));
    }, timeout);

    server.stdout.on('data', (data) => {
      stdout += data.toString();

      // Parse JSON-RPC responses
      const lines = stdout.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const response = JSON.parse(line);

          // Handle tool call response
          if (response.id === jsonRpcId && response.result) {
            clearTimeout(timeoutHandle);
            server.kill();
            resolve(response.result);
            return;
          }

          // Handle errors
          if (response.error) {
            clearTimeout(timeoutHandle);
            server.kill();
            reject(new Error(`MCP error: ${response.error.message}`));
            return;
          }
        } catch (e) {
          // Not valid JSON yet, continue buffering
        }
      }
    });

    server.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    server.on('error', (error) => {
      clearTimeout(timeoutHandle);
      reject(new Error(`Failed to start MCP server: ${error.message}`));
    });

    server.on('exit', (code) => {
      clearTimeout(timeoutHandle);
      if (code !== 0 && code !== null) {
        reject(new Error(`MCP server exited with code ${code}. stderr: ${stderr}`));
      }
    });

    // Send initialize request
    const initRequest = {
      jsonrpc: '2.0',
      id: jsonRpcId++,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    };

    server.stdin.write(JSON.stringify(initRequest) + '\n');

    // Send tool call request
    const toolRequest = {
      jsonrpc: '2.0',
      id: jsonRpcId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    server.stdin.write(JSON.stringify(toolRequest) + '\n');
  });
}

/**
 * Validate MCP tool result structure
 * @param {Object} result - Tool result to validate
 * @param {Object} expectedFields - Expected fields
 * @throws {Error} If validation fails
 */
export function validateToolResult(result, expectedFields = {}) {
  if (!result || typeof result !== 'object') {
    throw new Error('Tool result must be an object');
  }

  for (const [field, validator] of Object.entries(expectedFields)) {
    if (!(field in result)) {
      throw new Error(`Tool result missing field: ${field}`);
    }

    if (validator && !validator(result[field])) {
      throw new Error(`Tool result field "${field}" failed validation`);
    }
  }
}
```

**Testing**: Update existing tests to use this utility

**Acceptance Criteria**:
- Extracted utility works with all existing tests
- No functionality lost from original implementation
- Easier to maintain in one place

---

### Task 2.4: Create Test Fixtures Module

**New File**: `mcp-server/test-utils/fixtures.mjs`
**Effort**: 1 hour

**File Content**:
```javascript
/**
 * Test fixtures and sample data
 * @module test-utils/fixtures
 */

/**
 * Sample compression records for testing
 */
export const SAMPLE_COMPRESSIONS = [
  {
    timestamp: new Date('2025-01-01T10:00:00Z').toISOString(),
    path: 'test-file.py',
    originalSize: 5000,
    compressedSize: 1500,
    tokensSaved: 3500,
    compressionRatio: 0.3,
    level: 'full',
    model: 'claude-sonnet-4',
    client: 'anthropic',
    pricePerMTok: 3.0,
    costSavingsUSD: 0.0105
  },
  {
    timestamp: new Date('2025-01-02T14:30:00Z').toISOString(),
    path: 'another-file.js',
    originalSize: 3000,
    compressedSize: 600,
    tokensSaved: 2400,
    compressionRatio: 0.2,
    level: 'minimal',
    model: 'gpt-4o',
    client: 'openai',
    pricePerMTok: 2.5,
    costSavingsUSD: 0.006
  }
];

/**
 * Valid stats structure for testing
 */
export function createEmptyStats() {
  return {
    recent: [],
    archived: [],
    monthly: {},
    summary: {
      totalCompressions: 0,
      totalTokensSaved: 0,
      totalCostSavingsUSD: 0,
      lastUpdated: new Date().toISOString()
    }
  };
}

/**
 * Create stats with sample data
 */
export function createStatsWithSamples(count = 1) {
  const stats = createEmptyStats();

  for (let i = 0; i < count; i++) {
    const sample = {
      ...SAMPLE_COMPRESSIONS[i % SAMPLE_COMPRESSIONS.length],
      timestamp: new Date(Date.now() - i * 3600000).toISOString() // Each hour apart
    };
    stats.recent.push(sample);
  }

  stats.summary.totalCompressions = stats.recent.length;
  stats.summary.totalTokensSaved = stats.recent.reduce((sum, r) => sum + r.tokensSaved, 0);
  stats.summary.totalCostSavingsUSD = stats.recent.reduce((sum, r) => sum + r.costSavingsUSD, 0);

  return stats;
}

/**
 * Sample model pricing data
 */
export const SAMPLE_MODEL_PRICING = {
  'claude-sonnet-4': { pricePerMTok: 3.00, name: 'Claude Sonnet 4' },
  'gpt-4o': { pricePerMTok: 2.50, name: 'GPT-4o' },
  'gpt-4o-mini': { pricePerMTok: 0.15, name: 'GPT-4o Mini' }
};
```

**Acceptance Criteria**: Reusable fixtures available for all tests

---

### Phase 2 Rollout

**Steps**:
1. Create sub-branch: `git checkout -b phase-2-shared-utilities`
2. Create test-utils directory and modules
3. Add exports to server.js
4. Test server still works
5. Run test suite to ensure no breakage
6. Commit: "feat: create shared test utilities and export server functions"
7. Merge to feature branch

**Success Criteria**:
- Server starts successfully
- All existing tests still pass
- Utilities are tested and documented
- No new dependencies added

---

## Phase 3: High Priority - Remove Code Duplication

**Estimated Effort**: 8-12 hours
**Risk Level**: High
**Dependencies**: Phase 2 complete (exports available)

This is the highest-impact phase, removing ~500 lines of duplicated production code from tests.

---

### Task 3.1: Remove Duplicated parseFlexibleDate

**Files to Update**:
- `mcp-server/test-date-parsing.test.mjs:18-43`
- `mcp-server/test-integration.test.mjs:60-110`

**Effort**: 30 minutes per file

**Current Code** (test-date-parsing.test.mjs):
```javascript
// Duplicate function definition (25+ lines)
function parseFlexibleDate(input) {
  // ... duplicated implementation
}

test('parseFlexibleDate with ISO date', async () => {
  const result = parseFlexibleDate('2025-01-01');
  // ...
});
```

**Fixed Code**:
```javascript
import { parseFlexibleDate } from './server.js';

test('parseFlexibleDate with ISO date', async () => {
  const result = parseFlexibleDate('2025-01-01');
  assert.ok(result instanceof Date, 'Should return Date object');
  assert.strictEqual(result.toISOString().split('T')[0], '2025-01-01');
});
```

**Testing**:
```bash
node --test test-date-parsing.test.mjs
node --test test-integration.test.mjs
```

**Acceptance Criteria**:
- Tests pass with imported function
- Tests validate actual production behavior
- No duplicate implementation remains

---

### Task 3.2: Remove Duplicated detectLLMClient

**Files to Update**:
- `mcp-server/test-llm-detection.test.mjs:36-73`
- `mcp-server/test-integration.test.mjs:60-110`

**Effort**: 30 minutes per file

**Current Code**:
```javascript
// 37 lines of duplicated implementation
function detectLLMClient(configPath = null) {
  // ...
}
```

**Fixed Code**:
```javascript
import { detectLLMClient } from './server.js';
import { createTempDir, writeJSON } from './test-utils/index.mjs';

test('detectLLMClient with config file override', async () => {
  const { path: tempDir, cleanup } = await createTempDir();
  const configPath = path.join(tempDir, 'test-config.json');

  try {
    await writeJSON(configPath, { model: 'gpt-4o' });
    const result = await detectLLMClient(configPath);

    assert.strictEqual(result.client, 'openai');
    assert.strictEqual(result.model, 'gpt-4o');
    assert.ok(result.pricePerMTok > 0);
  } finally {
    await cleanup();
  }
});
```

**Testing**: Run test file and verify config override works

**Acceptance Criteria**: Tests use real production function

---

### Task 3.3: Remove Duplicated calculateCostSavings

**Files to Update**:
- `mcp-server/test-cost-tracking.test.mjs:78-98`
- `mcp-server/test-integration.test.mjs:60-110`

**Effort**: 30 minutes per file

**Current Code**:
```javascript
// Simplified version that doesn't match production
function calculateCostSavings(tokensSaved, model = null) {
  // ... incomplete implementation
}
```

**Fixed Code**:
```javascript
import { calculateCostSavings } from './server.js';

test('calculateCostSavings returns correct USD amount', async () => {
  const result = await calculateCostSavings(1_000_000, 'claude-sonnet-4');

  // Claude Sonnet 4 is $3.00 per million tokens
  // 1M tokens saved = $3.00 savings
  assert.ok(typeof result.costSavingsUSD === 'number');
  assert.ok(result.costSavingsUSD > 2.90 && result.costSavingsUSD < 3.10,
    `Expected ~$3.00, got $${result.costSavingsUSD}`);

  assert.strictEqual(result.model, 'claude-sonnet-4');
  assert.ok(result.pricePerMTok > 0);
});
```

**Testing**: Verify with known token amounts

**Acceptance Criteria**: Tests validate actual production pricing

---

### Task 3.4: Import MODEL_PRICING Instead of Duplicating

**Files to Update**:
- `mcp-server/test-integration.test.mjs:22-32`
- `mcp-server/test-cost-tracking.test.mjs:29-32`

**Effort**: 15 minutes per file

**Current Code**:
```javascript
const MODEL_PRICING = {
  'claude-sonnet-4': { pricePerMTok: 3.00, name: 'Claude Sonnet 4' },
  // ... hardcoded pricing
};
```

**Fixed Code**:
```javascript
import { MODEL_PRICING } from './server.js';

test('MODEL_PRICING contains expected models', () => {
  assert.ok('claude-sonnet-4' in MODEL_PRICING, 'Should have Claude Sonnet 4');
  assert.ok('gpt-4o' in MODEL_PRICING, 'Should have GPT-4o');

  // Validate structure
  for (const [model, info] of Object.entries(MODEL_PRICING)) {
    assert.ok(typeof info.pricePerMTok === 'number' && info.pricePerMTok > 0,
      `${model} should have positive pricePerMTok`);
    assert.ok(typeof info.name === 'string' && info.name.length > 0,
      `${model} should have non-empty name`);
  }
});
```

**Acceptance Criteria**: Tests validate actual production pricing data

---

### Task 3.5: Replace Mock-Based Error Testing

**File**: `mcp-server/test-cost-tracking.test.mjs:357-426`
**Severity**: Medium
**Effort**: 1-2 hours
**Issue**: Test manually recreates production function with mock to simulate error

**Current Code**:
```javascript
test('should handle pricing failures gracefully', async () => {
  // Mock calculateCostSavings to throw error
  const originalCalcCost = calculateCostSavings;
  const mockCalculateCostSavings = async () => {
    throw new Error('Pricing service unavailable');
  };
  // ... manually recreates recordCompression function
```

**Better Approach** - Test with real error conditions:

```javascript
import { recordCompression } from './server.js';
import { createTempDir, writeJSON } from './test-utils/index.mjs';

test('recordCompression handles invalid config gracefully', async () => {
  const { path: tempDir, cleanup } = await createTempDir();
  const invalidConfigPath = path.join(tempDir, 'invalid-config.json');

  try {
    // Create config with invalid model
    await writeJSON(invalidConfigPath, { model: 'non-existent-model-xyz' });

    // Should fallback to default pricing
    const result = await recordCompression({
      path: 'test.py',
      originalSize: 1000,
      compressedSize: 300,
      configPath: invalidConfigPath
    });

    assert.ok(result.recorded, 'Should still record compression');
    assert.ok(result.usedFallback, 'Should indicate fallback was used');
    assert.ok(result.pricePerMTok > 0, 'Should have default pricing');
  } finally {
    await cleanup();
  }
});

test('recordCompression handles filesystem errors gracefully', async () => {
  // Use a read-only path or non-existent directory
  const readOnlyPath = '/dev/null/stats.json'; // Cannot write here

  const result = await recordCompression({
    path: 'test.py',
    originalSize: 1000,
    compressedSize: 300,
    statsPath: readOnlyPath
  });

  assert.ok(!result.recorded, 'Should not claim success');
  assert.ok(result.error, 'Should return error information');
  assert.ok(result.error.includes('permission') || result.error.includes('ENOENT'),
    'Error should indicate filesystem issue');
});
```

**Acceptance Criteria**:
- Tests use real production code
- Error conditions are realistic (file permissions, missing files, invalid data)
- No manual recreation of production logic

---

### Task 3.6: Remove test-cache.mjs Dependency

**File**: `mcp-server/test-cache.mjs`
**Effort**: 2-3 hours (includes investigation)
**Decision Point**: Based on Task 0.2 findings

**Option A** - If cache is needed for test isolation:
```javascript
// Keep but simplify
// Use beforeEach/afterEach in tests instead of manual cache control
```

**Option B** - If cache is unnecessary:
```javascript
// Remove the module
// Update tests to use beforeEach/afterEach for isolation

// Example test update:
import test from 'node:test';

let testCache;

test.beforeEach(() => {
  testCache = new Map(); // Fresh cache for each test
});

test.afterEach(() => {
  testCache.clear();
});

test('function uses cache correctly', () => {
  // Test with local cache instance
});
```

**Files to Update**: All tests importing test-cache.mjs

**Acceptance Criteria**: Tests remain isolated without global cache module

---

### Phase 3 Rollout

**Steps**:
1. Create sub-branch: `git checkout -b phase-3-remove-duplication`
2. Update one file at a time
3. Run tests after each file update
4. If any test fails, investigate before proceeding
5. Commit each major change separately for easy rollback
6. Merge to feature branch when all tests pass

**Success Criteria**:
- Zero duplicated production code in tests
- All tests pass consistently
- Tests validate actual production behavior
- No manual mocks of internal functions

**Rollback Plan**:
- Keep Phase 2 branch available
- Each file change is a separate commit for granular rollback

---

## Phase 4: Medium Priority Improvements

**Estimated Effort**: 6-8 hours
**Risk Level**: Medium
**Dependencies**: Phase 3 complete

Optional improvements that enhance test quality but aren't critical.

---

### Task 4.1: Add Real Error Path Testing

**Files to Update**: Multiple files
**Effort**: 2-3 hours

**Add tests for**:
- File permission errors
- Malformed JSON in config files
- Concurrent file access
- Disk full scenarios
- Network timeouts (if applicable)

**Example**:
```javascript
import { detectLLMClient } from './server.js';
import { createTempDir, writeJSON } from './test-utils/index.mjs';

test('detectLLMClient handles malformed JSON gracefully', async () => {
  const { path: tempDir, cleanup } = await createTempDir();
  const configPath = path.join(tempDir, 'malformed.json');

  try {
    // Write invalid JSON
    await fs.writeFile(configPath, '{ invalid json }', 'utf-8');

    const result = await detectLLMClient(configPath);

    // Should fallback to auto-detection
    assert.ok(result.client, 'Should have fallback client');
    assert.ok(result.usedFallback, 'Should indicate config error');
  } finally {
    await cleanup();
  }
});
```

**Acceptance Criteria**: Error paths are tested with real filesystem errors

---

### Task 4.2: Improve Integration Test Coverage

**Goal**: Increase from 35% to 40%+
**Effort**: 2-3 hours

**Add tests for**:
- End-to-end compression workflow
- Stats accumulation over time
- Monthly archive rotation
- Backup and restore operations
- Config file discovery and loading

**Example**:
```javascript
import { createTempDir, writeJSON, readJSON } from './test-utils/index.mjs';
import { callMCPTool } from './test-utils/mcp-client.mjs';

test('end-to-end compression workflow', async (t) => {
  const { path: tempDir, cleanup } = await createTempDir();
  const statsPath = path.join(tempDir, 'stats.json');
  const testFile = path.join(tempDir, 'sample.py');

  try {
    // Create test file
    await fs.writeFile(testFile, 'def hello():\n    return "world"\n', 'utf-8');

    // Compress via MCP
    const result = await callMCPTool('./server.js', 'compress_code_context', {
      path: testFile,
      level: 'full',
      format: 'text'
    });

    assert.ok(result.content, 'Should return compressed content');

    // Verify stats were recorded
    const stats = await readJSON(statsPath);
    assert.strictEqual(stats.recent.length, 1, 'Should have 1 compression record');

    const record = stats.recent[0];
    assert.strictEqual(record.path, testFile);
    assert.ok(record.compressionRatio < 1, 'Should have meaningful compression');
  } finally {
    await cleanup();
  }
});
```

**Acceptance Criteria**: Integration test coverage ≥ 40%

---

### Task 4.3: Add Compression Ratio Validation

**Files to Update**:
- `test-statistics.test.mjs`
- `test-real-compressions.test.mjs`

**Effort**: 30 minutes

**Already covered in Phase 1, Task 1.4**

---

### Task 4.4: Extract Complex Validation Functions

**File**: `mcp-server/test-real-compressions.test.mjs:213-275`
**Effort**: 1 hour
**Issue**: 60-line validation function is hard to debug

**Current Code**:
```javascript
function validateCompressionRecord(record, expectedPath) {
  const errors = [];

  // 60+ lines of validation
  // Hard to know which check failed

  if (errors.length > 0) {
    throw new Error(`Validation failed:\n${errors.join('\n')}`);
  }
}
```

**Better Approach**:
```javascript
// Move to test-utils/validators.mjs

export function validateTimestamp(timestamp, maxAgeSeconds = 300) {
  if (!timestamp) {
    throw new Error('Timestamp is required');
  }

  const ts = new Date(timestamp);
  if (isNaN(ts.getTime())) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }

  const ageSeconds = (Date.now() - ts.getTime()) / 1000;
  if (ageSeconds < 0 || ageSeconds > maxAgeSeconds) {
    throw new Error(`Timestamp out of range: ${timestamp} (age: ${ageSeconds}s)`);
  }
}

export function validatePath(recordPath, expectedPath) {
  if (!recordPath) {
    throw new Error('Path is required');
  }

  const normalizedRecord = path.normalize(recordPath);
  const normalizedExpected = path.normalize(expectedPath);
  const expectedBasename = path.basename(normalizedExpected);

  if (!normalizedRecord.includes(expectedBasename)) {
    throw new Error(`Path mismatch: expected "${expectedBasename}" in "${normalizedRecord}"`);
  }
}

export function validateCompressionRatio(ratio) {
  if (typeof ratio !== 'number') {
    throw new Error(`Compression ratio must be number, got: ${typeof ratio}`);
  }

  if (ratio <= 0 || ratio >= 1) {
    throw new Error(`Compression ratio must be between 0 and 1, got: ${ratio}`);
  }

  const MAX_MEANINGFUL_RATIO = 0.8; // At least 20% compression
  if (ratio > MAX_MEANINGFUL_RATIO) {
    throw new Error(`Compression ratio ${ratio} is too high (less than 20% reduction)`);
  }
}

export function validateCompressionRecord(record, expectedPath) {
  // Call individual validators for clear error messages
  validateTimestamp(record.timestamp);
  validatePath(record.path, expectedPath);
  validateCompressionRatio(record.compressionRatio);

  // Additional validations
  if (typeof record.tokensSaved !== 'number' || record.tokensSaved <= 0) {
    throw new Error(`tokensSaved must be positive number, got: ${record.tokensSaved}`);
  }

  if (!['minimal', 'signatures', 'full'].includes(record.level)) {
    throw new Error(`Invalid compression level: ${record.level}`);
  }
}
```

**Usage**:
```javascript
import { validateCompressionRecord } from './test-utils/validators.mjs';

test('compression record is valid', async () => {
  const record = await compressAndGetRecord('test.py');

  // Clear error message if any validation fails
  validateCompressionRecord(record, 'test.py');
});
```

**Acceptance Criteria**: Validation failures show exactly which check failed

---

### Task 4.5: Replace Hardcoded Test Files with Dynamic Generation

**File**: `mcp-server/test-mcp-stats.js:63-75`
**Effort**: 30 minutes

**Current Code**:
```javascript
arguments: {
  path: './scripts/validate_ucpl.py', // Hardcoded external file
  level: 'minimal',
  format: 'summary'
}
```

**Fixed Code**:
```javascript
import { createTempDir } from './test-utils/index.mjs';

test('MCP tool compresses test file', async () => {
  const { path: tempDir, cleanup } = await createTempDir();
  const testFile = path.join(tempDir, 'test.py');

  // Create test file with known content
  const testContent = `
def hello_world():
    """Say hello"""
    print("Hello, World!")

def add(a, b):
    """Add two numbers"""
    return a + b

if __name__ == "__main__":
    hello_world()
  `.trim();

  try {
    await fs.writeFile(testFile, testContent, 'utf-8');

    const result = await callMCPTool('./server.js', 'compress_code_context', {
      path: testFile,
      level: 'minimal',
      format: 'summary'
    });

    assert.ok(result.summary, 'Should return summary');
    assert.ok(result.summary.includes('hello_world'), 'Should mention function names');
  } finally {
    await cleanup();
  }
});
```

**Acceptance Criteria**: Tests create their own test files and don't depend on external files

---

### Phase 4 Rollout

**Steps**:
1. Create sub-branch: `git checkout -b phase-4-improvements`
2. Implement tasks incrementally
3. Run tests after each change
4. Commit when test suite passes
5. Merge to feature branch

**Success Criteria**:
- Integration test coverage ≥ 40%
- Error paths tested with real errors
- Validation functions are modular and clear
- No external file dependencies

---

## Phase 5: Optional - Standardization and Polish

**Estimated Effort**: 4-6 hours
**Risk Level**: Low
**Dependencies**: All previous phases complete

These are nice-to-have improvements that can be done in a separate PR.

---

### Task 5.1: Standardize Test File Naming

**Files**: All 42 test files
**Effort**: 3-4 hours (includes CI/CD updates)
**Issue**: Mixed extensions (.js, .mjs, .test.mjs)

**Decision**: Standardize on `.test.mjs` for all test files

**Script to Rename**:
```bash
#!/bin/bash
# rename-tests.sh

cd mcp-server

# Rename .js to .test.mjs
for file in test-*.js; do
  if [ -f "$file" ]; then
    base=$(basename "$file" .js)
    mv "$file" "${base}.test.mjs"
    echo "Renamed $file → ${base}.test.mjs"
  fi
done

# Rename .mjs to .test.mjs (unless already .test.mjs)
for file in test-*.mjs; do
  if [[ ! "$file" =~ \.test\.mjs$ ]]; then
    base=$(basename "$file" .mjs)
    mv "$file" "${base}.test.mjs"
    echo "Renamed $file → ${base}.test.mjs"
  fi
done

echo "Done! Run 'npm test' to verify."
```

**Update package.json**:
```json
{
  "scripts": {
    "test": "node --test 'test-*.test.mjs'"
  }
}
```

**Update CI/CD Configuration** (if exists):
- Update test file patterns
- Update coverage configuration
- Update any documentation

**Testing**:
```bash
npm test
```

**Acceptance Criteria**:
- All test files use .test.mjs extension
- npm test discovers all tests
- CI/CD pipeline runs all tests

---

### Task 5.2: Migrate Standalone Scripts to node:test

**Files**:
- `mcp-server/test-statistics.js`
- `mcp-server/test-mcp-stats.js`
- `mcp-server/test-backup-restore-safety.js`

**Effort**: 1 hour per file
**Issue**: Shebangs and manual test execution

**Current Structure**:
```javascript
#!/usr/bin/env node
// Manual test runner

async function testStatsPersistence() { }
async function testStatsCalculations() { }

async function main() {
  await testStatsPersistence();
  await testStatsCalculations();
  console.log('All tests passed!');
}

main().catch(console.error);
```

**Converted to node:test**:
```javascript
import test from 'node:test';
import assert from 'node:assert';

test('stats persistence', async () => {
  // Test implementation
});

test('stats calculations', async () => {
  // Test implementation
});

// No main() function needed - node:test runs automatically
```

**Testing**:
```bash
node --test test-statistics.test.mjs
```

**Acceptance Criteria**:
- No shebangs
- Uses node:test format
- Integrated with main test suite

---

### Task 5.3: Add JSDoc to All Test Utilities

**Files**: All test-utils modules
**Effort**: 1-2 hours

**Example**:
```javascript
/**
 * Poll for a condition to become true with exponential backoff
 *
 * @param {Function} condition - Async function returning boolean
 * @param {Object} options - Configuration options
 * @param {number} [options.maxAttempts=10] - Maximum polling attempts
 * @param {number} [options.initialDelay=100] - Initial delay in ms
 * @param {number} [options.maxDelay=5000] - Maximum delay in ms
 * @param {number} [options.backoffFactor=2] - Exponential backoff multiplier
 * @returns {Promise<boolean>} True if condition met, false if timeout
 *
 * @example
 * const ready = await pollForCondition(
 *   async () => await fileExists('/tmp/file.txt'),
 *   { maxAttempts: 5, initialDelay: 100 }
 * );
 */
export async function pollForCondition(condition, options = {}) {
  // Implementation
}
```

**Acceptance Criteria**: All exported functions have JSDoc comments

---

### Task 5.4: Document Test Organization Guidelines

**New File**: `mcp-server/test-utils/README.md`
**Effort**: 30 minutes

**Content**:
```markdown
# Test Suite Organization

## Test File Naming

All test files use `.test.mjs` extension:
- `test-feature-name.test.mjs` - Feature-specific tests
- Alphabetically sorted in test output
- Automatically discovered by `npm test`

## Test Structure

Use descriptive test names that explain behavior:

✅ Good:
```javascript
test('calculateCostSavings returns correct USD amount for 1M tokens', async () => {
  // ...
});
```

❌ Bad:
```javascript
test('test 1', () => {
  // ...
});
```

## Test Utilities

Shared utilities are in `test-utils/`:
- `index.mjs` - Core utilities (file operations, polling, temp dirs)
- `mcp-client.mjs` - MCP protocol test client
- `fixtures.mjs` - Sample data and test fixtures
- `validators.mjs` - Validation helpers

## Test Isolation

Each test should:
- Use `beforeEach`/`afterEach` for setup/cleanup
- Create its own temp directory
- Not depend on other tests
- Clean up after itself

Example:
```javascript
let tempDir;

test.beforeEach(async () => {
  tempDir = await createTempDir();
});

test.afterEach(async () => {
  await tempDir.cleanup();
});
```

## Running Tests

```bash
# All tests
npm test

# Specific file
node --test test-cost-tracking.test.mjs

# With coverage
npm test -- --experimental-test-coverage
```
```

**Acceptance Criteria**: Clear documentation for test conventions

---

### Task 5.5: Move Example Files

**File**: `mcp-server/test-example.test.mjs`
**Effort**: 10 minutes

**Action**:
```bash
mkdir -p docs/examples
mv mcp-server/test-example.test.mjs docs/examples/
```

**Update .gitignore** if needed

**Acceptance Criteria**: Example files don't inflate test count

---

### Phase 5 Rollout

**Note**: This phase can be a separate PR after main fixes are merged

**Steps**:
1. Create separate PR branch: `git checkout -b test-standardization`
2. Run rename script
3. Update CI/CD configuration
4. Migrate standalone scripts
5. Add documentation
6. Get review and merge

**Success Criteria**:
- Consistent naming across all test files
- All tests use node:test format
- Clear documentation exists
- CI/CD works with new structure

---

## Testing Strategy

### Between Phases

After each phase:

1. **Run full test suite**:
```bash
npm test 2>&1 | tee phase-N-results.txt
```

2. **Compare with baseline**:
```bash
diff test-baseline-results.txt phase-N-results.txt
```

3. **Check for flakiness**:
```bash
for i in {1..5}; do
  echo "Run $i"
  npm test || echo "FAILED on run $i"
done
```

4. **Verify no performance regression**:
```bash
time npm test
# Compare with baseline time
```

### Coverage Tracking

```bash
# Run with coverage (if available)
npm test -- --experimental-test-coverage

# Track improvement:
# Phase 0: 72/100 quality score
# Phase 1: Target 75/100
# Phase 2: Target 77/100
# Phase 3: Target 80/100
# Phase 4: Target 82/100
```

---

## Rollout Strategy

### Overall Approach

**Incremental with Safety Checks**

1. **Feature Branch Development**:
   - All work happens in `test-quality-improvements` branch
   - Each phase is a sub-branch
   - Sub-branches merge to feature branch, not main

2. **Continuous Integration**:
   - Run tests after every commit
   - Don't proceed if tests fail
   - Keep detailed logs of all test runs

3. **Code Review**:
   - Get review before merging to main
   - Reviewer should run tests locally
   - Check for any missed issues

4. **Final Merge**:
   - Squash commits to keep history clean
   - Single commit message: "refactor: improve test quality (score 72 → 80+)"
   - Tag release if applicable

### Merge Strategy

```bash
# After each phase passes:
git checkout test-quality-improvements
git merge phase-N-name --squash
git commit -m "phase N: description"
npm test

# When all phases complete:
git checkout main
git merge test-quality-improvements --squash
git commit -m "refactor: improve test quality (score 72 → 80+)

- Remove 500+ lines of duplicated production code
- Strengthen 12 weak assertions
- Create shared test utilities
- Fix 8 brittle tests
- Improve integration coverage 35% → 40%

Test quality score: 72 → 80+"

git push origin main
```

### Monitoring Post-Merge

Watch for issues in next 7 days:

1. **Flaky Tests**: Re-run test suite multiple times
2. **CI/CD Failures**: Monitor pipeline
3. **Developer Feedback**: Any complaints about test behavior
4. **Coverage Metrics**: Verify improvement is sustained

---

## Risks and Mitigations

### Risk 1: Breaking Changes in server.js Exports

**Impact**: High
**Probability**: Medium

**Mitigation**:
- Test server startup after adding exports
- Use `__testing__` namespace for internal-only exports
- Keep exports backward compatible
- Document all exported functions

**Rollback**: Remove exports and revert to Phase 1

---

### Risk 2: Tests Reveal Actual Bugs in Production Code

**Impact**: High (but this is GOOD!)
**Probability**: Medium

**Scenario**: Strengthened assertions fail because production code has bugs

**Mitigation**:
- Investigate each failure carefully
- Determine if it's a test issue or production bug
- If production bug: Fix it or document as known issue
- Don't weaken tests just to make them pass

**Action Plan**:
```javascript
// If test fails after strengthening:
// 1. Check if production behavior is correct
// 2. If bug found: Create separate issue to fix
// 3. Temporarily mark test as skip with explanation:

test.skip('calculateCostSavings handles edge case', async () => {
  // TODO: Production bug #123 - fix cost calculation for 0 tokens
  // Test currently fails due to division by zero
});
```

---

### Risk 3: File Renaming Breaks CI/CD

**Impact**: High
**Probability**: Medium

**Mitigation**:
- Make Phase 5 optional/separate
- Update CI/CD config before renaming
- Test pipeline in feature branch before merging
- Have rollback script ready

**Rollback Script**:
```bash
#!/bin/bash
# rollback-rename.sh
git checkout main -- mcp-server/test-*.js
git checkout main -- mcp-server/test-*.mjs
```

---

### Risk 4: Removing test-cache.mjs Reveals Hidden Dependencies

**Impact**: Medium
**Probability**: Low

**Mitigation**:
- Thorough investigation in Phase 0
- Keep module until all tests pass without it
- Use feature flags to toggle between old/new approach

**Approach**:
```javascript
// Temporary transition code
const USE_TEST_CACHE = process.env.USE_TEST_CACHE === 'true';

if (USE_TEST_CACHE) {
  // Old approach
} else {
  // New approach with beforeEach/afterEach
}
```

---

### Risk 5: Time Investment vs Benefit

**Impact**: Low
**Probability**: Low

**Scenario**: Effort exceeds estimate and benefit doesn't justify cost

**Mitigation**:
- Phases 1-3 are high value, do these first
- Phase 4 is optional, skip if time-constrained
- Phase 5 can be separate PR later
- Track time spent and stop if exceeding 35 hours

**Decision Points**:
- After Phase 1: Evaluate if improvements are meaningful
- After Phase 2: Check if infrastructure is helping
- After Phase 3: Measure test quality score improvement
- Phase 4/5: Only proceed if time allows

---

## Success Criteria Summary

### Phase 0: Investigation
- [ ] Baseline test results recorded
- [ ] server.js exports identified
- [ ] test-cache.mjs purpose understood
- [ ] Feature branch created

### Phase 1: Critical Fixes
- [ ] All weak assertions strengthened
- [ ] Timestamp validation allows CI delays
- [ ] Path comparisons are cross-platform
- [ ] Minimum compression ratios enforced
- [ ] All tests pass consistently

### Phase 2: Foundation
- [ ] Shared test utilities created and tested
- [ ] server.js exports all needed functions
- [ ] Server starts successfully
- [ ] Test suite still passes

### Phase 3: Remove Duplication
- [ ] Zero duplicated production code in tests
- [ ] All tests import from server.js
- [ ] Mock-based error testing replaced with real errors
- [ ] test-cache.mjs removed (or decision made to keep)
- [ ] All tests pass

### Phase 4: Improvements
- [ ] Integration test coverage ≥ 40%
- [ ] Error path tests added
- [ ] Complex validators refactored
- [ ] No external file dependencies

### Phase 5: Standardization
- [ ] All test files use .test.mjs extension
- [ ] All tests use node:test format
- [ ] JSDoc on all utilities
- [ ] Documentation complete

### Overall Success
- [ ] Test quality score ≥ 80/100
- [ ] All 42 test files improved
- [ ] Zero flaky tests
- [ ] CI/CD pipeline passes
- [ ] Code review approved

---

## Appendix: Quick Reference

### Files by Priority

**Critical (Phase 1-3)**:
- `test-cost-tracking.test.mjs` - Weak assertions, duplication
- `test-real-compressions.test.mjs` - Brittle timestamp, path issues
- `test-integration.test.mjs` - Heavy duplication
- `test-llm-detection.test.mjs` - Duplicated functions
- `test-date-parsing.test.mjs` - Duplicated function
- `server.js` - Needs exports

**Important (Phase 4)**:
- `test-statistics.test.mjs` - Weak compression checks
- `test-mcp-stats.js` - Hardcoded paths, needs migration
- `test-backup-restore-safety.js` - Needs migration

**Optional (Phase 5)**:
- All 42 test files - Naming standardization
- `test-example.test.mjs` - Move to examples

### Commands Reference

```bash
# Run all tests
npm test

# Run specific test
node --test test-name.test.mjs

# Run with verbose output
node --test --test-reporter=spec test-name.test.mjs

# Check test count
ls -1 test-*.test.mjs | wc -l

# Find duplicated code
grep -n "function parseFlexibleDate" test-*.{js,mjs}

# Check imports
grep -n "from.*server.js" test-*.{js,mjs}
```

---

## REFINEMENTS (Self-Review)

### Refinement 1: Phase Ordering
**Original**: Phase 2 before Phase 1
**Refined**: Phase 1 (quick fixes) first for immediate value
**Reason**: Quick wins build momentum and don't depend on infrastructure

### Refinement 2: test-cache.mjs Handling
**Original**: Plan to remove immediately
**Refined**: Investigate first in Phase 0, decide based on findings
**Reason**: May be solving real race conditions

### Refinement 3: File Naming Standardization
**Original**: In main implementation phases
**Refined**: Optional Phase 5, can be separate PR
**Reason**: High disruption, low immediate value, affects CI/CD

### Refinement 4: Error Testing
**Original**: Abstract "add error tests"
**Refined**: Concrete examples with real filesystem errors
**Reason**: More actionable guidance

### Refinement 5: Acceptance Criteria
**Original**: Generic "tests pass"
**Refined**: Specific measurable criteria per task
**Reason**: Easier to validate completion

### Refinement 6: Code Examples
**Original**: References to line numbers only
**Refined**: Full before/after code examples
**Reason**: Developer can copy-paste and understand exactly what to change

---

**Plan Version**: 1.0
**Last Updated**: 2025-11-06
**Estimated Total Effort**: 25-35 hours
**Expected Test Quality Score After Completion**: 80-85/100
