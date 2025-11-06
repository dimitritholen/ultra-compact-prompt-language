#!/usr/bin/env node
/**
 * Test Utilities Test Suite
 *
 * Comprehensive tests for test-utils.js, specifically the assertAlmostEqual()
 * floating-point comparison utility.
 *
 * Tests cover:
 * 1. Happy path - values within epsilon tolerance
 * 2. Error path - values outside epsilon tolerance
 * 3. Edge cases - NaN, Infinity, negative numbers, zero
 * 4. Boundary conditions - exact equality, epsilon boundaries
 * 5. Input validation - type checking, invalid epsilon
 */

const assert = require('assert');
const { test } = require('node:test');
const { assertAlmostEqual, DEFAULT_EPSILON } = require('./test-utils');

test('assertAlmostEqual - Happy Path Tests', async (t) => {
  await t.test('should pass when values are exactly equal', () => {
    assert.doesNotThrow(() => {
      assertAlmostEqual(1.0, 1.0);
    });
  });

  await t.test('should pass when difference is less than default epsilon', () => {
    assert.doesNotThrow(() => {
      assertAlmostEqual(0.0001, 0.00011); // difference: 0.00001
    });
  });

  await t.test('should pass for floating-point addition (0.1 + 0.2)', () => {
    assert.doesNotThrow(() => {
      assertAlmostEqual(0.1 + 0.2, 0.3);
    });
  });

  await t.test('should pass for monetary values with default epsilon', () => {
    const total = 0.0021 + 0.0045 + 0.01;
    assert.doesNotThrow(() => {
      assertAlmostEqual(total, 0.0166);
    });
  });

  await t.test('should pass with custom epsilon', () => {
    assert.doesNotThrow(() => {
      assertAlmostEqual(1.234, 1.236, 0.01); // difference: 0.002
    });
  });

  await t.test('should pass for negative numbers within epsilon', () => {
    assert.doesNotThrow(() => {
      assertAlmostEqual(-0.0021, -0.002099);
    });
  });

  await t.test('should pass for zero comparison', () => {
    assert.doesNotThrow(() => {
      assertAlmostEqual(0, 0.00001);
    });
  });

  await t.test('should pass for large numbers within epsilon', () => {
    assert.doesNotThrow(() => {
      assertAlmostEqual(1000000.0001, 1000000.0002, 0.001);
    });
  });
});

test('assertAlmostEqual - Error Path Tests', async (t) => {
  await t.test('should throw when difference exceeds default epsilon', () => {
    assert.throws(
      () => assertAlmostEqual(0.0001, 0.0003),
      {
        name: 'AssertionError',
        message: /Expected 0.0001 to be within 0.0001 of 0.0003/
      }
    );
  });

  await t.test('should throw when difference exceeds custom epsilon', () => {
    assert.throws(
      () => assertAlmostEqual(1.234, 1.239, 0.001),
      {
        name: 'AssertionError',
        message: /difference was 0.005/
      }
    );
  });

  await t.test('should throw with custom error message', () => {
    assert.throws(
      () => assertAlmostEqual(1.0, 2.0, 0.5, 'Custom error message'),
      {
        name: 'AssertionError',
        message: /Custom error message/
      }
    );
  });

  await t.test('should show actual, expected, and difference in error', () => {
    try {
      assertAlmostEqual(0.5, 1.0);
      assert.fail('Expected assertion to throw');
    } catch (error) {
      assert.strictEqual(error.actual, 0.5);
      assert.strictEqual(error.expected, 1.0);
      assert.ok(error.message.includes('0.5'));
      assert.ok(error.message.includes('1'));
      assert.ok(error.message.includes('difference'));
    }
  });
});

test('assertAlmostEqual - NaN Handling', async (t) => {
  await t.test('should pass when both values are NaN', () => {
    assert.doesNotThrow(() => {
      assertAlmostEqual(NaN, NaN);
    });
  });

  await t.test('should throw when only actual is NaN', () => {
    assert.throws(
      () => assertAlmostEqual(NaN, 1.0),
      {
        name: 'AssertionError',
        message: /one value is NaN/
      }
    );
  });

  await t.test('should throw when only expected is NaN', () => {
    assert.throws(
      () => assertAlmostEqual(1.0, NaN),
      {
        name: 'AssertionError',
        message: /one value is NaN/
      }
    );
  });
});

test('assertAlmostEqual - Infinity Handling', async (t) => {
  await t.test('should pass when both values are positive Infinity', () => {
    assert.doesNotThrow(() => {
      assertAlmostEqual(Infinity, Infinity);
    });
  });

  await t.test('should pass when both values are negative Infinity', () => {
    assert.doesNotThrow(() => {
      assertAlmostEqual(-Infinity, -Infinity);
    });
  });

  await t.test('should throw when comparing positive and negative Infinity', () => {
    assert.throws(
      () => assertAlmostEqual(Infinity, -Infinity),
      {
        name: 'AssertionError',
        message: /values are infinite/
      }
    );
  });

  await t.test('should throw when comparing finite to Infinity', () => {
    assert.throws(
      () => assertAlmostEqual(1000, Infinity),
      {
        name: 'AssertionError',
        message: /values are infinite/
      }
    );
  });
});

test('assertAlmostEqual - Negative Number Handling', async (t) => {
  await t.test('should handle negative numbers correctly', () => {
    assert.doesNotThrow(() => {
      assertAlmostEqual(-0.0021, -0.002099);
    });
  });

  await t.test('should handle mixed sign comparisons', () => {
    assert.throws(
      () => assertAlmostEqual(-0.5, 0.5),
      {
        name: 'AssertionError'
      }
    );
  });

  await t.test('should handle very small negative numbers', () => {
    assert.doesNotThrow(() => {
      assertAlmostEqual(-0.000001, -0.0000009999);
    });
  });
});

test('assertAlmostEqual - Boundary Conditions', async (t) => {
  await t.test('should pass when difference equals epsilon (boundary)', () => {
    assert.doesNotThrow(() => {
      assertAlmostEqual(1.0, 1.0001, 0.0001);
    });
  });

  await t.test('should throw when difference slightly exceeds epsilon', () => {
    assert.throws(
      () => assertAlmostEqual(1.0, 1.00011, 0.0001),
      {
        name: 'AssertionError'
      }
    );
  });

  await t.test('should handle very small epsilon values', () => {
    assert.doesNotThrow(() => {
      assertAlmostEqual(0.123456789, 0.123456788, 0.000000001);
    });
  });

  await t.test('should handle very large epsilon values', () => {
    assert.doesNotThrow(() => {
      assertAlmostEqual(100, 200, 150);
    });
  });
});

test('assertAlmostEqual - Input Validation', async (t) => {
  await t.test('should throw TypeError when actual is not a number', () => {
    assert.throws(
      () => assertAlmostEqual('1.0', 1.0),
      {
        name: 'TypeError',
        message: /actual must be a number/
      }
    );
  });

  await t.test('should throw TypeError when expected is not a number', () => {
    assert.throws(
      () => assertAlmostEqual(1.0, '1.0'),
      {
        name: 'TypeError',
        message: /expected must be a number/
      }
    );
  });

  await t.test('should throw TypeError when epsilon is not a number', () => {
    assert.throws(
      () => assertAlmostEqual(1.0, 1.0, 'invalid'),
      {
        name: 'TypeError',
        message: /epsilon must be a positive number/
      }
    );
  });

  await t.test('should throw TypeError when epsilon is negative', () => {
    assert.throws(
      () => assertAlmostEqual(1.0, 1.0, -0.001),
      {
        name: 'TypeError',
        message: /epsilon must be a positive number/
      }
    );
  });

  await t.test('should throw TypeError when epsilon is zero', () => {
    assert.throws(
      () => assertAlmostEqual(1.0, 1.0, 0),
      {
        name: 'TypeError',
        message: /epsilon must be a positive number/
      }
    );
  });

  await t.test('should throw TypeError when actual is null', () => {
    assert.throws(
      () => assertAlmostEqual(null, 1.0),
      {
        name: 'TypeError'
      }
    );
  });

  await t.test('should throw TypeError when actual is undefined', () => {
    assert.throws(
      () => assertAlmostEqual(undefined, 1.0),
      {
        name: 'TypeError'
      }
    );
  });
});

test('assertAlmostEqual - Default Epsilon Value', async (t) => {
  await t.test('should export DEFAULT_EPSILON constant', () => {
    assert.strictEqual(DEFAULT_EPSILON, 0.0001);
  });

  await t.test('should use DEFAULT_EPSILON when epsilon is omitted', () => {
    // Should pass with difference of 0.00005 (less than 0.0001)
    assert.doesNotThrow(() => {
      assertAlmostEqual(1.0, 1.00005);
    });

    // Should fail with difference of 0.0002 (more than 0.0001)
    assert.throws(
      () => assertAlmostEqual(1.0, 1.0002),
      {
        name: 'AssertionError'
      }
    );
  });
});

test('assertAlmostEqual - Real-World Use Cases', async (t) => {
  await t.test('should handle currency calculations (2 decimal places)', () => {
    const price1 = 0.1;
    const price2 = 0.2;
    const total = price1 + price2; // May have floating-point error

    assert.doesNotThrow(() => {
      assertAlmostEqual(total, 0.3, 0.01); // Epsilon for 2 decimal places
    });
  });

  await t.test('should handle percentage calculations', () => {
    const saved = 700;
    const original = 1000;
    const percentage = (saved / original) * 100; // 70%

    assert.doesNotThrow(() => {
      assertAlmostEqual(percentage, 70.0);
    });
  });

  await t.test('should handle cost savings aggregation', () => {
    const savings1 = 0.0021;
    const savings2 = 0.0045;
    const savings3 = 0.01;
    const total = savings1 + savings2 + savings3;

    assert.doesNotThrow(() => {
      assertAlmostEqual(total, 0.0166);
    });
  });

  await t.test('should handle average calculations', () => {
    const total = 0.0166;
    const count = 3;
    const average = total / count;
    const expectedAverage = (0.0021 + 0.0045 + 0.01) / 3;

    assert.doesNotThrow(() => {
      assertAlmostEqual(average, expectedAverage);
    });
  });
});

console.log('All assertAlmostEqual tests completed');
