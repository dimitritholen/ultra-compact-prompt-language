/**
 * Test validation utilities for compression records
 *
 * Provides reusable validation functions for compression statistics records,
 * extracted from test-real-compressions.test.mjs for shared use across tests.
 *
 * All validation functions throw AssertionError on validation failure.
 *
 * @module test-utils/validators
 */

const assert = require("node:assert/strict");
const path = require("node:path");

/**
 * Validate compression record has all required fields
 *
 * Checks that the record object contains all mandatory fields expected
 * in a compression statistics record.
 *
 * @param {Object} record - The compression record to validate
 * @param {string} [context='record'] - Context string for error messages
 * @throws {AssertionError} When any required field is missing
 * @example
 * validateCompressionRecordStructure(record, 'stats.recent[0]');
 */
function validateCompressionRecordStructure(record, context = "record") {
  const requiredFields = [
    "timestamp",
    "path",
    "originalTokens",
    "compressedTokens",
    "tokensSaved",
    "compressionRatio",
    "savingsPercentage",
    "level",
    "format",
  ];

  for (const field of requiredFields) {
    assert.ok(field in record, `${context}: missing required field "${field}"`);
  }
}

/**
 * Validate token counts are correct and consistent
 *
 * Verifies that originalTokens and compressedTokens are positive, and
 * that tokensSaved equals originalTokens - compressedTokens.
 *
 * @param {Object} record - The compression record to validate
 * @param {string} [context='record'] - Context string for error messages
 * @throws {AssertionError} When token counts are invalid or inconsistent
 * @example
 * validateTokenCounts(record, 'compression #1');
 */
function validateTokenCounts(record, context = "record") {
  assert.ok(
    record.originalTokens > 0,
    `${context}: originalTokens must be positive`,
  );
  assert.ok(
    record.compressedTokens > 0,
    `${context}: compressedTokens must be positive`,
  );

  const expectedSaved = record.originalTokens - record.compressedTokens;
  assert.strictEqual(
    record.tokensSaved,
    expectedSaved,
    `${context}: tokensSaved mismatch (expected ${expectedSaved}, got ${record.tokensSaved})`,
  );
}

/**
 * Validate compression ratio is correct
 *
 * Verifies that compressionRatio equals compressedTokens / originalTokens
 * within a tolerance of 0.01 (1%).
 *
 * @param {Object} record - The compression record to validate
 * @param {string} [context='record'] - Context string for error messages
 * @throws {AssertionError} When compression ratio is incorrect
 * @example
 * validateCompressionRatio(record, 'stats.recent[0]');
 */
function validateCompressionRatio(record, context = "record") {
  const expectedRatio = record.compressedTokens / record.originalTokens;
  const ratioDiff = Math.abs(record.compressionRatio - expectedRatio);

  assert.ok(
    ratioDiff < 0.01,
    `${context}: compression ratio error (expected ${expectedRatio.toFixed(3)}, got ${record.compressionRatio})`,
  );
}

/**
 * Validate timestamp is recent and properly formatted
 *
 * Checks that the timestamp is a valid ISO date string and falls within
 * an acceptable time range (not too old, not in the future). CI-aware:
 * uses longer timeout on CI environments.
 *
 * @param {Object} record - The compression record to validate
 * @param {number} [maxAgeSeconds=60] - Maximum age in seconds (300 on CI)
 * @param {string} [context='record'] - Context string for error messages
 * @throws {Error} When timestamp format is invalid
 * @throws {AssertionError} When timestamp is out of acceptable range
 * @example
 * // Default 60-second tolerance
 * validateTimestamp(record);
 *
 * @example
 * // Custom 5-minute tolerance
 * validateTimestamp(record, 300, 'recent compression');
 */
function validateTimestamp(record, maxAgeSeconds = 60, context = "record") {
  try {
    const timestamp = new Date(record.timestamp);
    const now = new Date();
    const ageSeconds = (now - timestamp) / 1000;

    assert.ok(
      ageSeconds >= 0 && ageSeconds <= maxAgeSeconds,
      `${context}: timestamp out of range (age: ${ageSeconds}s, max: ${maxAgeSeconds}s)`,
    );
  } catch (e) {
    throw new Error(
      `${context}: invalid timestamp format: ${record.timestamp}`,
    );
  }
}

/**
 * Validate path matches expected file
 *
 * Checks that the record's path contains the expected basename, handling
 * cross-platform path separators via path.normalize().
 *
 * @param {Object} record - The compression record to validate
 * @param {string} expectedPath - Expected path or basename to match
 * @param {string} [context='record'] - Context string for error messages
 * @throws {AssertionError} When path does not match expected basename
 * @example
 * validatePath(record, './src/index.js', 'compression #1');
 * // Verifies record.path contains 'index.js'
 */
function validatePath(record, expectedPath, context = "record") {
  const recordPath = path.normalize(record.path);
  const expectedBasename = path.basename(path.normalize(expectedPath));

  assert.ok(
    recordPath.includes(expectedBasename),
    `${context}: path mismatch (expected ${expectedBasename}, got ${recordPath})`,
  );
}

/**
 * Complete validation of a compression record
 *
 * Runs all validation checks (structure, token counts, compression ratio,
 * timestamp, path, and level) in a single function call. CI-aware timeout
 * handling (5 minutes on CI, 1 minute locally).
 *
 * @param {Object} record - The compression record to validate
 * @param {string} expectedPath - Expected file path or basename
 * @param {string} expectedLevel - Expected compression level ('full', 'signatures', or 'minimal')
 * @param {Object} [options] - Validation options
 * @param {number} [options.maxAgeSeconds] - Maximum timestamp age (default: 60 local, 300 on CI)
 * @param {string} [options.context='record'] - Context string for error messages
 * @throws {AssertionError} When any validation check fails
 * @example
 * // Validate a compression record with defaults
 * validateCompressionRecord(
 *   stats.recent[0],
 *   './src/index.js',
 *   'full'
 * );
 *
 * @example
 * // With custom options
 * validateCompressionRecord(
 *   record,
 *   './src/utils.js',
 *   'signatures',
 *   { maxAgeSeconds: 120, context: 'second compression' }
 * );
 */
function validateCompressionRecord(
  record,
  expectedPath,
  expectedLevel,
  options = {},
) {
  // CI-aware timeout: 5 minutes on CI, 1 minute locally
  const defaultMaxAge = process.env.CI ? 300 : 60;
  const { maxAgeSeconds = defaultMaxAge, context = "record" } = options;

  validateCompressionRecordStructure(record, context);
  validateTokenCounts(record, context);
  validateCompressionRatio(record, context);
  validateTimestamp(record, maxAgeSeconds, context);
  validatePath(record, expectedPath, context);

  assert.strictEqual(record.level, expectedLevel, `${context}: level mismatch`);
}

/**
 * Validate compression record and return errors (non-throwing version)
 *
 * Performs the same validation as validateCompressionRecord() but returns
 * errors instead of throwing. Useful when you want to collect multiple
 * validation errors or display them in a custom format.
 *
 * @param {Object} record - The compression record to validate
 * @param {string} expectedPath - Expected file path or basename
 * @param {string} expectedLevel - Expected compression level ('full', 'signatures', or 'minimal')
 * @param {Object} [options] - Validation options
 * @param {number} [options.maxAgeSeconds] - Maximum timestamp age (default: 60 local, 300 on CI)
 * @param {string} [options.context='record'] - Context string for error messages
 * @returns {{success: boolean, errors: string[]}} Validation result object
 * @returns {boolean} return.success - True if all validations passed, false otherwise
 * @returns {string[]} return.errors - Array of error messages (empty if success=true)
 * @example
 * // Non-throwing validation
 * const { success, errors } = validateCompressionRecordSafe(
 *   record,
 *   './src/index.js',
 *   'full'
 * );
 *
 * if (!success) {
 *   console.error('Validation errors:', errors);
 * }
 *
 * @example
 * // Collect errors from multiple records
 * const allErrors = records.map((r, i) => {
 *   const { success, errors } = validateCompressionRecordSafe(r, paths[i], 'full');
 *   return { recordIndex: i, success, errors };
 * });
 */
function validateCompressionRecordSafe(
  record,
  expectedPath,
  expectedLevel,
  options = {},
) {
  const errors = [];
  const defaultMaxAge = process.env.CI ? 300 : 60;
  const { maxAgeSeconds = defaultMaxAge, context = "record" } = options;

  // Structure validation
  const requiredFields = [
    "timestamp",
    "path",
    "originalTokens",
    "compressedTokens",
    "tokensSaved",
    "compressionRatio",
    "savingsPercentage",
    "level",
    "format",
  ];
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
    errors.push(
      `${context}: tokensSaved mismatch (expected ${expectedSaved}, got ${record.tokensSaved})`,
    );
  }

  // Compression ratio validation
  const expectedRatio = record.compressedTokens / record.originalTokens;
  const ratioDiff = Math.abs(record.compressionRatio - expectedRatio);
  if (ratioDiff > 0.01) {
    errors.push(
      `${context}: compression ratio error (expected ${expectedRatio.toFixed(3)}, got ${record.compressionRatio})`,
    );
  }

  // Timestamp validation
  try {
    const timestamp = new Date(record.timestamp);
    const now = new Date();
    const ageSeconds = (now - timestamp) / 1000;
    if (ageSeconds < 0 || ageSeconds > maxAgeSeconds) {
      errors.push(
        `${context}: timestamp out of range (age: ${ageSeconds}s, max: ${maxAgeSeconds}s)`,
      );
    }
  } catch (e) {
    errors.push(`${context}: invalid timestamp format: ${record.timestamp}`);
  }

  // Path validation
  const recordPath = path.normalize(record.path);
  const expectedBasename = path.basename(path.normalize(expectedPath));
  if (!recordPath.includes(expectedBasename)) {
    errors.push(
      `${context}: path mismatch (expected ${expectedBasename}, got ${recordPath})`,
    );
  }

  // Level validation
  if (record.level !== expectedLevel) {
    errors.push(
      `${context}: level mismatch (expected ${expectedLevel}, got ${record.level})`,
    );
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

module.exports = {
  validateCompressionRecordStructure,
  validateTokenCounts,
  validateCompressionRatio,
  validateTimestamp,
  validatePath,
  validateCompressionRecord,
  validateCompressionRecordSafe,
};
