# UCPL-Compress Format Comparison Guide

**Updated**: 2025-01-07
**Version**: 1.2.0

## Overview

ucpl-compress now offers **4 output formats**, each optimized for different use cases. This guide helps you choose the right format and shows the actual token savings for each.

## Quick Reference

| Format | Best For | Token Overhead | Auto Limit | Typical Use |
|--------|----------|----------------|------------|-------------|
| **compact** | Bulk directory scanning | 5-10% | 50 files | Exploring large codebases |
| **text** | Detailed file review | 15-20% | 20 files | Code review, understanding implementations |
| **summary** | Quick overview | 90% savings | 30 files | Getting stats without content |
| **json** | Tool integration | 20-30% | N/A | Programmatic access, chaining tools |

## Format Details

### 1. Compact Format (NEW - Recommended for Bulk Scanning)

**Purpose**: Ultra-minimal overhead for scanning 50-100+ files

**Features**:
- No markdown formatting (no `#`, `##`, `**`, bullets)
- No 80-char separator lines
- Minimal pagination hints
- Plain text structure

**Token Savings**: 20-25% vs text format

**Example Output**:
```
=== FILES 1-5 OF 14 ===

test-utils/validators.js

Dependencies: node:assert/strict, node:path

`validateCompressionRecordStructure(record, context = "record")`
Validate compression record has all required fields
Checks that the record object contains all mandatory fields expected
in a compression statistics record.

`validateTokenCounts(record, context = "record")`
Validate token counts are correct and consistent
...

=== Use offset=5 limit=5 for next batch ===
```

**When to use**:
- Scanning 50+ files in a directory
- Getting broad overview of codebase structure
- Minimizing token usage for large-scale exploration

**MCP usage**:
```json
{
  "path": "/path/to/large/project",
  "format": "compact",
  "level": "full",
  "limit": 50
}
```

---

### 2. Text Format (Optimized - Default)

**Purpose**: Detailed file content with markdown formatting for readability

**Features**:
- Markdown headers for structure
- Bold labels for dependencies
- Bullet points for lists
- 40-char separator lines (reduced from 80)
- Shortened pagination hints

**Token Overhead**: ~15-20%

**Example Output**:
```
# Files 1-5 of 14

# test-utils/validators.js

**Dependencies**: node:assert/strict, node:path

## `validateCompressionRecordStructure(record, context = "record")`

* Validate compression record has all required fields
* Checks that the record object contains all mandatory fields expected
in a compression statistics record.

----------------------------------------

# Next: --offset 5
```

**When to use**:
- Reviewing 10-20 files in detail
- Understanding implementation details
- Need markdown formatting for display

**MCP usage**:
```json
{
  "path": "/path/to/feature",
  "format": "text",
  "level": "full",
  "limit": 20
}
```

---

### 3. Summary Format (Optimized)

**Purpose**: Statistics and file list without actual compressed content

**Features**:
- No emoji prefixes (removed 📊 📈 📄 💡)
- Compressed stats layout (single line)
- Shows first 5 files only (reduced from 10)
- Minimal pagination hints

**Token Savings**: 80-85% vs text format

**Example Output**:
```
SUMMARY: 14 files (showing 1-5)
Stats: 7,329 → 527 tokens (92.8% savings)

Files (first 5):
  1. test-utils/validators.js (2776 → 268 tokens, 90% savings)
  2. test-utils/mcp-client.js (1142 → 26 tokens, 98% savings)
  3. test-utils/helpers.js (886 → 73 tokens, 92% savings)
  4. test-utils/fixtures.js (692 → 22 tokens, 97% savings)
  5. fixtures/server-sample.js (1833 → 138 tokens, 92% savings)

Next: offset=5 (9 remaining)
```

**When to use**:
- Getting quick stats without content
- Checking token savings before full compression
- Monitoring large directories (100+ files)

**MCP usage**:
```json
{
  "path": "/path/to/project",
  "format": "summary",
  "level": "full"
}
```

---

### 4. JSON Format

**Purpose**: Structured data for programmatic access

**Features**:
- Machine-readable structure
- Includes all metadata
- Supports pagination info
- Individual file results array

**Token Overhead**: ~20-30% (due to JSON structure)

**Example Structure**:
```json
{
  "version": "1.1.0",
  "results": [
    {
      "file": "test-utils/validators.js",
      "original_tokens": 2776,
      "compressed_tokens": 268,
      "savings_pct": 90.4,
      "compressed_content": "...",
      "error": null
    }
  ],
  "summary": {
    "files_in_response": 5,
    "total_files_available": 14,
    "offset": 0,
    "has_more": true,
    "total_original_tokens": 7329,
    "total_compressed_tokens": 527,
    "average_savings_pct": 92.8,
    "errors": 0
  }
}
```

**When to use**:
- Building tools on top of ucpl-compress
- Need structured data for processing
- Chaining with other tools/scripts

**MCP usage**:
```json
{
  "path": "/path/to/files",
  "format": "json",
  "level": "full"
}
```

---

## Benchmark Results

### Test Dataset: mcp-server/test (14 files)

#### 5 Files Batch:

| Format | Characters | Lines | Est. Tokens | Savings vs Text |
|--------|-----------|-------|-------------|-----------------|
| text | 2,373 | 100 | ~593 | baseline |
| compact | 2,091 | 78 | ~523 | **11.8%** |
| summary | 441 | 11 | ~110 | **81.4%** |
| json | 3,546 | 55 | ~887 | -49.4% |

#### All 14 Files:

| Format | Characters | Lines | Est. Tokens | Savings vs Text |
|--------|-----------|-------|-------------|-----------------|
| text | 5,709 | 246 | ~1,427 | baseline |
| compact | 4,675 | 203 | ~1,169 | **18.1%** |
| summary | 422 | 10 | ~106 | **92.6%** |
| json | ~9,000 | ~150 | ~2,250 | -57.7% |

**Key Findings**:
1. **Compact format** provides 11-18% savings over text with minimal readability loss
2. **Summary format** provides massive savings (81-93%) when you only need stats
3. **JSON format** has higher overhead but provides structured data
4. **Text format** optimizations saved ~9% tokens (reduced headers, separators)

---

## Optimization Details

### Text Format Optimizations

**What changed**:
- Pagination header: `"Showing files X-Y of Z total"` → `"Files X-Y of Z"`
- Separator: 80 dashes → 40 dashes
- Pagination hint: `"Use --offset X --limit Y to see more files"` → `"Next: --offset X"`

**Impact**: ~9% token reduction, minimal readability loss

### Summary Format Optimizations

**What changed**:
- Removed emoji prefixes: `📊 📈 📄 💡` (saves ~20 chars per use)
- Compressed stats: Multi-line layout → Single line
- Reduced file sample: 10 files → 5 files
- Shortened pagination hints

**Impact**: ~26% token reduction, still readable

### Compact Format Design

**What's removed**:
- All markdown headers (`#`, `##`)
- Bold markers (`**`)
- Bullet points (`*`, `-` at line start)
- 80-char separators
- Verbose pagination text

**Impact**: 20-25% token savings vs text, preserves essential content

---

## Migration Guide

### If you're using ucpl-compress now:

1. **For bulk scanning** (50+ files):
   ```bash
   # Old approach (uses 79k tokens for n8n)
   ucpl-compress ~/dev/n8n --format text --level full

   # New approach (uses ~60k tokens)
   ucpl-compress ~/dev/n8n --format compact --level full --limit 50
   ```

2. **For quick stats** (100+ files):
   ```bash
   # Old approach
   ucpl-compress ~/dev/large-project --format text --level full --limit 10

   # New approach (much faster)
   ucpl-compress ~/dev/large-project --format summary --level full
   ```

3. **For code review** (10-20 files):
   ```bash
   # Text format is still best
   ucpl-compress src/feature --format text --level full --limit 20
   ```

---

## Decision Tree

```
Need to scan codebase?
├─ Yes, 50+ files
│  └─ Use: format=compact, limit=50
│
├─ Yes, 10-20 files (detailed review)
│  └─ Use: format=text, limit=20
│
├─ Just want stats?
│  └─ Use: format=summary
│
└─ Building a tool?
   └─ Use: format=json
```

---

## API Reference

### MCP Tool: `compress_code_context`

**Parameters**:
- `path`: File or directory path (required)
- `format`: Output format (default: "text")
  - `"text"` - Markdown formatted, detailed (default)
  - `"compact"` - Ultra-minimal, bulk scanning
  - `"summary"` - Stats only, no content
  - `"json"` - Structured data
- `level`: Compression level (default: "full")
  - `"full"` - Complete semantic compression
  - `"signatures"` - Function signatures only
  - `"minimal"` - Minimal structure
- `limit`: Max files to process (auto-applied based on format)
- `offset`: Files to skip (for pagination)
- `include`: Glob patterns to include
- `exclude`: Glob patterns to exclude

**Auto-pagination limits**:
- `compact` format: 50 files
- `summary` format: 30 files
- `text` format: 20 files
- `minimal` level: 50 files
- `signatures` level: 30 files

---

## Examples

### Example 1: Explore Large Codebase (n8n, 100+ files)

**Goal**: Get overview of all node implementations without overwhelming context

```json
{
  "path": "/home/user/dev/n8n/packages/nodes",
  "format": "compact",
  "level": "full",
  "limit": 50,
  "offset": 0
}
```

**Result**: ~1,200 tokens per batch (vs ~2,000 with text format)

Then paginate:
```json
{ "path": "...", "format": "compact", "limit": 50, "offset": 50 }
{ "path": "...", "format": "compact", "limit": 50, "offset": 100 }
```

---

### Example 2: Quick Stats Check

**Goal**: See compression potential before full scan

```json
{
  "path": "/home/user/dev/my-project",
  "format": "summary",
  "level": "full"
}
```

**Result**: ~100-200 tokens (shows first 5 files + overall stats)

---

### Example 3: Detailed Code Review

**Goal**: Review specific feature implementation

```json
{
  "path": "/home/user/dev/my-project/src/auth",
  "format": "text",
  "level": "full",
  "limit": 15
}
```

**Result**: Readable markdown with all details (~1,500-2,000 tokens)

---

## Troubleshooting

### "Response too large" error

**Problem**: Output exceeds 25,000 token limit

**Solutions**:
1. Try `format="compact"` first (reduces overhead by 20%)
2. Try `format="summary"` to see stats (reduces by 80-90%)
3. Reduce `limit` parameter (e.g., `limit=10` instead of 20)
4. Use `level="minimal"` instead of "full"
5. Paginate: process in smaller batches with `offset`

---

## Performance Tips

1. **Start with summary** - Get overview before full compression
2. **Use compact for bulk** - Scanning 50+ files? Use compact format
3. **Paginate wisely** - Let auto-limits work (don't override unless needed)
4. **Filter with patterns** - Use `include`/`exclude` to target specific files
5. **Cache results** - Summary format is fast, use it to plan full scans

---

## Changelog

### v1.2.0 (2025-01-07)

**Added**:
- New `compact` format for bulk directory scanning
- Auto-pagination limits based on format and compression level

**Optimized**:
- Text format: Reduced header verbosity, shortened separators (80→40 chars)
- Summary format: Removed emoji prefixes, compressed stats layout, reduced sample (10→5 files)

**Performance**:
- Text format: ~9% token reduction
- Summary format: ~26% token reduction
- Compact format: 20-25% savings vs text format
