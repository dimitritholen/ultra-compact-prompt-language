#!/usr/bin/env node

/**
 * Integration test to verify statistics file path configuration behavior
 *
 * Tests:
 * 1. Server uses hardcoded path (~/.ucpl/compress/compression-stats.json)
 * 2. Server does NOT read UCPL_STATS_FILE environment variable
 * 3. Statistics file path cannot be configured via environment variables
 */

const fs = require("fs").promises;
const path = require("path");
const os = require("os");

// Expected hardcoded paths (from server.js lines 20-21)
const EXPECTED_STATS_DIR = path.join(os.homedir(), ".ucpl", "compress");
const EXPECTED_STATS_FILE = path.join(
  EXPECTED_STATS_DIR,
  "compression-stats.json",
);

/**
 * Test 1: Verify hardcoded path constants in server.js
 */
async function testHardcodedPaths() {
  console.log("Test 1: Verify server uses hardcoded statistics file path...");

  try {
    // Read server.js source code
    const serverSource = await fs.readFile(
      path.join(__dirname, "../server.js"),
      "utf-8",
    );

    // Verify hardcoded STATS_DIR
    const statsDirMatch = serverSource.match(
      /const STATS_DIR = path\.join\(os\.homedir\(\), '\.ucpl', 'compress'\);/,
    );
    const statsFileMatch = serverSource.match(
      /const STATS_FILE = path\.join\(STATS_DIR, 'compression-stats\.json'\);/,
    );

    if (statsDirMatch && statsFileMatch) {
      console.log("  ✅ Server uses hardcoded paths:");
      console.log(`     STATS_DIR: os.homedir()/.ucpl/compress`);
      console.log(`     STATS_FILE: STATS_DIR/compression-stats.json`);
      console.log(`     Resolved: ${EXPECTED_STATS_FILE}`);
      return true;
    } else {
      console.log("  ❌ Expected hardcoded paths not found in server.js");
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 2: Verify environment variable UCPL_STATS_FILE is NOT used
 */
async function testEnvironmentVariableNotUsed() {
  console.log(
    "\nTest 2: Verify UCPL_STATS_FILE environment variable is NOT used...",
  );

  try {
    // Read server.js source code
    const serverSource = await fs.readFile(
      path.join(__dirname, "../server.js"),
      "utf-8",
    );

    // Search for any reference to UCPL_STATS_FILE
    const envVarMatch = serverSource.match(
      /UCPL_STATS_FILE|process\.env\..*STATS/,
    );

    if (!envVarMatch) {
      console.log(
        "  ✅ No environment variable checks for stats file path found",
      );
      console.log(
        "     Confirmed: Server does NOT support UCPL_STATS_FILE or similar env vars",
      );
      return true;
    } else {
      console.log("  ❌ Found unexpected environment variable reference:");
      console.log(`     ${envVarMatch[0]}`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Verify STATS_FILE is used directly (not via env var)
 */
async function testStatsFileUsedDirectly() {
  console.log("\nTest 3: Verify STATS_FILE constant is used directly...");

  try {
    // Read server.js source code
    const serverSource = await fs.readFile(
      path.join(__dirname, "../server.js"),
      "utf-8",
    );

    // Verify STATS_FILE is used in loadStats and saveStats functions
    const loadStatsMatch = serverSource.match(
      /await fs\.readFile\(STATS_FILE,/,
    );
    const saveStatsMatch = serverSource.match(
      /await fs\.writeFile\(STATS_FILE,/,
    );

    if (loadStatsMatch && saveStatsMatch) {
      console.log("  ✅ STATS_FILE constant used directly in:");
      console.log("     - loadStats() function");
      console.log("     - saveStats() function");
      console.log("     No environment variable indirection found");
      return true;
    } else {
      console.log("  ❌ Expected STATS_FILE usage not found");
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 4: Verify documentation reflects non-configurable path
 */
async function testDocumentation() {
  console.log("\nTest 4: Verify README documents hardcoded path...");

  try {
    // Read README.md
    const readme = await fs.readFile(
      path.join(__dirname, "README.md"),
      "utf-8",
    );

    // Check for documentation of stats file location
    const statsPathDoc = readme.match(
      /~\/\.ucpl\/compress\/compression-stats\.json/,
    );
    const hardcodedNote = readme.match(/hardcoded.*cannot be configured/i);

    if (statsPathDoc && hardcodedNote) {
      console.log("  ✅ README.md documents:");
      console.log(
        "     - Statistics file path: ~/.ucpl/compress/compression-stats.json",
      );
      console.log("     - Path is hardcoded and cannot be configured");
      return true;
    } else if (statsPathDoc) {
      console.log("  ⚠️  README documents path but not hardcoded nature");
      return true; // Non-blocking, just a warning
    } else {
      console.log("  ❌ Statistics file path not documented in README");
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 5: Verify test files don't mock unused environment variables
 */
async function testNoUnusedMocks() {
  console.log(
    "\nTest 5: Verify test files do not mock unused UCPL_STATS_FILE...",
  );

  try {
    // Check test-statistics-fallback.js
    const testFile = await fs.readFile(
      path.join(__dirname, "test-statistics-fallback.js"),
      "utf-8",
    );

    // Verify UCPL_STATS_FILE is NOT set
    const envVarSet = testFile.match(/process\.env\.UCPL_STATS_FILE\s*=/);

    if (!envVarSet) {
      console.log(
        "  ✅ test-statistics-fallback.js does NOT mock UCPL_STATS_FILE",
      );
      console.log("     Test uses its own temporary file for isolation");
      return true;
    } else {
      console.log("  ❌ Found unused environment variable mock:");
      console.log(
        "     test-statistics-fallback.js sets UCPL_STATS_FILE (not used by server)",
      );
      return false;
    }
  } catch (error) {
    console.log(`  ❌ Test failed: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log("=== Statistics File Path Configuration Tests ===\n");

  const results = [];

  results.push(await testHardcodedPaths());
  results.push(await testEnvironmentVariableNotUsed());
  results.push(await testStatsFileUsedDirectly());
  results.push(await testDocumentation());
  results.push(await testNoUnusedMocks());

  const passed = results.filter((r) => r).length;
  const total = results.length;

  console.log(`\n=== Results: ${passed}/${total} tests passed ===`);

  if (passed === total) {
    console.log("✅ All tests passed!");
    console.log("\n📝 Summary:");
    console.log(
      "   - Statistics file path is hardcoded: ~/.ucpl/compress/compression-stats.json",
    );
    console.log("   - Environment variables for stats path are NOT supported");
    console.log("   - Tests do not mock unused environment variables");
    console.log(
      "   - Documentation accurately reflects configuration behavior",
    );
    process.exit(0);
  } else {
    console.log("❌ Some tests failed");
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
