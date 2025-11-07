# Test Utilities

Shared testing utilities for the mcp-server test suite.

## Overview

This directory contains reusable test utilities that are used across multiple test files. These utilities help maintain consistency, reduce code duplication, and make tests easier to write and maintain.

## Modules

### helpers.js

Common helper functions for file operations, polling, and cleanup.

**Functions:**

- `fileExists(filePath)` - Check if a file exists
- `pollForCondition(condition, options)` - Poll for a condition with exponential backoff
- `cleanupFiles(...filePaths)` - Clean up test files safely

**Example:**

```javascript
const {
  fileExists,
  pollForCondition,
  cleanupFiles,
} = require("./test-utils/helpers");

// Check if a file exists
if (await fileExists("./test-file.txt")) {
  console.log("File exists");
}

// Poll for a condition
const result = await pollForCondition(
  async () => {
    const exists = await fileExists("./test-file.txt");
    return exists ? { success: true } : null;
  },
  { maxWaitMs: 5000, initialDelay: 100, maxDelay: 1000 },
);

// Cleanup test files
await cleanupFiles("./test-file1.txt", "./test-file2.txt");
```

### mcp-client.js

MCP protocol client for testing server interactions.

**Functions:**

- `callMCPTool(serverPath, toolName, args)` - Call an MCP tool by spawning the server process

**Example:**

```javascript
const { callMCPTool } = require("./test-utils/mcp-client");
const path = require("path");

const SERVER_PATH = path.join(__dirname, "server.js");

// Call compress_code_context tool
const { response, stderr } = await callMCPTool(
  SERVER_PATH,
  "compress_code_context",
  {
    path: "./test-file.js",
    level: "full",
    format: "text",
  },
);

console.log("Compression result:", response.result.content[0].text);
```

### fixtures.js

Test data generation functions for creating realistic test fixtures.

**Functions:**

- `generateStatsWithCost(options)` - Generate test statistics with cost tracking

**Example:**

```javascript
const { generateStatsWithCost } = require("./test-utils/fixtures");

// Generate default test stats
const stats = generateStatsWithCost();
console.log("Total compressions:", stats.summary.totalCompressions);

// Generate custom test stats (future enhancement)
const customStats = generateStatsWithCost({
  compressionCount: 5,
  daysAgo: 7,
});
```

## Design Principles

1. **Reusability** - Functions are designed to be used across multiple test files
2. **Simplicity** - Each utility has a single, clear purpose
3. **Documentation** - All functions include JSDoc comments
4. **Error Handling** - Utilities handle errors gracefully with appropriate fallbacks
5. **Testing** - Utilities themselves should be simple enough to not require testing

## Usage Guidelines

- Import only what you need using destructuring: `const { fileExists } = require('./test-utils/helpers')`
- Use absolute paths when referencing server files or test files
- Always clean up test artifacts using `cleanupFiles()` in `afterEach` or `afterAll` hooks
- Prefer `pollForCondition()` over fixed `setTimeout()` delays for better test reliability

## Contributing

When adding new utilities:

1. Place the utility in the appropriate module (or create a new one if needed)
2. Add JSDoc documentation with parameter types and return values
3. Update this README with usage examples
4. Export the function at the bottom of the module
5. Ensure the utility is framework-agnostic (works with both Node.js test runners)
