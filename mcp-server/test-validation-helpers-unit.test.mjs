#!/usr/bin/env node

/**
 * Unit tests for validation helper functions
 * Tests both valid and invalid data structures to ensure proper validation
 */

const assert = require('assert');
const {
  validateCompressionRecord,
  validateStatsSummary,
  validateStatsFile,
  validateTimestamp,
  validateRange
} = require('./test-validation-helpers');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    testsFailed++;
  }
}

console.log('=== Validation Helpers Unit Tests ===\n');

// Test validateCompressionRecord with valid data
test('validateCompressionRecord - accepts valid minimal record', () => {
  const record = {
    timestamp: new Date().toISOString(),
    path: '/test/file.js',
    originalTokens: 100,
    compressedTokens: 25,
    tokensSaved: 75,
    compressionRatio: 0.25,
    savingsPercentage: 75.0,
    level: 'full',
    format: 'text'
  };
  validateCompressionRecord(record);
});

test('validateCompressionRecord - accepts valid record with cost fields', () => {
  const record = {
    timestamp: new Date().toISOString(),
    path: '/test/file.js',
    originalTokens: 1000000,
    compressedTokens: 250000,
    tokensSaved: 750000,
    compressionRatio: 0.25,
    savingsPercentage: 75.0,
    level: 'full',
    format: 'text',
    model: 'gpt-4o',
    client: 'claude-desktop',
    pricePerMTok: 2.50,
    costSavingsUSD: 1.875,
    currency: 'USD'
  };
  validateCompressionRecord(record);
});

test('validateCompressionRecord - accepts valid record with estimated flag', () => {
  const record = {
    timestamp: new Date().toISOString(),
    path: '/test/file.js',
    originalTokens: 100,
    compressedTokens: 25,
    tokensSaved: 75,
    compressionRatio: 0.25,
    savingsPercentage: 75.0,
    level: 'minimal',
    format: 'summary',
    estimated: true
  };
  validateCompressionRecord(record);
});

// Test validation failures
test('validateCompressionRecord - rejects missing timestamp', () => {
  const record = {
    path: '/test/file.js',
    originalTokens: 100,
    compressedTokens: 25,
    tokensSaved: 75,
    compressionRatio: 0.25,
    savingsPercentage: 75.0,
    level: 'full',
    format: 'text'
  };
  try {
    validateCompressionRecord(record);
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('timestamp')) throw err;
  }
});

test('validateCompressionRecord - rejects invalid timestamp', () => {
  const record = {
    timestamp: 'not-a-date',
    path: '/test/file.js',
    originalTokens: 100,
    compressedTokens: 25,
    tokensSaved: 75,
    compressionRatio: 0.25,
    savingsPercentage: 75.0,
    level: 'full',
    format: 'text'
  };
  try {
    validateCompressionRecord(record);
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('timestamp')) throw err;
  }
});

test('validateCompressionRecord - rejects negative tokens', () => {
  const record = {
    timestamp: new Date().toISOString(),
    path: '/test/file.js',
    originalTokens: -100,
    compressedTokens: 25,
    tokensSaved: 75,
    compressionRatio: 0.25,
    savingsPercentage: 75.0,
    level: 'full',
    format: 'text'
  };
  try {
    validateCompressionRecord(record);
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('non-negative')) throw err;
  }
});

test('validateCompressionRecord - rejects non-integer tokens', () => {
  const record = {
    timestamp: new Date().toISOString(),
    path: '/test/file.js',
    originalTokens: 100.5,
    compressedTokens: 25,
    tokensSaved: 75,
    compressionRatio: 0.25,
    savingsPercentage: 75.0,
    level: 'full',
    format: 'text'
  };
  try {
    validateCompressionRecord(record);
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('integer')) throw err;
  }
});

test('validateCompressionRecord - rejects incorrect tokensSaved calculation', () => {
  const record = {
    timestamp: new Date().toISOString(),
    path: '/test/file.js',
    originalTokens: 100,
    compressedTokens: 25,
    tokensSaved: 70, // Wrong! Should be 75
    compressionRatio: 0.25,
    savingsPercentage: 75.0,
    level: 'full',
    format: 'text'
  };
  try {
    validateCompressionRecord(record);
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('tokensSaved')) throw err;
  }
});

test('validateCompressionRecord - rejects invalid level', () => {
  const record = {
    timestamp: new Date().toISOString(),
    path: '/test/file.js',
    originalTokens: 100,
    compressedTokens: 25,
    tokensSaved: 75,
    compressionRatio: 0.25,
    savingsPercentage: 75.0,
    level: 'invalid',
    format: 'text'
  };
  try {
    validateCompressionRecord(record);
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('level')) throw err;
  }
});

test('validateCompressionRecord - rejects invalid format', () => {
  const record = {
    timestamp: new Date().toISOString(),
    path: '/test/file.js',
    originalTokens: 100,
    compressedTokens: 25,
    tokensSaved: 75,
    compressionRatio: 0.25,
    savingsPercentage: 75.0,
    level: 'full',
    format: 'invalid'
  };
  try {
    validateCompressionRecord(record);
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('format')) throw err;
  }
});

test('validateCompressionRecord - rejects savingsPercentage > 100', () => {
  const record = {
    timestamp: new Date().toISOString(),
    path: '/test/file.js',
    originalTokens: 100,
    compressedTokens: 25,
    tokensSaved: 75,
    compressionRatio: 0.25,
    savingsPercentage: 150.0,
    level: 'full',
    format: 'text'
  };
  try {
    validateCompressionRecord(record);
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('savingsPercentage')) throw err;
  }
});

// Test validateStatsSummary
test('validateStatsSummary - accepts valid summary', () => {
  const summary = {
    totalCompressions: 5,
    totalOriginalTokens: 1000,
    totalCompressedTokens: 250,
    totalTokensSaved: 750
  };
  validateStatsSummary(summary);
});

test('validateStatsSummary - rejects negative values', () => {
  const summary = {
    totalCompressions: -1,
    totalOriginalTokens: 1000,
    totalCompressedTokens: 250,
    totalTokensSaved: 750
  };
  try {
    validateStatsSummary(summary);
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('non-negative')) throw err;
  }
});

test('validateStatsSummary - rejects non-integer values', () => {
  const summary = {
    totalCompressions: 5.5,
    totalOriginalTokens: 1000,
    totalCompressedTokens: 250,
    totalTokensSaved: 750
  };
  try {
    validateStatsSummary(summary);
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('integer')) throw err;
  }
});

test('validateStatsSummary - rejects incorrect calculation', () => {
  const summary = {
    totalCompressions: 5,
    totalOriginalTokens: 1000,
    totalCompressedTokens: 250,
    totalTokensSaved: 700 // Wrong! Should be 750
  };
  try {
    validateStatsSummary(summary);
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('totalTokensSaved')) throw err;
  }
});

// Test validateStatsFile
test('validateStatsFile - accepts valid empty stats file', () => {
  const stats = {
    summary: {
      totalCompressions: 0,
      totalOriginalTokens: 0,
      totalCompressedTokens: 0,
      totalTokensSaved: 0
    },
    recent: []
  };
  validateStatsFile(stats);
});

test('validateStatsFile - accepts valid stats file with records', () => {
  const stats = {
    summary: {
      totalCompressions: 1,
      totalOriginalTokens: 100,
      totalCompressedTokens: 25,
      totalTokensSaved: 75
    },
    recent: [
      {
        timestamp: new Date().toISOString(),
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
});

test('validateStatsFile - rejects when requireRecords=true but no records', () => {
  const stats = {
    summary: {
      totalCompressions: 0,
      totalOriginalTokens: 0,
      totalCompressedTokens: 0,
      totalTokensSaved: 0
    },
    recent: []
  };
  try {
    validateStatsFile(stats, { requireRecords: true });
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('at least one')) throw err;
  }
});

// Test validateTimestamp
test('validateTimestamp - accepts valid ISO timestamp', () => {
  validateTimestamp(new Date().toISOString());
});

test('validateTimestamp - rejects invalid timestamp', () => {
  try {
    validateTimestamp('not-a-date');
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('valid ISO date')) throw err;
  }
});

test('validateTimestamp - rejects future timestamp (more than 1 min)', () => {
  const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours in future
  try {
    validateTimestamp(future);
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('future')) throw err;
  }
});

// Test validateRange
test('validateRange - accepts value in range', () => {
  validateRange(50, 0, 100);
});

test('validateRange - accepts boundary values', () => {
  validateRange(0, 0, 100);
  validateRange(100, 0, 100);
});

test('validateRange - rejects value below range', () => {
  try {
    validateRange(-1, 0, 100);
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('between')) throw err;
  }
});

test('validateRange - rejects value above range', () => {
  try {
    validateRange(101, 0, 100);
    throw new Error('Should have thrown');
  } catch (err) {
    if (!err.message.includes('between')) throw err;
  }
});

// Summary
console.log(`\n=== Results ===`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`Total: ${testsPassed + testsFailed}`);

if (testsFailed === 0) {
  console.log('\n✅ All validation helper tests passed!');
  process.exit(0);
} else {
  console.log(`\n❌ ${testsFailed} test(s) failed`);
  process.exit(1);
}
