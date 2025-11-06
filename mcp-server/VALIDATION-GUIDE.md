# Validation Helpers - Quick Reference Guide

## Overview

The validation helper module (`test-validation-helpers.js`) provides comprehensive validation functions for statistics and compression record data structures.

## Quick Start

```javascript
const {
  validateCompressionRecord,
  validateStatsSummary,
  validateStatsFile,
  validateTimestamp,
  validateRange
} = require('./test-validation-helpers');

// Validate a compression record
validateCompressionRecord(record, 'my test context');

// Validate a stats file
validateStatsFile(stats, { requireRecords: true });

// Validate a summary object
validateStatsSummary(summary);
```

## Functions

### validateCompressionRecord(record, context)

Validates a complete compression record with all required and optional fields.

**Parameters**:
- `record` (object): Compression record to validate
- `context` (string, optional): Context for error messages (default: 'compression record')

**Validates**:

**Required Fields**:
- `timestamp` - Valid ISO date string, within reasonable time range
- `path` - Non-empty string
- `originalTokens` - Non-negative integer
- `compressedTokens` - Non-negative integer
- `tokensSaved` - Non-negative integer, equals `originalTokens - compressedTokens`
- `compressionRatio` - Number 0-1.1, equals `compressedTokens / originalTokens`
- `savingsPercentage` - Number 0-100, equals `(tokensSaved / originalTokens) * 100`
- `level` - One of: `'full'`, `'signatures'`, `'minimal'`
- `format` - One of: `'text'`, `'summary'`, `'json'`

**Optional Fields** (validated if present):
- `estimated` - Boolean
- `model` - Non-empty string (required if cost fields present)
- `client` - Non-empty string
- `pricePerMTok` - Non-negative number (required if cost fields present)
- `costSavingsUSD` - Non-negative number (required if cost fields present)
- `currency` - Must be `'USD'`

**Example**:
```javascript
const record = {
  timestamp: '2025-01-06T12:00:00.000Z',
  path: '/test/file.js',
  originalTokens: 1000,
  compressedTokens: 250,
  tokensSaved: 750,
  compressionRatio: 0.25,
  savingsPercentage: 75.0,
  level: 'full',
  format: 'text'
};

validateCompressionRecord(record, 'test record');
// Passes - all required fields valid

const invalidRecord = {
  ...record,
  tokensSaved: 700  // Wrong!
};

validateCompressionRecord(invalidRecord, 'invalid record');
// Throws: invalid record: tokensSaved (700) must equal originalTokens - compressedTokens (750)
```

### validateStatsSummary(summary, context)

Validates a statistics summary object.

**Parameters**:
- `summary` (object): Summary object to validate
- `context` (string, optional): Context for error messages (default: 'stats summary')

**Validates**:
- `totalCompressions` - Non-negative integer
- `totalOriginalTokens` - Non-negative integer
- `totalCompressedTokens` - Non-negative integer
- `totalTokensSaved` - Non-negative integer, equals `totalOriginalTokens - totalCompressedTokens`

**Example**:
```javascript
const summary = {
  totalCompressions: 5,
  totalOriginalTokens: 5000,
  totalCompressedTokens: 1250,
  totalTokensSaved: 3750
};

validateStatsSummary(summary);
// Passes - all fields valid and calculations correct
```

### validateStatsFile(stats, options)

Validates a complete statistics file structure.

**Parameters**:
- `stats` (object): Complete stats object to validate
- `options` (object, optional):
  - `requireRecords` (boolean): Require at least one compression record (default: false)

**Validates**:
- Presence of `summary` and `recent` objects
- All summary fields (via `validateStatsSummary`)
- All compression records in `recent` array (via `validateCompressionRecord`)
- Optionally validates at least one record exists
- Optional `daily` and `monthly` aggregation structures if present

**Example**:
```javascript
const stats = {
  summary: {
    totalCompressions: 1,
    totalOriginalTokens: 100,
    totalCompressedTokens: 25,
    totalTokensSaved: 75
  },
  recent: [
    {
      timestamp: '2025-01-06T12:00:00.000Z',
      path: '/test/file.js',
      originalTokens: 100,
      compressedTokens: 25,
      tokensSaved: 75,
      compressionRatio: 0.25,
      savingsPercentage: 75.0,
      level: 'full',
      format: 'text'
    }
  ]
};

validateStatsFile(stats, { requireRecords: true });
// Passes - complete valid structure
```

### validateTimestamp(value, fieldName)

Validates a timestamp string.

**Parameters**:
- `value` (string): Timestamp to validate
- `fieldName` (string, optional): Field name for error messages (default: 'timestamp')

**Validates**:
- Is a string
- Is a valid ISO date format
- Is within last 10 years
- Is not more than 1 minute in future (clock skew tolerance)

**Example**:
```javascript
validateTimestamp('2025-01-06T12:00:00.000Z');
// Passes

validateTimestamp('not-a-date');
// Throws: timestamp must be a valid ISO date string, got 'not-a-date'
```

### validateRange(value, min, max, fieldName)

Validates a numeric value is within a range.

**Parameters**:
- `value` (number): Value to validate
- `min` (number): Minimum allowed value (inclusive)
- `max` (number): Maximum allowed value (inclusive)
- `fieldName` (string, optional): Field name for error messages (default: 'value')

**Example**:
```javascript
validateRange(75, 0, 100, 'percentage');
// Passes

validateRange(150, 0, 100, 'percentage');
// Throws: percentage must be between 0 and 100, got 150
```

## Error Messages

All validation functions throw descriptive errors:

```javascript
// Missing field
"compression record: timestamp is required"

// Wrong type
"compression record: originalTokens must be a number"

// Out of range
"compression record: savingsPercentage must be between 0 and 100, got 150"

// Calculation error
"compression record: tokensSaved (700) must equal originalTokens - compressedTokens (750)"

// Invalid enum
"compression record: level must be one of [full, signatures, minimal], got 'invalid'"

// With custom context
"stats file recent[5]: timestamp must be a valid ISO date string"
```

## Testing Patterns

### Pattern 1: Validate and Log

```javascript
try {
  validateCompressionRecord(record);
  console.log('✅ Record is valid');
} catch (error) {
  console.log(`❌ Validation failed: ${error.message}`);
  throw error;
}
```

### Pattern 2: Validate Multiple Records

```javascript
stats.recent.forEach((record, index) => {
  validateCompressionRecord(record, `record #${index + 1}`);
});
console.log(`✅ All ${stats.recent.length} records validated`);
```

### Pattern 3: Conditional Validation

```javascript
// Only require records if stats file should have data
const hasRecords = stats.summary.totalCompressions > 0;
validateStatsFile(stats, { requireRecords: hasRecords });
```

### Pattern 4: Test Negative Cases

```javascript
test('should reject invalid level', () => {
  const record = { ...validRecord, level: 'invalid' };
  try {
    validateCompressionRecord(record);
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('level')) throw err;
    // Expected error - test passes
  }
});
```

## Tolerance Values

The validators use tolerances for floating-point comparisons:

- **Compression ratio**: 0.001 tolerance
  - `Math.abs(actual - expected) < 0.001`
- **Savings percentage**: 0.2% tolerance
  - `Math.abs(actual - expected) < 0.2`
- **Cost calculations**: 0.000001 tolerance
  - `Math.abs(actual - expected) < 0.000001`

## Extending Validation

### Add New Field Validation

Edit `test-validation-helpers.js`:

```javascript
function validateCompressionRecord(record, context = 'compression record') {
  // ... existing validations ...

  // Add new optional field validation
  if (record.myNewField !== undefined) {
    assert.strictEqual(
      typeof record.myNewField,
      'string',
      `${context}: myNewField must be a string if present`
    );
    assert.ok(
      record.myNewField.length > 0,
      `${context}: myNewField must not be empty if present`
    );
  }
}
```

### Add New Validation Function

```javascript
/**
 * Validate custom structure
 * @param {object} data - Data to validate
 * @param {string} context - Context for error messages
 */
function validateMyStructure(data, context = 'my structure') {
  assert.ok(data, `${context} must exist`);
  assert.strictEqual(typeof data, 'object', `${context} must be an object`);

  // Add your validations...
  assert.ok(data.requiredField, `${context}: requiredField is required`);
}

module.exports = {
  validateCompressionRecord,
  validateStatsSummary,
  validateStatsFile,
  validateTimestamp,
  validateRange,
  validateMyStructure  // Export new function
};
```

## Performance

All validation functions are lightweight:
- No I/O operations
- Simple type checks and comparisons
- Minimal overhead (microseconds per validation)
- Safe to use in tight loops

## Common Pitfalls

### 1. Forgetting Context Parameter

```javascript
// Less helpful error
validateCompressionRecord(record);
// Error: compression record: timestamp is required

// More helpful error
validateCompressionRecord(record, `test case #${i}`);
// Error: test case #5: timestamp is required
```

### 2. Not Handling Optional Fields

```javascript
// Wrong - assumes field exists
assert.strictEqual(record.model, 'gpt-4o');

// Right - check if field exists first
if (record.model !== undefined) {
  assert.strictEqual(record.model, 'gpt-4o');
}
```

### 3. Ignoring Floating-Point Precision

```javascript
// Wrong - exact comparison
assert.strictEqual(record.compressionRatio, 0.25);

// Right - use tolerance
const tolerance = 0.001;
assert.ok(Math.abs(record.compressionRatio - 0.25) < tolerance);
```

## See Also

- `test-statistics.js` - Example usage in integration tests
- `test-mcp-stats.js` - Example usage in MCP server tests
- `test-validation-helpers-unit.js` - Comprehensive unit tests (25+ test cases)
- `TASK-010-COMPLETION.md` - Implementation details and results
