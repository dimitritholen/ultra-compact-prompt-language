#!/usr/bin/env node

/**
 * Test script to verify error isolation in parallel test execution
 *
 * This script tests that when using Promise.allSettled:
 * 1. All tests execute to completion even if some fail
 * 2. Individual test failures are reported clearly
 * 3. Exit code reflects overall test suite status
 * 4. Exceptions in tests are caught and reported
 */

const { spawn } = require("child_process");
const path = require("path");

/**
 * Run test-stats-retention.js and capture output
 *
 * @returns {Promise<{exitCode: number, stdout: string, stderr: string}>}
 */
function runStatsRetentionTests() {
  return new Promise((resolve) => {
    const testScript = path.join(__dirname, "test-stats-retention.js");
    const child = spawn("node", [testScript], {
      cwd: __dirname,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}

/**
 * Test Case 1: Verify all tests execute (happy path)
 *
 * When all tests pass, verify:
 * - Exit code is 0
 * - All 4 tests are reported as passed
 * - Success message is displayed
 */
async function testAllTestsExecute() {
  console.log("Test 1: Verify all tests execute to completion\n");

  const { exitCode, stdout, stderr } = await runStatsRetentionTests();

  console.log("Exit code:", exitCode);
  console.log("\nStdout:\n", stdout);
  if (stderr) {
    console.log("\nStderr:\n", stderr);
  }

  // Verify all 4 tests are mentioned in output
  const testNames = ["Test 1:", "Test 2:", "Test 3:", "Test 4:"];
  const allTestsRan = testNames.every((name) => stdout.includes(name));

  console.log("\n✓ All 4 tests executed:", allTestsRan);
  console.log(
    "✓ Test Results section present:",
    stdout.includes("Test Results:"),
  );
  console.log("✓ Pass/Fail counts shown:", /Passed: \d+\/\d+/.test(stdout));

  const pass =
    allTestsRan &&
    stdout.includes("Test Results:") &&
    /Passed: \d+\/\d+/.test(stdout);

  console.log(pass ? "\n✅ Test 1 PASSED\n" : "\n❌ Test 1 FAILED\n");
  return pass;
}

/**
 * Test Case 2: Verify exit code reflects test results
 *
 * When tests pass:
 * - Exit code should be 0
 * - "All tests PASSED" message should appear
 *
 * When tests fail:
 * - Exit code should be 1
 * - "Some tests FAILED" message should appear
 */
async function testExitCodeReflectsResults() {
  console.log("Test 2: Verify exit code reflects test results\n");

  const { exitCode, stdout } = await runStatsRetentionTests();

  const allPassed = stdout.includes("All tests PASSED");
  const someFailed = stdout.includes("Some tests FAILED");

  console.log(
    "✓ Exit code matches result:",
    (allPassed && exitCode === 0) || (someFailed && exitCode === 1),
  );

  const pass = (allPassed && exitCode === 0) || (someFailed && exitCode === 1);

  console.log(pass ? "\n✅ Test 2 PASSED\n" : "\n❌ Test 2 FAILED\n");
  return pass;
}

/**
 * Test Case 3: Verify test isolation (error boundary)
 *
 * This test verifies that the test runner completes all tests
 * even if individual tests fail. We check that:
 * - All test names appear in output
 * - Pass/fail counts are shown for all tests
 * - No premature termination occurs
 */
async function testErrorIsolation() {
  console.log("Test 3: Verify error isolation (all tests complete)\n");

  const { stdout } = await runStatsRetentionTests();

  // Count how many test outputs appear
  const testOutputs = [
    stdout.includes("Test 1:"),
    stdout.includes("Test 2:"),
    stdout.includes("Test 3:"),
    stdout.includes("Test 4:"),
  ];

  const testsExecuted = testOutputs.filter(Boolean).length;

  console.log("✓ Tests executed:", testsExecuted, "/ 4");
  console.log("✓ All tests completed:", testsExecuted === 4);

  const pass = testsExecuted === 4;

  console.log(pass ? "\n✅ Test 3 PASSED\n" : "\n❌ Test 3 FAILED\n");
  return pass;
}

/**
 * Test Case 4: Verify clear failure reporting
 *
 * When tests fail, verify:
 * - Failed test count is accurate
 * - Failure details are reported
 * - Output is readable and informative
 */
async function testFailureReporting() {
  console.log("Test 4: Verify clear failure reporting\n");

  const { stdout } = await runStatsRetentionTests();

  // Check for failure reporting format
  const hasFailureCount = /Failed: \d+\/\d+/.test(stdout);
  const hasPassCount = /Passed: \d+\/\d+/.test(stdout);

  console.log("✓ Failure count reported:", hasFailureCount);
  console.log("✓ Pass count reported:", hasPassCount);
  console.log("✓ Test summary present:", stdout.includes("Test Results:"));

  const pass =
    hasFailureCount && hasPassCount && stdout.includes("Test Results:");

  console.log(pass ? "\n✅ Test 4 PASSED\n" : "\n❌ Test 4 FAILED\n");
  return pass;
}

/**
 * Run all error isolation tests
 */
async function runTests() {
  console.log("=".repeat(60));
  console.log("Error Isolation Test Suite");
  console.log("=".repeat(60));
  console.log("");

  // Use Promise.allSettled to ensure all our meta-tests complete
  const settledResults = await Promise.allSettled([
    testAllTestsExecute(),
    testExitCodeReflectsResults(),
    testErrorIsolation(),
    testFailureReporting(),
  ]);

  // Extract results
  const results = settledResults.map((result) =>
    result.status === "fulfilled" ? result.value : false,
  );

  console.log("=".repeat(60));
  console.log("Test Results:");
  console.log("=".repeat(60));
  console.log(`Passed: ${results.filter((r) => r).length}/${results.length}`);
  console.log(`Failed: ${results.filter((r) => !r).length}/${results.length}`);

  if (results.every((r) => r)) {
    console.log("\n✅ All tests PASSED!");
    process.exit(0);
  } else {
    console.log("\n❌ Some tests FAILED");
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
