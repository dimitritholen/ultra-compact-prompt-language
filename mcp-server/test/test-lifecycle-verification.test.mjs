#!/usr/bin/env node

/**
 * Verification test to demonstrate lifecycle hooks run even on test failure
 *
 * This test intentionally fails to demonstrate that:
 * 1. setupTest() runs before each test
 * 2. teardownTest() runs after each test, EVEN ON FAILURE
 * 3. Test isolation is maintained
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const TEST_DIR = path.join(os.tmpdir(), `lifecycle-verify-${Date.now()}`);
const TEST_MARKER = path.join(TEST_DIR, 'test-marker.txt');

let setupCount = 0;
let teardownCount = 0;

async function setupTest() {
  setupCount++;
  await fs.mkdir(TEST_DIR, { recursive: true });
  await fs.writeFile(TEST_MARKER, `Setup ${setupCount}`);
  console.log(`  [beforeEach] Setup ${setupCount}: Created ${TEST_MARKER}`);
}

async function teardownTest() {
  teardownCount++;
  try {
    const exists = await fs.access(TEST_MARKER).then(() => true).catch(() => false);
    if (exists) {
      console.log(`  [afterEach] Teardown ${teardownCount}: Cleanup running (file exists)`);
    } else {
      console.log(`  [afterEach] Teardown ${teardownCount}: Cleanup running (file already removed)`);
    }
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch (error) {
    console.log(`  [afterEach] Teardown ${teardownCount}: Cleanup attempted`);
  }
}

async function testSuccess() {
  console.log('\nTest 1: Successful test (should cleanup)');
  try {
    await setupTest();

    // Verify setup ran
    const content = await fs.readFile(TEST_MARKER, 'utf-8');
    console.log(`  Test execution: Read marker file: "${content}"`);
    console.log('  ✅ Test passed');
  } catch (error) {
    console.error(`  ❌ Test failed: ${error.message}`);
  } finally {
    await teardownTest();
  }
}

async function testFailure() {
  console.log('\nTest 2: Failing test (should STILL cleanup)');
  try {
    await setupTest();

    // Verify setup ran
    const content = await fs.readFile(TEST_MARKER, 'utf-8');
    console.log(`  Test execution: Read marker file: "${content}"`);

    // Intentionally fail
    throw new Error('Intentional test failure');
  } catch (error) {
    console.error(`  ❌ Test failed: ${error.message}`);
  } finally {
    await teardownTest(); // This MUST run even though test failed
  }
}

async function testException() {
  console.log('\nTest 3: Test with uncaught exception (should STILL cleanup)');
  try {
    await setupTest();

    // Simulate unexpected error
    const content = await fs.readFile(TEST_MARKER, 'utf-8');
    console.log(`  Test execution: Read marker file: "${content}"`);

    // Simulate uncaught exception
    throw new Error('Uncaught exception in test');
  } catch (error) {
    console.error(`  ❌ Test exception: ${error.message}`);
  } finally {
    await teardownTest(); // This MUST run even on exception
  }
}

async function verifyCleanup() {
  console.log('\nVerification: Check if cleanup actually ran');
  try {
    await fs.access(TEST_DIR);
    console.log('  ❌ FAILED: Test directory still exists - cleanup did NOT run!');
    return false;
  } catch (error) {
    console.log('  ✅ SUCCESS: Test directory removed - cleanup ran correctly!');
    return true;
  }
}

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Lifecycle Hook Verification Tests                          ║');
  console.log('║  Demonstrates: afterEach runs even on test failure          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  await testSuccess();
  await testFailure();
  await testException();

  console.log('\n' + '='.repeat(60));
  console.log(`\nLifecycle hook execution summary:`);
  console.log(`  - setupTest() called: ${setupCount} times`);
  console.log(`  - teardownTest() called: ${teardownCount} times`);
  console.log(`  - Expected: 3 setup calls, 3 teardown calls\n`);

  const cleanupVerified = await verifyCleanup();

  console.log('\n' + '='.repeat(60));
  if (setupCount === 3 && teardownCount === 3 && cleanupVerified) {
    console.log('\n✅ All lifecycle hooks verified!');
    console.log('   - beforeEach ran before each test');
    console.log('   - afterEach ran after each test (even on failure)');
    console.log('   - Cleanup guaranteed for test isolation\n');
    process.exit(0);
  } else {
    console.log('\n❌ Lifecycle hook verification FAILED');
    console.log(`   - Setup count: ${setupCount} (expected 3)`);
    console.log(`   - Teardown count: ${teardownCount} (expected 3)`);
    console.log(`   - Cleanup verified: ${cleanupVerified}\n`);
    process.exit(1);
  }
}

runTests();
