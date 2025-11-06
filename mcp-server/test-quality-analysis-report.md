# Test Quality Analysis Report

## Executive Summary
- **Total Test Files Analyzed**: 42
- **Issues Found**: 43
- **Test Quality Score**: 72/100
- **Mock Ratio**: 5% of tests use mocks/stubs
- **Recommendation**: The test suite is generally well-structured with good use of real dependencies and minimal mocking. Key improvements needed include reducing code duplication through shared test fixtures, better test isolation patterns, and more comprehensive edge case coverage.

---

## Project Detection

**Detected Configuration:**
- Language: JavaScript/Node.js
- Framework: Node.js native test runner (node:test) - version 16+
- Mocking Tools: None detected (minimal mocking via inline functions)
- Test File Pattern: `test-*.{js,mjs,test.mjs}`
- Test Count: 42 files (mix of `.js`, `.mjs`, and `.test.mjs` patterns)

---

## Detailed Findings

### 1. Over-Mocking / Over-Stubbing (2 issues)

#### Issue 1.1
- **File**: `mcp-server/test-cost-tracking.test.mjs:357-426`
- **Severity**: Medium
- **Description**: Test manually replaces `calculateCostSavings` function with mock implementation to simulate error
- **Current Code**:
  ```javascript
  test('should handle pricing failures gracefully', async () => {
    // Mock calculateCostSavings to throw error
    const originalCalcCost = calculateCostSavings;
    const mockCalculateCostSavings = async () => {
      throw new Error('Pricing service unavailable');
    };
    // ... manually recreates recordCompression function
  ```
- **Impact**: Creates brittle test that duplicates production code logic instead of testing actual error handling
- **Recommended Fix**: Refactor production code to inject dependencies or use actual error conditions (e.g., invalid config file)

#### Issue 1.2
- **File**: `mcp-server/test-cost-tracking.test.mjs:65-77`
- **Severity**: Low
- **Description**: Uses test-cache module to manually control caching behavior
- **Current Code**:
  ```javascript
  function detectLLMClient() {
    incrementLLMDetectionCallCount();
    const cached = getCachedLLMClient();
    if (cached) {
      return cached;
    }
    // ... sets cache
  }
  ```
- **Impact**: Adds unnecessary complexity; could test actual cache implementation instead
- **Recommended Fix**: Test actual caching behavior through repeated calls rather than manual cache control

---

### 2. Flimsy / Brittle Tests (8 issues)

#### Issue 2.1
- **File**: `mcp-server/test-real-compressions.test.mjs:264-269`
- **Severity**: High
- **Description**: Timestamp validation checks if timestamp is within 60 seconds of test execution
- **Current Code**:
  ```javascript
  const ageSeconds = (now - timestamp) / 1000;
  if (ageSeconds < 0 || ageSeconds > 60) {
    errors.push(`Timestamp out of range: ${record.timestamp} (age: ${ageSeconds}s)`);
  }
  ```
- **Impact**: Test will fail on slow CI systems or if system clock changes
- **Recommended Fix**: Allow configurable timeout or remove strict time validation

#### Issue 2.2
- **File**: `mcp-server/test-real-compressions.test.mjs:232-234`
- **Severity**: Medium
- **Description**: Path validation uses string matching instead of normalized path comparison
- **Current Code**:
  ```javascript
  if (record.path && !record.path.includes(path.basename(expectedPath))) {
    errors.push(`Path mismatch: expected ${expectedPath}, got ${record.path}`);
  }
  ```
- **Impact**: Will fail if paths use different separators or are differently normalized
- **Recommended Fix**: Use `path.normalize()` or `path.resolve()` for comparison

#### Issue 2.3
- **File**: `mcp-server/test-real-compressions.test.mjs:163-165`
- **Severity**: Medium
- **Description**: Debugging output truncates to 200 characters, potentially hiding useful error info
- **Current Code**:
  ```javascript
  const debugOutput = lines.length > 0 ? `\nFirst line: ${lines[0].substring(0, 200)}` : '\nNo lines';
  ```
- **Impact**: Developers lose context when debugging test failures
- **Recommended Fix**: Include full line or multiple lines in debug output

#### Issue 2.4
- **File**: `mcp-server/test-integration.test.mjs:60-110`
- **Severity**: Medium
- **Description**: Duplicate helper functions copied into test file instead of importing from server.js
- **Current Code**: 500+ lines of duplicated function definitions (parseFlexibleDate, detectLLMClient, calculateCostSavings, etc.)
- **Impact**: Changes to production code aren't automatically tested; maintenance burden
- **Recommended Fix**: Import actual functions from server.js and test them directly

#### Issue 2.5
- **File**: `mcp-server/test-cost-tracking.test.mjs:78-98`
- **Severity**: Medium
- **Description**: Simplified version of `calculateCostSavings` that doesn't match production implementation
- **Current Code**:
  ```javascript
  function calculateCostSavings(tokensSaved, model = null) {
    // Simplified version for testing
    const costSavingsUSD = Math.round((tokensSaved / 1_000_000) * pricePerMTok * 100) / 100;
  }
  ```
- **Impact**: Test validates behavior of test code, not production code
- **Recommended Fix**: Import and test actual production function

#### Issue 2.6
- **File**: `mcp-server/test-llm-detection.test.mjs:36-73`
- **Severity**: Medium
- **Description**: Entire production function duplicated in test file
- **Impact**: Same as Issue 2.4
- **Recommended Fix**: Import from server.js

#### Issue 2.7
- **File**: `mcp-server/test-date-parsing.test.mjs:18-43`
- **Severity**: Medium
- **Description**: Duplicate parseFlexibleDate implementation in test
- **Impact**: Tests don't validate production code
- **Recommended Fix**: Import from server.js

#### Issue 2.8
- **File**: `mcp-server/test-statistics.js:33-57`
- **Severity**: Medium
- **Description**: Fixture loading function will fail silently if fixtures are moved/renamed
- **Current Code**:
  ```javascript
  async function loadFixtures() {
    try {
      TEST_CONTENT_ORIGINAL = await fs.readFile(path.join(FIXTURES_DIR, 'test-utils.js'), 'utf-8');
      // ...
    } catch (error) {
      console.error('Failed to load test fixtures:', error.message);
      throw error;
    }
  }
  ```
- **Impact**: Fragile dependency on specific file structure
- **Recommended Fix**: Use inline fixtures or generate test files programmatically

---

### 3. Weak Assertions (12 issues)

#### Issue 3.1
- **File**: `mcp-server/test-cost-tracking.test.mjs:250-265`
- **Severity**: High
- **Description**: Assertion checks field existence with `!== undefined` instead of specific values
- **Current Code**:
  ```javascript
  assert.ok(record.model !== undefined, 'model should exist');
  assert.ok(record.client !== undefined, 'client should exist');
  assert.ok(record.pricePerMTok !== undefined, 'pricePerMTok should exist');
  ```
- **Impact**: Test passes even if fields contain invalid data (null, empty string, NaN)
- **Recommended Fix**: Assert specific expected values or use type checks

#### Issue 3.2
- **File**: `mcp-server/test-real-compressions.test.mjs:318-322`
- **Severity**: Medium
- **Description**: Range checks for ratios/percentages are too permissive
- **Current Code**:
  ```javascript
  assert.ok(newRecord.compressionRatio > 0 && newRecord.compressionRatio < 1,
    'compressionRatio should be between 0 and 1');
  ```
- **Impact**: Doesn't validate that compression actually saved significant tokens
- **Recommended Fix**: Add minimum compression threshold (e.g., ratio < 0.8 for meaningful compression)

#### Issue 3.3
- **File**: `mcp-server/test-integration.test.mjs:332-333`
- **Severity**: Low
- **Description**: Uses permissive time difference check without explanation
- **Current Code**:
  ```javascript
  const diff = Math.abs(result.getTime() - expected.getTime());
  assert.ok(diff < 1000, 'Time difference should be < 1 second');
  ```
- **Impact**: May hide timing issues; 1 second is arbitrary
- **Recommended Fix**: Document why 1 second tolerance is acceptable or reduce to 100ms

#### Issue 3.4
- **File**: `mcp-server/test-cost-tracking.test.mjs:431-441`
- **Severity**: Low
- **Description**: Tests exact rounding behavior which is implementation detail
- **Current Code**:
  ```javascript
  const costInfo1 = calculateCostSavings(1000);
  assert.strictEqual(costInfo1.costSavingsUSD, 0.00);
  ```
- **Impact**: Test breaks if rounding strategy changes (e.g., banker's rounding)
- **Recommended Fix**: Allow small tolerance (±$0.01) for currency calculations

#### Issue 3.5
- **File**: `mcp-server/test-statistics.test.mjs:65-67`
- **Severity**: Medium
- **Description**: Only checks token count inequality without magnitude validation
- **Current Code**:
  ```javascript
  assert.ok(originalTokens.length > compressedTokens.length,
    'Compressed content should have fewer tokens than original');
  ```
- **Impact**: Test passes even if compression saves only 1 token
- **Recommended Fix**: Assert minimum compression ratio (e.g., 30% reduction)

#### Issue 3.6
- **File**: `mcp-server/test-statistics.test.mjs:106-108`
- **Severity**: Low
- **Description**: Checks array length without validating array content
- **Current Code**:
  ```javascript
  assert.strictEqual(loaded.compressions.length, 1);
  assert.strictEqual(loaded.summary.totalCompressions, 1);
  ```
- **Impact**: Doesn't verify the actual compression record data
- **Recommended Fix**: Validate record structure and field values

#### Issue 3.7
- **File**: `mcp-server/test-mcp-stats.js:149-157`
- **Severity**: Medium
- **Description**: Uses console output validation instead of testing behavior directly
- **Current Code**:
  ```javascript
  // Validates structure with helper function but still relies on logging
  validateCompressionRecord(loaded.recent[0], 'loaded compression record');
  console.log('  ✅ Compression record fields validated');
  ```
- **Impact**: Test success depends on console messages rather than code behavior
- **Recommended Fix**: Return validation results and assert on them

#### Issue 3.8
- **File**: `mcp-server/test-schema-validation.test.mjs:84-85`
- **Severity**: Low
- **Description**: Description length check uses arbitrary limit without justification
- **Current Code**:
  ```javascript
  assert.ok(descLength < 255, `Description length (${descLength}) should be under 255 chars`);
  ```
- **Impact**: Arbitrary limit may not match actual MCP spec requirements
- **Recommended Fix**: Reference actual MCP specification limit

#### Issue 3.9
- **File**: `mcp-server/test-schema-validation.test.mjs:122-127`
- **Severity**: Low
- **Description**: Type checking without value validation
- **Current Code**:
  ```javascript
  assert.ok(props.startDate, 'startDate parameter should exist');
  assert.strictEqual(props.startDate.type, 'string');
  ```
- **Impact**: Doesn't verify parameter has proper description or constraints
- **Recommended Fix**: Add assertions for description quality and format constraints

#### Issue 3.10
- **File**: `mcp-server/test-real-compressions.test.mjs:309-310`
- **Severity**: Medium
- **Description**: Generic assertion message doesn't indicate what increased
- **Current Code**:
  ```javascript
  assert.ok(finalCount > initialCount,
    `Stats file should be updated (${initialCount} → ${finalCount})`);
  ```
- **Impact**: When test fails, message doesn't say whether file wasn't created or count didn't increase
- **Recommended Fix**: Split into separate assertions for file existence and count increase

#### Issue 3.11
- **File**: `mcp-server/test-backup-restore-safety.js:146-147`
- **Severity**: Medium
- **Description**: Boolean assertion without meaningful error message
- **Current Code**:
  ```javascript
  assert.ok(!(await fileExists(BACKUP_FILE)), 'Backup file should be cleaned up');
  ```
- **Impact**: Failure message doesn't indicate what operation failed (restore vs cleanup)
- **Recommended Fix**: Separate assertions for restore success and cleanup

#### Issue 3.12
- **File**: `mcp-server/test-llm-detection.test.mjs:233-235`
- **Severity**: Low
- **Description**: Test validates fallback behavior but doesn't check error was logged
- **Current Code**:
  ```javascript
  // Function uses default pricing when model not found, but keeps the model name
  assert.strictEqual(result.model, 'invalid-model');
  ```
- **Impact**: Silent fallback could hide configuration errors in production
- **Recommended Fix**: Verify warning/error is logged when falling back

---

### 4. Missing Real Input/Output Testing (6 issues)

#### Issue 4.1
- **File**: `mcp-server/test-integration.test.mjs:22-32`
- **Severity**: High
- **Description**: MODEL_PRICING constants duplicated instead of importing from production code
- **Current Code**:
  ```javascript
  const MODEL_PRICING = {
    'claude-sonnet-4': { pricePerMTok: 3.00, name: 'Claude Sonnet 4' },
    // ... hardcoded pricing
  };
  ```
- **Impact**: Test doesn't validate actual pricing data used in production
- **Recommended Fix**: Import MODEL_PRICING from server.js to test real data

#### Issue 4.2
- **File**: `mcp-server/test-cost-tracking.test.mjs:29-32`
- **Severity**: High
- **Description**: Same issue - hardcoded pricing constants
- **Impact**: Pricing updates in production won't be reflected in tests
- **Recommended Fix**: Import from server.js

#### Issue 4.3
- **File**: `mcp-server/test-statistics.js:20-27`
- **Severity**: Medium
- **Description**: Test content loaded from fixtures instead of testing actual compression on real files
- **Current Code**:
  ```javascript
  let TEST_CONTENT_ORIGINAL = null;
  let TEST_CONTENT_COMPRESSED = null;
  // Loaded from fixture files
  ```
- **Impact**: Doesn't test whether compression actually works on real code files
- **Recommended Fix**: Add tests that compress actual source files and validate output

#### Issue 4.4
- **File**: `mcp-server/test-mcp-stats.js:63-75`
- **Severity**: Medium
- **Description**: MCP server test uses hardcoded path instead of dynamic test file
- **Current Code**:
  ```javascript
  arguments: {
    path: './scripts/validate_ucpl.py',
    level: 'minimal',
    format: 'summary'
  }
  ```
- **Impact**: Test depends on external file existing; won't work in isolated environments
- **Recommended Fix**: Create temporary test file with known content

#### Issue 4.5
- **File**: Multiple test files (integration, cost-tracking, llm-detection)
- **Severity**: Medium
- **Description**: Tests use synthetic Date objects instead of testing time-based behavior with actual delays
- **Impact**: Doesn't validate that time-based filtering actually works with real timestamps
- **Recommended Fix**: Add integration tests that create records at different times and filter them

#### Issue 4.6
- **File**: `mcp-server/test-llm-detection.test.mjs:168-176`
- **Severity**: Medium
- **Description**: Config file override test creates file but doesn't test file system errors
- **Current Code**:
  ```javascript
  await fs.writeFile(TEST_CONFIG_FILE, JSON.stringify({ model: 'gpt-4o' }));
  const result = await detectLLMClient(TEST_CONFIG_FILE);
  ```
- **Impact**: Missing tests for: file permission errors, malformed JSON, concurrent access
- **Recommended Fix**: Add error path tests with actual file system errors

---

### 5. Other Anti-Patterns (15 issues)

#### Issue 5.1
- **File**: `mcp-server/test-real-compressions.test.mjs:279-288`
- **Severity**: Low
- **Description**: `beforeEach` and `afterEach` handle file cleanup with try-catch
- **Current Code**:
  ```javascript
  beforeEach(async () => {
    await backupStats();
    await clearStats();
  });
  ```
- **Impact**: Could lead to test pollution if cleanup fails
- **Recommended Fix**: Use test fixtures or dedicated test database location

#### Issue 5.2
- **File**: Multiple files
- **Severity**: Medium
- **Description**: 18 test files use both `.js` and `.mjs` extensions inconsistently
- **Impact**: Confusing project structure; unclear when to use which extension
- **Recommended Fix**: Standardize on `.test.mjs` for all test files

#### Issue 5.3
- **File**: `mcp-server/test-statistics.js`, `mcp-server/test-mcp-stats.js`
- **Severity**: Medium
- **Description**: Tests use shebang (`#!/usr/bin/env node`) suggesting they should be executable scripts
- **Current Code**:
  ```javascript
  #!/usr/bin/env node
  /**
   * Integration test for token statistics tracking
   */
  ```
- **Impact**: Mixing test runner tests with standalone scripts creates confusion
- **Recommended Fix**: Migrate all tests to node:test format, remove shebangs

#### Issue 5.4
- **File**: `mcp-server/test-real-compressions.test.mjs:124-209`
- **Severity**: High
- **Description**: 85-line helper function `callMCPTool()` contains complex JSON-RPC protocol implementation
- **Impact**: Difficult to maintain; should be shared utility
- **Recommended Fix**: Extract to shared test utility module (`test-utils/mcp-client.js`)

#### Issue 5.5
- **File**: `mcp-server/test-real-compressions.test.mjs:69-97`
- **Severity**: Medium
- **Description**: `pollForStatsUpdate()` implements exponential backoff polling
- **Impact**: Complex async logic in test file; hard to test the test
- **Recommended Fix**: Use event-based waiting or extract to utility module

#### Issue 5.6
- **File**: `mcp-server/test-cache.mjs`
- **Severity**: Medium
- **Description**: Entire module dedicated to managing test cache state
- **Impact**: Unnecessary complexity; tests should be independent
- **Recommended Fix**: Use beforeEach/afterEach for test isolation instead of global cache

#### Issue 5.7
- **File**: `mcp-server/test-validation-helpers.js`
- **Severity**: Low
- **Description**: Validation helpers module imported by only 2 test files
- **Impact**: Over-engineering for limited use
- **Recommended Fix**: Consider inline validation or expand usage to all tests

#### Issue 5.8
- **File**: `mcp-server/test-statistics.js:85-158`
- **Severity**: Low
- **Description**: Test function names don't follow consistent naming pattern
- **Current Code**:
  ```javascript
  async function testStatsPersistence() { }
  async function testStatsCalculations() { }
  ```
- **Impact**: Hard to understand test structure when reading file
- **Recommended Fix**: Convert to `test()` blocks with descriptive names

#### Issue 5.9
- **File**: `mcp-server/test-integration.test.mjs:173-222`
- **Severity**: Low
- **Description**: generateStatsWithCost() creates fixture data with hardcoded dates using helper function
- **Current Code**:
  ```javascript
  function generateStatsWithCost() {
    const now = new Date();
    const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    // ...
  }
  ```
- **Impact**: Helper function defined inline instead of shared module
- **Recommended Fix**: Move to test fixtures module

#### Issue 5.10
- **File**: `mcp-server/test-backup-restore-safety.js:28-36`
- **Severity**: Low
- **Description**: Duplicate `fileExists()` helper appears in multiple test files
- **Impact**: Code duplication across test suite
- **Recommended Fix**: Create shared test utilities module

#### Issue 5.11
- **File**: `mcp-server/test-real-compressions.test.mjs:213-275`
- **Severity**: Medium
- **Description**: Complex validation function with 60+ lines doing multiple checks
- **Impact**: Hard to understand which specific assertion failed
- **Recommended Fix**: Break into smaller, focused validation functions

#### Issue 5.12
- **File**: Multiple test files
- **Severity**: Low
- **Description**: No consistent test organization pattern (some use describe nesting, others don't)
- **Impact**: Harder to read test output and understand test grouping
- **Recommended Fix**: Establish and document test organization guidelines

#### Issue 5.13
- **File**: `mcp-server/test-example.test.mjs`
- **Severity**: Low
- **Description**: Template/example test file included in test suite
- **Impact**: Not testing actual functionality; inflates test count
- **Recommended Fix**: Move to `/docs/examples/` or exclude from test runs

#### Issue 5.14
- **File**: Multiple files
- **Severity**: Medium
- **Description**: Many tests use hardcoded paths to `os.tmpdir()` without unique identifiers
- **Current Code**:
  ```javascript
  TEST_DIR = path.join(os.tmpdir(), `.ucpl-test-integration-${Date.now()}`);
  ```
- **Impact**: Potential conflicts if tests run in parallel
- **Recommended Fix**: Use `test.tmpdir()` or generate UUID-based temp directories

#### Issue 5.15
- **File**: `mcp-server/test-real-compressions.test.mjs:51-58`
- **Severity**: Low
- **Description**: Comments explain stats structure validation but could use JSDoc
- **Current Code**:
  ```javascript
  // Ensure stats has the expected structure (recent/archived/monthly/summary)
  if (!stats.recent) stats.recent = [];
  if (!stats.archived) stats.archived = [];
  ```
- **Impact**: Missing proper documentation for test utilities
- **Recommended Fix**: Add JSDoc comments to all helper functions

---

## Metrics Dashboard

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Mock Ratio | 5% | <30% | ✅ |
| Integration Tests | 35% | >40% | ⚠️ |
| Tests with Weak Assertions | 12 | 0 | ❌ |
| Code Duplication | High | Low | ❌ |
| Test Quality Score | 72/100 | >80 | ⚠️ |

---

## Action Items

### Critical Priority

- [ ] **[Multiple files]** - Remove duplicated production code from test files (parseFlexibleDate, detectLLMClient, calculateCostSavings, MODEL_PRICING) - Import from server.js instead *(Complexity: Medium)*
- [ ] **[test-real-compressions.test.mjs:124-209]** - Extract `callMCPTool()` helper to shared test utility module to avoid 85-line duplication *(Complexity: High)*
- [ ] **[test-cost-tracking.test.mjs:357-426]** - Replace mock-based error testing with real error conditions (invalid config file, filesystem errors) *(Complexity: Medium)*

### High Priority

- [ ] **[test-real-compressions.test.mjs:264-269]** - Fix brittle timestamp validation that fails on slow CI systems - use configurable timeout or remove strict time checks *(Complexity: Low)*
- [ ] **[test-cost-tracking.test.mjs:250-265]** - Strengthen assertions to check specific values instead of just field existence (`!== undefined`) *(Complexity: Low)*
- [ ] **[Multiple files]** - Standardize test file naming to `.test.mjs` extension for all 42 test files *(Complexity: Medium)*
- [ ] **[test-statistics.js, test-mcp-stats.js]** - Migrate standalone test scripts to node:test format, remove shebangs *(Complexity: Medium)*
- [ ] **[test-real-compressions.test.mjs:232-234]** - Fix path comparison to use `path.normalize()` for cross-platform compatibility *(Complexity: Low)*

### Medium Priority

- [ ] **[test-integration.test.mjs]** - Create shared test fixtures module for common data generation functions *(Complexity: Medium)*
- [ ] **[test-cache.mjs]** - Remove global cache module and use beforeEach/afterEach for proper test isolation *(Complexity: Medium)*
- [ ] **[test-real-compressions.test.mjs:69-97]** - Extract `pollForStatsUpdate()` exponential backoff polling to shared utility *(Complexity: Low)*
- [ ] **[Multiple files]** - Create shared `fileExists()` helper to eliminate duplication across 5+ test files *(Complexity: Low)*
- [ ] **[test-statistics.test.mjs:65-67]** - Add minimum compression ratio assertion (e.g., 30% reduction) instead of just checking inequality *(Complexity: Low)*
- [ ] **[test-mcp-stats.js:63-75]** - Replace hardcoded file path with dynamically created test file *(Complexity: Low)*
- [ ] **[Multiple files]** - Add error path tests for file system errors (permissions, malformed JSON, concurrent access) *(Complexity: Medium)*
- [ ] **[test-cost-tracking.test.mjs:431-441]** - Allow tolerance in currency rounding tests (±$0.01) instead of exact matching *(Complexity: Low)*

### Low Priority / Improvements

- [ ] **[test-example.test.mjs]** - Move example test to `/docs/examples/` directory or exclude from test runs *(Complexity: Low)*
- [ ] **[Multiple files]** - Establish and document consistent test organization pattern (describe nesting guidelines) *(Complexity: Low)*
- [ ] **[test-real-compressions.test.mjs:213-275]** - Break complex 60-line validation function into smaller, focused validators *(Complexity: Medium)*
- [ ] **[Multiple files]** - Add JSDoc comments to all test helper functions for better documentation *(Complexity: Low)*
- [ ] **[test-schema-validation.test.mjs:84-85]** - Reference actual MCP specification for description length limit instead of arbitrary 255 *(Complexity: Low)*
- [ ] **[Multiple files]** - Use `test.tmpdir()` or UUID-based directories instead of timestamp-based temp dirs for parallel test safety *(Complexity: Low)*
- [ ] **[test-llm-detection.test.mjs:233-235]** - Verify warning/error logging when fallback pricing is used *(Complexity: Low)*

---

## Recommendations

1. **Immediate Actions**:
   - **Import production code instead of duplicating**: The most impactful improvement is removing ~500+ lines of duplicated function definitions across test files. This ensures tests validate actual production behavior.
   - **Create shared test utilities module**: Extract common helpers like `callMCPTool()`, `pollForStatsUpdate()`, `fileExists()` to a dedicated `test-utils/` directory.
   - **Strengthen weak assertions**: Replace existence checks (`!== undefined`) with specific value assertions or type validation.

2. **Long-term Strategy**:
   - **Adopt test fixture pattern**: Create a `test/fixtures/` directory with reusable test data instead of generating it inline in each test
   - **Improve integration test coverage**: Currently at 35%, target 40%+ by adding end-to-end tests that exercise the full MCP protocol
   - **Standardize test structure**: Document and enforce consistent use of `describe` nesting, test naming conventions, and file organization
   - **Add mutation testing**: Consider using mutation testing tools to identify weak assertions that pass even when code is broken

3. **Best Practices** (Node.js + node:test specific):
   - ✅ **Excellent**: Minimal mocking (5%) - tests use real dependencies
   - ✅ **Excellent**: Good use of `beforeEach`/`afterEach` for test isolation
   - ✅ **Good**: Migration to native node:test from custom test runner
   - ⚠️ **Needs improvement**: Reduce code duplication by creating shared fixtures and utilities
   - ⚠️ **Needs improvement**: Use more specific assertions instead of generic existence checks
   - ❌ **Critical**: Stop duplicating production code in test files - always import and test the real implementation

---

*Analysis completed: 2025-11-06*
