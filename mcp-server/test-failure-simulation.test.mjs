#!/usr/bin/env node

/**
 * Simulation test to verify error isolation with intentional failures
 *
 * This test creates intentional failures to verify that:
 * 1. When one test fails, other tests still execute
 * 2. When one test throws, other tests still execute
 * 3. All failures are reported
 * 4. Exit code is 1 when any test fails
 */

/**
 * Test that always passes
 * @returns {Promise<boolean>}
 */
async function passingTest() {
  console.log('Test 1: Passing test');
  console.log('✅ Test 1 PASSED\n');
  return true;
}

/**
 * Test that always fails
 * @returns {Promise<boolean>}
 */
async function failingTest() {
  console.log('Test 2: Failing test');
  console.log('❌ Test 2 FAILED\n');
  return false;
}

/**
 * Test that throws an exception
 * @returns {Promise<boolean>}
 */
async function throwingTest() {
  console.log('Test 3: Throwing test');
  throw new Error('Intentional test exception');
}

/**
 * Test that passes (after the throwing test)
 * @returns {Promise<boolean>}
 */
async function passingTestAfterException() {
  console.log('Test 4: Passing test after exception');
  console.log('✅ Test 4 PASSED\n');
  return true;
}

/**
 * Run all tests with error isolation
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Failure Simulation Test Suite');
  console.log('='.repeat(60));
  console.log('Expected: 2 pass, 1 fail, 1 exception - all should execute\n');

  // Define tests with their names for error reporting
  const tests = [
    { name: 'passingTest', fn: passingTest },
    { name: 'failingTest', fn: failingTest },
    { name: 'throwingTest', fn: throwingTest },
    { name: 'passingTestAfterException', fn: passingTestAfterException }
  ];

  // Use Promise.allSettled to ensure all tests complete regardless of individual failures
  const settledResults = await Promise.allSettled(tests.map(t => t.fn()));

  // Extract test results and check for rejections
  const results = [];
  const failures = [];

  settledResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      // Test threw an exception instead of returning false
      results.push(false);
      failures.push({
        test: tests[index].name,
        error: result.reason
      });
      console.error(`\n❌ ${tests[index].name} threw an exception:`, result.reason);
    }
  });

  console.log('='.repeat(60));
  console.log('Test Results:');
  console.log('='.repeat(60));
  console.log(`Passed: ${results.filter(r => r).length}/${results.length}`);
  console.log(`Failed: ${results.filter(r => !r).length}/${results.length}`);

  // Report any exceptions that were caught
  if (failures.length > 0) {
    console.log('\nTests with exceptions:');
    failures.forEach(f => {
      console.error(`- ${f.test}: ${f.error.message || f.error}`);
    });
  }

  console.log('\nVerification:');
  console.log('✓ All 4 tests executed:', results.length === 4);
  console.log('✓ 2 tests passed:', results.filter(r => r).length === 2);
  console.log('✓ 2 tests failed:', results.filter(r => !r).length === 2);
  console.log('✓ 1 exception caught:', failures.length === 1);

  const verificationPassed =
    results.length === 4 &&
    results.filter(r => r).length === 2 &&
    results.filter(r => !r).length === 2 &&
    failures.length === 1;

  if (verificationPassed) {
    console.log('\n✅ Error isolation verified! All tests executed despite failures.');
    process.exit(0);
  } else {
    console.log('\n❌ Error isolation FAILED - not all tests executed');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
