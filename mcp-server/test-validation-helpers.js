/**
 * Validation helper functions for comprehensive data integrity testing
 *
 * This module provides reusable validation functions for:
 * - Compression records
 * - Statistics files
 * - Summary objects
 * - Field types and ranges
 */

const assert = require('assert');

/**
 * Validate a compression record has all required fields with correct types
 * @param {object} record - Compression record to validate
 * @param {string} context - Context for error messages (e.g., "compression record #1")
 */
function validateCompressionRecord(record, context = 'compression record') {
  // Required fields for all records
  assert.ok(record, `${context} must exist`);
  assert.strictEqual(typeof record, 'object', `${context} must be an object`);

  // timestamp - required, must be valid ISO date string
  assert.ok(record.timestamp, `${context}: timestamp is required`);
  assert.strictEqual(typeof record.timestamp, 'string', `${context}: timestamp must be a string`);
  const timestamp = new Date(record.timestamp);
  assert.ok(!isNaN(timestamp.getTime()), `${context}: timestamp must be a valid ISO date string`);

  // path - required, non-empty string
  assert.ok(record.path, `${context}: path is required`);
  assert.strictEqual(typeof record.path, 'string', `${context}: path must be a string`);
  assert.ok(record.path.length > 0, `${context}: path must not be empty`);

  // Token counts - required, must be non-negative integers
  assert.ok(typeof record.originalTokens === 'number', `${context}: originalTokens must be a number`);
  assert.ok(record.originalTokens >= 0, `${context}: originalTokens must be non-negative, got ${record.originalTokens}`);
  assert.ok(Number.isInteger(record.originalTokens), `${context}: originalTokens must be an integer`);

  assert.ok(typeof record.compressedTokens === 'number', `${context}: compressedTokens must be a number`);
  assert.ok(record.compressedTokens >= 0, `${context}: compressedTokens must be non-negative, got ${record.compressedTokens}`);
  assert.ok(Number.isInteger(record.compressedTokens), `${context}: compressedTokens must be an integer`);

  assert.ok(typeof record.tokensSaved === 'number', `${context}: tokensSaved must be a number`);
  assert.ok(record.tokensSaved >= 0, `${context}: tokensSaved must be non-negative, got ${record.tokensSaved}`);
  assert.ok(Number.isInteger(record.tokensSaved), `${context}: tokensSaved must be an integer`);

  // Verify token math: tokensSaved = originalTokens - compressedTokens
  const expectedTokensSaved = record.originalTokens - record.compressedTokens;
  assert.strictEqual(
    record.tokensSaved,
    expectedTokensSaved,
    `${context}: tokensSaved (${record.tokensSaved}) must equal originalTokens - compressedTokens (${expectedTokensSaved})`
  );

  // compressionRatio - required, must be between 0 and 1 (or slightly > 1 for edge cases)
  assert.ok(typeof record.compressionRatio === 'number', `${context}: compressionRatio must be a number`);
  assert.ok(
    record.compressionRatio >= 0 && record.compressionRatio <= 1.1,
    `${context}: compressionRatio must be between 0 and 1.1, got ${record.compressionRatio}`
  );

  // Verify compression ratio calculation (with tolerance for rounding)
  if (record.originalTokens > 0) {
    const expectedRatio = record.compressedTokens / record.originalTokens;
    const ratioTolerance = 0.001;
    assert.ok(
      Math.abs(record.compressionRatio - expectedRatio) < ratioTolerance,
      `${context}: compressionRatio (${record.compressionRatio}) must match compressedTokens/originalTokens (${expectedRatio.toFixed(3)})`
    );
  }

  // savingsPercentage - required, must be between 0 and 100
  assert.ok(typeof record.savingsPercentage === 'number', `${context}: savingsPercentage must be a number`);
  assert.ok(
    record.savingsPercentage >= 0 && record.savingsPercentage <= 100,
    `${context}: savingsPercentage must be between 0 and 100, got ${record.savingsPercentage}`
  );

  // Verify savings percentage calculation (with tolerance for rounding)
  if (record.originalTokens > 0) {
    const expectedPercentage = (record.tokensSaved / record.originalTokens) * 100;
    const percentageTolerance = 0.2; // Allow 0.2% tolerance for rounding
    assert.ok(
      Math.abs(record.savingsPercentage - expectedPercentage) < percentageTolerance,
      `${context}: savingsPercentage (${record.savingsPercentage}%) must match (tokensSaved/originalTokens)*100 (${expectedPercentage.toFixed(1)}%)`
    );
  }

  // level - required, must be one of: full, signatures, minimal
  assert.ok(record.level, `${context}: level is required`);
  assert.strictEqual(typeof record.level, 'string', `${context}: level must be a string`);
  const validLevels = ['full', 'signatures', 'minimal'];
  assert.ok(
    validLevels.includes(record.level),
    `${context}: level must be one of [${validLevels.join(', ')}], got '${record.level}'`
  );

  // format - required, must be one of: text, summary, json
  assert.ok(record.format, `${context}: format is required`);
  assert.strictEqual(typeof record.format, 'string', `${context}: format must be a string`);
  const validFormats = ['text', 'summary', 'json'];
  assert.ok(
    validFormats.includes(record.format),
    `${context}: format must be one of [${validFormats.join(', ')}], got '${record.format}'`
  );

  // Optional fields validation

  // estimated - optional boolean flag
  if (record.estimated !== undefined) {
    assert.strictEqual(typeof record.estimated, 'boolean', `${context}: estimated must be a boolean if present`);
  }

  // Cost tracking fields - all optional but must be valid if present
  if (record.model !== undefined) {
    assert.strictEqual(typeof record.model, 'string', `${context}: model must be a string if present`);
    assert.ok(record.model.length > 0, `${context}: model must not be empty if present`);
  }

  if (record.client !== undefined) {
    assert.strictEqual(typeof record.client, 'string', `${context}: client must be a string if present`);
    assert.ok(record.client.length > 0, `${context}: client must not be empty if present`);
  }

  if (record.pricePerMTok !== undefined) {
    assert.strictEqual(typeof record.pricePerMTok, 'number', `${context}: pricePerMTok must be a number if present`);
    assert.ok(record.pricePerMTok >= 0, `${context}: pricePerMTok must be non-negative if present`);
  }

  if (record.costSavingsUSD !== undefined) {
    assert.strictEqual(typeof record.costSavingsUSD, 'number', `${context}: costSavingsUSD must be a number if present`);
    assert.ok(record.costSavingsUSD >= 0, `${context}: costSavingsUSD must be non-negative if present`);
  }

  if (record.currency !== undefined) {
    assert.strictEqual(typeof record.currency, 'string', `${context}: currency must be a string if present`);
    assert.strictEqual(record.currency, 'USD', `${context}: currency must be 'USD' if present`);
  }

  // If any cost field is present, validate consistency
  const hasCostFields = record.model || record.pricePerMTok !== undefined || record.costSavingsUSD !== undefined;
  if (hasCostFields) {
    assert.ok(record.model, `${context}: model is required when cost fields are present`);
    assert.ok(record.pricePerMTok !== undefined, `${context}: pricePerMTok is required when cost fields are present`);
    assert.ok(record.costSavingsUSD !== undefined, `${context}: costSavingsUSD is required when cost fields are present`);

    // Validate cost calculation
    const expectedCost = (record.tokensSaved / 1_000_000) * record.pricePerMTok;
    const costTolerance = 0.000001; // Very small tolerance for floating point
    assert.ok(
      Math.abs(record.costSavingsUSD - expectedCost) < costTolerance,
      `${context}: costSavingsUSD (${record.costSavingsUSD}) must match (tokensSaved/1M)*pricePerMTok (${expectedCost.toFixed(6)})`
    );
  }
}

/**
 * Validate statistics summary object
 * @param {object} summary - Summary object to validate
 * @param {string} context - Context for error messages
 */
function validateStatsSummary(summary, context = 'stats summary') {
  assert.ok(summary, `${context} must exist`);
  assert.strictEqual(typeof summary, 'object', `${context} must be an object`);

  // All fields are required and must be non-negative integers
  const requiredFields = [
    'totalCompressions',
    'totalOriginalTokens',
    'totalCompressedTokens',
    'totalTokensSaved'
  ];

  for (const field of requiredFields) {
    assert.ok(
      typeof summary[field] === 'number',
      `${context}: ${field} must be a number`
    );
    assert.ok(
      summary[field] >= 0,
      `${context}: ${field} must be non-negative, got ${summary[field]}`
    );
    assert.ok(
      Number.isInteger(summary[field]),
      `${context}: ${field} must be an integer, got ${summary[field]}`
    );
  }

  // Verify summary math
  const expectedTokensSaved = summary.totalOriginalTokens - summary.totalCompressedTokens;
  assert.strictEqual(
    summary.totalTokensSaved,
    expectedTokensSaved,
    `${context}: totalTokensSaved (${summary.totalTokensSaved}) must equal totalOriginalTokens - totalCompressedTokens (${expectedTokensSaved})`
  );
}

/**
 * Validate complete statistics file structure
 * @param {object} stats - Complete stats object to validate
 * @param {object} options - Validation options
 * @param {boolean} options.requireRecords - Require at least one compression record (default: false)
 */
function validateStatsFile(stats, options = {}) {
  const { requireRecords = false } = options;

  assert.ok(stats, 'Stats file must exist');
  assert.strictEqual(typeof stats, 'object', 'Stats file must be an object');

  // Validate summary
  assert.ok(stats.summary, 'Stats file must have a summary object');
  validateStatsSummary(stats.summary, 'Stats file summary');

  // Validate recent compressions array
  assert.ok(stats.recent !== undefined, 'Stats file must have a recent array');
  assert.ok(Array.isArray(stats.recent), 'Stats file recent must be an array');

  if (requireRecords) {
    assert.ok(
      stats.recent.length > 0,
      'Stats file must have at least one compression record when requireRecords=true'
    );
  }

  // Validate each compression record
  stats.recent.forEach((record, index) => {
    validateCompressionRecord(record, `Stats file recent[${index}]`);
  });

  // Validate summary matches recent compressions
  if (stats.recent.length > 0) {
    const calculatedSummary = stats.recent.reduce(
      (acc, record) => ({
        totalCompressions: acc.totalCompressions + 1,
        totalOriginalTokens: acc.totalOriginalTokens + record.originalTokens,
        totalCompressedTokens: acc.totalCompressedTokens + record.compressedTokens,
        totalTokensSaved: acc.totalTokensSaved + record.tokensSaved
      }),
      {
        totalCompressions: 0,
        totalOriginalTokens: 0,
        totalCompressedTokens: 0,
        totalTokensSaved: 0
      }
    );

    // Note: We only validate that summary is >= recent totals because
    // summary may include aggregated data from daily/monthly stats
    assert.ok(
      stats.summary.totalCompressions >= calculatedSummary.totalCompressions,
      `Summary totalCompressions (${stats.summary.totalCompressions}) must be >= recent count (${calculatedSummary.totalCompressions})`
    );
  }

  // Validate optional aggregation structures if present
  if (stats.daily !== undefined) {
    assert.strictEqual(typeof stats.daily, 'object', 'Stats file daily must be an object if present');
  }

  if (stats.monthly !== undefined) {
    assert.strictEqual(typeof stats.monthly, 'object', 'Stats file monthly must be an object if present');
  }
}

/**
 * Validate that a value is a valid timestamp string
 * @param {string} value - Value to validate
 * @param {string} fieldName - Field name for error messages
 */
function validateTimestamp(value, fieldName = 'timestamp') {
  assert.strictEqual(typeof value, 'string', `${fieldName} must be a string`);
  const date = new Date(value);
  assert.ok(!isNaN(date.getTime()), `${fieldName} must be a valid ISO date string, got '${value}'`);

  // Validate it's recent (within last 10 years and not in future)
  const now = Date.now();
  const tenYearsAgo = now - (10 * 365 * 24 * 60 * 60 * 1000);
  const timestamp = date.getTime();

  assert.ok(
    timestamp >= tenYearsAgo,
    `${fieldName} is too old (${value}), must be within last 10 years`
  );
  assert.ok(
    timestamp <= now + 60000, // Allow 1 minute in future for clock skew
    `${fieldName} is in the future (${value})`
  );
}

/**
 * Validate a range of values
 * @param {number} value - Value to validate
 * @param {number} min - Minimum allowed value (inclusive)
 * @param {number} max - Maximum allowed value (inclusive)
 * @param {string} fieldName - Field name for error messages
 */
function validateRange(value, min, max, fieldName = 'value') {
  assert.strictEqual(typeof value, 'number', `${fieldName} must be a number`);
  assert.ok(
    value >= min && value <= max,
    `${fieldName} must be between ${min} and ${max}, got ${value}`
  );
}

module.exports = {
  validateCompressionRecord,
  validateStatsSummary,
  validateStatsFile,
  validateTimestamp,
  validateRange
};
