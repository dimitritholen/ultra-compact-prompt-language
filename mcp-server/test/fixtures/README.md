# Test Fixtures

This directory contains real code files used for compression testing.

## Files

### `test-utils.js`
- **Source**: `/mcp-server/test-utils.js` (complete copy)
- **Size**: 112 lines
- **Purpose**: Small, complete JavaScript file for accurate compression testing
- **Usage**: Tests in `test-statistics.js`, `test-integration.js`
- **Why this file**: Contains real utility functions with JSDoc comments, representative of actual code patterns

### `server-sample.js`
- **Source**: First 200 lines of `/mcp-server/server.js`
- **Size**: 200 lines
- **Purpose**: Larger code sample for realistic compression testing
- **Usage**: Tests in `test-integration.js`, `test-statistics-fallback.js`
- **Why this file**: MCP server implementation with comments, imports, and functions - realistic compression target

### `test-utils-compressed.txt`
- **Source**: Compressed version of `test-utils.js`
- **Purpose**: Pre-compressed content for deterministic test comparisons
- **Compression level**: full
- **Format**: text

## Maintenance

These fixtures are **immutable copies** of project files at a specific point in time. They should NOT be updated unless tests need to reflect new code patterns.

If you need to update fixtures:
1. Document the reason in the commit message
2. Update expected test values in corresponding test files
3. Verify all tests pass after fixture updates

## Usage in Tests

```javascript
const fs = require('fs').promises;
const path = require('path');

const FIXTURES_DIR = path.join(__dirname, 'test', 'fixtures');
const originalContent = await fs.readFile(
  path.join(FIXTURES_DIR, 'test-utils.js'),
  'utf-8'
);
```
