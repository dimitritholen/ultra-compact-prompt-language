/**
 * Test validation utilities
 * Extracted from test-real-compressions.test.mjs for reusability
 */

const assert = require('node:assert/strict');
const path = require('node:path');

/**
 * Validate compression record has required fields
 * @param {object} record - The compression record to validate
 * @param {string} context - Context string for error messages (default: 'record')
 */
function validateCompressionRecordStructure(record, context = 'record') {
  const requiredFields = [
    'timestamp', 'path', 'originalTokens', 'compressedTokens',
    'tokensSaved', 'compressionRatio', 'savingsPercentage', 'level', 'format'
  ];

  for (const field of requiredFields) {
    assert.ok(
      field in record,
      `${context}: missing required field "${field}"`
    );
  }
}

/**
 * Validate token counts are correct
 * @param {object} record - The compression record to validate
 * @param {string} context - Context string for error messages
 */
function validateTokenCounts(record, context = 'record') {
  assert.ok(record.originalTokens > 0, `${context}: originalTokens must be positive`);
  assert.ok(record.compressedTokens > 0, `${context}: compressedTokens must be positive`);

  const expectedSaved = record.originalTokens - record.compressedTokens;
  assert.strictEqual(
    record.tokensSaved,
    expectedSaved,
    `${context}: tokensSaved mismatch (expected ${expectedSaved}, got ${record.tokensSaved})`
  );
}

/**
 * Validate compression ratio is correct
 * @param {object} record - The compression record to validate
 * @param {string} context - Context string for error messages
 */
function validateCompressionRatio(record, context = 'record') {
  const expectedRatio = record.compressedTokens / record.originalTokens;
  const ratioDiff = Math.abs(record.compressionRatio - expectedRatio);

  assert.ok(
    ratioDiff < 0.01,
    `${context}: compression ratio error (expected ${expectedRatio.toFixed(3)}, got ${record.compressionRatio})`
  );
}

/**
 * Validate timestamp is recent
 * @param {object} record - The compression record to validate
 * @param {number} maxAgeSeconds - Maximum age in seconds (default: 60)
 * @param {string} context - Context string for error messages
 */
function validateTimestamp(record, maxAgeSeconds = 60, context = 'record') {
  try {
    const timestamp = new Date(record.timestamp);
    const now = new Date();
    const ageSeconds = (now - timestamp) / 1000;

    assert.ok(
      ageSeconds >= 0 && ageSeconds <= maxAgeSeconds,
      `${context}: timestamp out of range (age: ${ageSeconds}s, max: ${maxAgeSeconds}s)`
    );
  } catch (e) {
    throw new Error(`${context}: invalid timestamp format: ${record.timestamp}`);
  }
}

/**
 * Validate path matches expected
 * @param {object} record - The compression record to validate
 * @param {string} expectedPath - Expected path or basename
 * @param {string} context - Context string for error messages
 */
function validatePath(record, expectedPath, context = 'record') {
  const recordPath = path.normalize(record.path);
  const expectedBasename = path.basename(path.normalize(expectedPath));

  assert.ok(
    recordPath.includes(expectedBasename),
    `${context}: path mismatch (expected ${expectedBasename}, got ${recordPath})`
  );
}

/**
 * Complete validation of compression record
 * @param {object} record - The compression record to validate
 * @param {string} expectedPath - Expected file path
 * @param {string} expectedLevel - Expected compression level
 * @param {object} options - Validation options
 * @param {number} options.maxAgeSeconds - Maximum timestamp age (default: 60, or 300 on CI)
 * @param {string} options.context - Context string for error messages
 */
function validateCompressionRecord(record, expectedPath, expectedLevel, options = {}) {
  // CI-aware timeout: 5 minutes on CI, 1 minute locally
  const defaultMaxAge = process.env.CI ? 300 : 60;
  const { maxAgeSeconds = defaultMaxAge, context = 'record' } = options;

  validateCompressionRecordStructure(record, context);
  validateTokenCounts(record, context);
  validateCompressionRatio(record, context);
  validateTimestamp(record, maxAgeSeconds, context);
  validatePath(record, expectedPath, context);

  assert.strictEqual(record.level, expectedLevel, `${context}: level mismatch`);
}

/**
 * Validate compression record and return errors (non-throwing version)
 * @param {object} record - The compression record to validate
 * @param {string} expectedPath - Expected file path
 * @param {string} expectedLevel - Expected compression level
 * @param {object} options - Validation options
 * @returns {object} { success: boolean, errors: string[] }
 */
function validateCompressionRecordSafe(record, expectedPath, expectedLevel, options = {}) {
  const errors = [];
  const defaultMaxAge = process.env.CI ? 300 : 60;
  const { maxAgeSeconds = defaultMaxAge, context = 'record' } = options;

  // Structure validation
  const requiredFields = ['timestamp', 'path', 'originalTokens', 'compressedTokens',
                          'tokensSaved', 'compressionRatio', 'savingsPercentage', 'level', 'format'];
  for (const field of requiredFields) {
    if (!(field in record)) {
      errors.push(`${context}: missing required field "${field}"`);
    }
  }

  // Token counts validation
  if (record.originalTokens <= 0) {
    errors.push(`${context}: originalTokens must be positive`);
  }
  if (record.compressedTokens <= 0) {
    errors.push(`${context}: compressedTokens must be positive`);
  }
  const expectedSaved = record.originalTokens - record.compressedTokens;
  if (record.tokensSaved !== expectedSaved) {
    errors.push(`${context}: tokensSaved mismatch (expected ${expectedSaved}, got ${record.tokensSaved})`);
  }

  // Compression ratio validation
  const expectedRatio = record.compressedTokens / record.originalTokens;
  const ratioDiff = Math.abs(record.compressionRatio - expectedRatio);
  if (ratioDiff > 0.01) {
    errors.push(`${context}: compression ratio error (expected ${expectedRatio.toFixed(3)}, got ${record.compressionRatio})`);
  }

  // Timestamp validation
  try {
    const timestamp = new Date(record.timestamp);
    const now = new Date();
    const ageSeconds = (now - timestamp) / 1000;
    if (ageSeconds < 0 || ageSeconds > maxAgeSeconds) {
      errors.push(`${context}: timestamp out of range (age: ${ageSeconds}s, max: ${maxAgeSeconds}s)`);
    }
  } catch (e) {
    errors.push(`${context}: invalid timestamp format: ${record.timestamp}`);
  }

  // Path validation
  const recordPath = path.normalize(record.path);
  const expectedBasename = path.basename(path.normalize(expectedPath));
  if (!recordPath.includes(expectedBasename)) {
    errors.push(`${context}: path mismatch (expected ${expectedBasename}, got ${recordPath})`);
  }

  // Level validation
  if (record.level !== expectedLevel) {
    errors.push(`${context}: level mismatch (expected ${expectedLevel}, got ${record.level})`);
  }

  return {
    success: errors.length === 0,
    errors
  };
}

module.exports = {
  validateCompressionRecordStructure,
  validateTokenCounts,
  validateCompressionRatio,
  validateTimestamp,
  validatePath,
  validateCompressionRecord,
  validateCompressionRecordSafe
};
