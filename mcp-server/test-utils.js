/**
 * Test Utilities - Reusable Testing Helpers
 *
 * Provides utility functions for common testing patterns, including
 * floating-point comparison with configurable epsilon tolerance.
 *
 * @module test-utils
 */

const assert = require('assert');

const DEFAULT_EPSILON = 0.0001;

/**
 * Assert that two floating-point numbers are approximately equal within a tolerance (epsilon).
 *
 * This function is designed for comparing monetary values, percentages, and other
 * floating-point calculations where exact equality is unreliable due to
 * floating-point arithmetic precision limitations.
 *
 * @param {number} actual - The actual value to compare
 * @param {number} expected - The expected value to compare against
 * @param {number} [epsilon=0.0001] - Maximum allowed difference (default: 4 decimal places)
 * @param {string} [message] - Optional custom error message
 * @throws {TypeError} If actual or expected are not numbers, or epsilon is invalid
 * @throws {AssertionError} If values differ by more than epsilon
 *
 * @example
 * // Basic usage with default epsilon (0.0001)
 * assertAlmostEqual(0.1 + 0.2, 0.3); // Passes (handles floating-point imprecision)
 *
 * @example
 * // Monetary comparison
 * const totalCost = 0.0021 + 0.0045 + 0.01;
 * assertAlmostEqual(totalCost, 0.0166); // Passes within 4 decimal places
 *
 * @example
 * // Custom epsilon for 2 decimal places
 * assertAlmostEqual(1.234, 1.236, 0.01); // Passes
 * assertAlmostEqual(1.234, 1.239, 0.01); // Fails - difference is 0.005
 *
 * @example
 * // Custom error message
 * assertAlmostEqual(
 *   actualSavings,
 *   0.0166,
 *   0.0001,
 *   'Total cost savings calculation incorrect'
 * );
 */
function assertAlmostEqual(actual, expected, epsilon = DEFAULT_EPSILON, message) {
  // Input validation
  if (typeof actual !== 'number') {
    throw new TypeError(`actual must be a number, got ${typeof actual}`);
  }
  if (typeof expected !== 'number') {
    throw new TypeError(`expected must be a number, got ${typeof expected}`);
  }
  if (typeof epsilon !== 'number' || epsilon <= 0) {
    throw new TypeError('epsilon must be a positive number');
  }

  // Handle NaN explicitly
  if (Number.isNaN(actual) && Number.isNaN(expected)) {
    return; // Both NaN is considered equal
  }
  if (Number.isNaN(actual) || Number.isNaN(expected)) {
    const errorMessage = message ||
      `Expected ${expected}, got ${actual} (one value is NaN)`;
    throw new assert.AssertionError({
      message: errorMessage,
      actual: actual,
      expected: expected,
      operator: 'assertAlmostEqual'
    });
  }

  // Handle Infinity explicitly
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
    if (actual === expected) {
      return; // Both same infinity
    }
    const errorMessage = message ||
      `Expected ${expected}, got ${actual} (values are infinite)`;
    throw new assert.AssertionError({
      message: errorMessage,
      actual: actual,
      expected: expected,
      operator: 'assertAlmostEqual'
    });
  }

  // Calculate absolute difference
  const difference = Math.abs(actual - expected);

  // Compare against epsilon
  if (difference > epsilon) {
    const errorMessage = message ||
      `Expected ${actual} to be within ${epsilon} of ${expected}, but difference was ${difference}`;
    throw new assert.AssertionError({
      message: errorMessage,
      actual: actual,
      expected: expected,
      operator: 'assertAlmostEqual'
    });
  }
}

module.exports = {
  assertAlmostEqual,
  DEFAULT_EPSILON
};
