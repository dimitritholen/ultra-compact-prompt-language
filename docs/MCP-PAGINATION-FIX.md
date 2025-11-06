# MCP Pagination Fix for Large Directories

## Problem

The ucpl-compress MCP server was returning responses that exceeded the 25,000 token limit imposed by MCP protocol when compressing large directories. Even with `level="minimal"` and aggressive exclusion patterns, large codebases (1000+ files) would generate responses of 200K-500K+ tokens, causing the tool to fail.

**Error Example:**
```
Error: MCP tool "compress_code_context" response (537773 tokens) exceeds
maximum allowed tokens (25000). Please use pagination, filtering, or limit
parameters to reduce the response size.
```

## Solution

Added pagination support via two new parameters:

1. **`limit`** (number): Maximum number of files to process in a single request
2. **`offset`** (number): Number of files to skip before processing

These parameters allow LLMs to paginate through large directories in manageable chunks, keeping responses under the 25K token limit.

## Implementation Details

### Changes Made

#### 1. Python CLI (`mcp-server/scripts/ucpl-compress`)
- Updated `compress_directory()` to accept `limit` and `offset` parameters
- Modified function to return tuple: `(results, total_files_found)`
- Updated `format_output()` to display pagination info
- Added `--limit` and `--offset` command-line arguments

#### 2. Node.js MCP Server (`mcp-server/server.js`)
- Updated `compressContext()` function to pass `limit` and `offset` to CLI
- Added `limit` and `offset` to tool schema with descriptions
- Updated `handleToolCall()` to extract and pass pagination parameters

#### 3. Documentation
- Updated `docs/mcp-system-prompt-snippet.md` with pagination strategies
- Added decision tree for when to use pagination
- Included example workflows for large directories

## Usage Examples

### Strategy 1: Summary First (Recommended)

Get an overview without content (lightweight, shows all files):

```javascript
compress_code_context({
  path: "large-project/",
  format: "summary"
})
```

**Output:** File list with token stats, no compressed content (~500-2000 tokens)

### Strategy 2: Paginated Compression

Compress files in batches:

```javascript
// First batch (files 1-20)
compress_code_context({
  path: "large-project/",
  level: "minimal",
  limit: 20,
  offset: 0
})

// Second batch (files 21-40)
compress_code_context({
  path: "large-project/",
  level: "minimal",
  limit: 20,
  offset: 20
})
```

### Strategy 3: Targeted Compression

Use filtering + pagination:

```javascript
compress_code_context({
  path: "src/",
  include: ["*.py"],
  exclude: ["**/test_*", "**/__pycache__"],
  level: "full",
  limit: 30
})
```

## Token Estimates

| Configuration | Files | Tokens (approx) | Fits in 25K limit? |
|---------------|-------|-----------------|-------------------|
| `format="summary"` | 1000+ | 1K-3K | ✅ Always |
| `level="minimal", limit=50` | 50 | 8K-15K | ✅ Yes |
| `level="full", limit=20` | 20 | 10K-20K | ✅ Yes |
| `level="full", limit=50` | 50 | 20K-40K | ⚠️ May exceed |
| No limit, minimal | 500+ | 100K-300K | ❌ No |

## Recommended Limits

| Compression Level | Recommended Limit | Conservative Limit |
|-------------------|-------------------|--------------------|
| `minimal` | 50 files | 30 files |
| `signatures` | 30 files | 20 files |
| `full` | 20 files | 10 files |

**Note:** Actual token counts depend on file size and complexity. These are conservative estimates.

## LLM Integration Guidelines

When implementing this in an LLM system prompt:

1. **Always use `format="summary"` first** for large directories
2. **Default to `limit=20`** when compressing directories with `level="full"`
3. **Use `limit=50`** when using `level="minimal"`
4. **Paginate automatically** if the user asks about a large directory
5. **Show pagination progress** to user (e.g., "Analyzed files 1-20 of 150")

### Example LLM Behavior

```
User: "What does the fib-rag directory contain?"

LLM Internal Logic:
1. Check if directory is large (try summary first)
2. compress_code_context(path="fib-rag", format="summary")
3. Parse response: 347 files found
4. Decide: Too large for single request
5. compress_code_context(path="fib-rag", level="minimal", limit=50, offset=0)
6. Present findings to user
7. Offer to paginate: "I've analyzed the first 50 files. Would you like me to continue?"
```

## Testing

Verified with test directory containing 5 Python files:

```bash
# Summary format (all files, no content)
python3 mcp-server/scripts/ucpl-compress . --format summary --language python

# Paginated (first 3 files)
python3 mcp-server/scripts/ucpl-compress . --format summary --limit 3 --language python
Output: "Showing files 1-3 of 5 total"

# Paginated (next 2 files)
python3 mcp-server/scripts/ucpl-compress . --format summary --limit 3 --offset 3 --language python
Output: "Showing files 4-5 of 5 total"
```

## Format Comparison

### `format="summary"` (Recommended for initial exploration)
- Returns: Table of filenames, token counts, compression stats
- Tokens: Very low (1-3K for 1000 files)
- Use case: Understanding scope before diving deeper

### `format="text"` with `limit`
- Returns: Compressed code content for specified number of files
- Tokens: Varies by compression level and file complexity
- Use case: Reading actual code structure after identifying relevant files

### `format="json"` with `limit`
- Returns: Structured JSON with results + pagination metadata
- Tokens: Similar to "text" but with structured data
- Use case: Programmatic consumption or advanced tooling

## Migration Guide

**Before (Would fail on large directories):**
```javascript
compress_code_context({
  path: "large-project/",
  level: "minimal"
})
// Error: 283178 tokens exceeds 25000 limit
```

**After (Works correctly):**
```javascript
// Option 1: Summary first
compress_code_context({
  path: "large-project/",
  format: "summary"
})

// Option 2: Paginated compression
compress_code_context({
  path: "large-project/",
  level: "minimal",
  limit: 30
})
```

## Future Enhancements

Potential improvements for future versions:

1. **Auto-pagination**: Detect response size and automatically chunk
2. **Smart batching**: Group related files together (e.g., all files in same package)
3. **Token budget**: Accept `max_tokens` parameter and automatically adjust `limit`
4. **Resume tokens**: Return continuation token for stateless pagination
5. **File prioritization**: Sort by importance (e.g., main files first, tests last)

## Version Info

- **Fixed in**: v1.1.0 (unreleased)
- **Affects**: MCP server users only (CLI always supported pagination)
- **Breaking changes**: None (backward compatible, new optional parameters)
- **Dependencies**: None (uses existing Python/Node.js stdlib)

## Related Documentation

- [MCP System Prompt Snippet](./mcp-system-prompt-snippet.md) - Updated with pagination strategies
- [MCP Server README](../mcp-server/README.md) - Installation and configuration
- [UCPL Compress CLI](./UCPL-COMPRESS.md) - Standalone CLI usage (always supported pagination)
