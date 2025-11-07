#!/usr/bin/env node

/**
 * Integration test to verify event-based waiting works correctly
 * This test verifies that the waitForResponse function properly detects
 * JSON-RPC responses without using fixed timeouts.
 */

import { spawn } from "child_process";
import path from "path";
import readline from "readline";
import { once } from "events";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RESPONSE_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Wait for a JSON-RPC response from the subprocess stdout
 * Uses event-based listening with readline for line-by-line processing
 * @param {import('child_process').ChildProcess} proc - The child process
 * @param {number} requestId - The expected JSON-RPC request ID
 * @returns {Promise<{response: string, stderr: string}>} The response and stderr output
 */
async function waitForResponse(proc, requestId) {
  let stderrOutput = "";
  let responseData = null;

  // Set up stderr listener
  proc.stderr.on("data", (data) => {
    stderrOutput += data.toString();
  });

  // Create readline interface for line-by-line stdout processing
  const rl = readline.createInterface({
    input: proc.stdout,
    crlfDelay: Infinity,
  });

  // Promise race between response detection and timeout
  const responsePromise = (async () => {
    for await (const line of rl) {
      try {
        const parsed = JSON.parse(line);
        // Check if this is the JSON-RPC response we're waiting for
        if (parsed.jsonrpc === "2.0" && parsed.id === requestId) {
          responseData = line;
          break;
        }
      } catch (_err) {
        // Ignore non-JSON lines (could be diagnostics or other output)
        continue;
      }
    }
    return responseData;
  })();

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(
      () =>
        reject(new Error(`Response timeout after ${RESPONSE_TIMEOUT_MS}ms`)),
      RESPONSE_TIMEOUT_MS,
    );
  });

  try {
    await Promise.race([responsePromise, timeoutPromise]);
  } finally {
    rl.close();
  }

  return { response: responseData, stderr: stderrOutput };
}

async function testEventBasedWaiting() {
  console.log("Testing event-based subprocess communication...\n");

  const testRequest = {
    jsonrpc: "2.0",
    id: 42,
    method: "tools/list",
    params: {},
  };

  console.log("Starting MCP server subprocess...");
  const serverPath = path.join(__dirname, "../server.js");
  const proc = spawn("node", [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  console.log("Sending tools/list request...");
  const startTime = Date.now();

  // Send the request
  proc.stdin.write(JSON.stringify(testRequest) + "\n");
  proc.stdin.end();

  // Wait for response using event-based detection
  const { response, stderr } = await waitForResponse(proc, testRequest.id);

  const elapsedTime = Date.now() - startTime;
  console.log(
    `✓ Response received in ${elapsedTime}ms (event-based, not timeout-based)\n`,
  );

  if (stderr) {
    console.log("Server diagnostics (stderr):");
    console.log(stderr);
    console.log();
  }

  // Verify response is valid JSON-RPC
  const parsed = JSON.parse(response);
  if (parsed.jsonrpc !== "2.0") {
    throw new Error("Invalid JSON-RPC response");
  }
  if (parsed.id !== testRequest.id) {
    throw new Error("Response ID mismatch");
  }
  if (!parsed.result) {
    throw new Error("Response missing result field");
  }

  console.log("✓ Response is valid JSON-RPC");
  console.log("✓ Response ID matches request ID");
  console.log("✓ Response contains result field\n");

  // Verify tools are listed
  if (!parsed.result.tools || !Array.isArray(parsed.result.tools)) {
    throw new Error("Response result.tools is not an array");
  }

  console.log(`✓ Found ${parsed.result.tools.length} tools in response`);
  console.log("  Tools:", parsed.result.tools.map((t) => t.name).join(", "));

  // Wait for process to exit
  await once(proc, "close");

  console.log("\n✅ SUCCESS! Event-based waiting works correctly!");
  console.log("   - No fixed timeouts used for synchronization");
  console.log("   - Response detected via actual stdout events");
  console.log(
    `   - Response time: ${elapsedTime}ms (actual time, not artificial delay)`,
  );

  return true;
}

testEventBasedWaiting()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("\n❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  });
