# Self-Documenting MCP Server

## No System Prompt Needed! 🎉

The ucpl-compress MCP server is **fully self-documenting**. You don't need to add anything to your system prompt. When an LLM queries the MCP server for available tools, it receives comprehensive usage instructions automatically.

## How It Works

### 1. Tool Discovery (Automatic)

When Claude Code, Claude Desktop, or any MCP client starts, it asks the server:

```json
{"method": "tools/list"}
```

The server responds with the complete tool definition, including:
- **Detailed description** with usage patterns
- **Parameter descriptions** with recommendations
- **Examples** for common scenarios
- **Token limit warnings**
- **Error prevention guidance**

### 2. What the LLM Sees

```javascript
{
  "name": "compress_code_context",
  "description": "Compress code files/directories to semantic summaries (70-98% token reduction).

CRITICAL - MCP RESPONSE LIMIT: Responses are limited to 25,000 tokens.
For directories, ALWAYS use pagination or format=\"summary\" first.

USAGE PATTERNS:
1. SINGLE FILE: No special handling needed
   Example: {path: \"src/main.py\", level: \"full\"}

2. SMALL DIRECTORY (<20 files): Safe without pagination
   Example: {path: \"src/utils/\", level: \"full\"}

3. LARGE DIRECTORY (>20 files): REQUIRED - Use one of these strategies:
   Strategy A - Summary First (RECOMMENDED):
   Step 1: {path: \"large-dir/\", format: \"summary\"} → See all files (~2K tokens)
   Step 2: {path: \"large-dir/\", level: \"minimal\", limit: 30} → Compress batch
   Step 3: {path: \"large-dir/\", limit: 30, offset: 30} → Next batch

WHEN TO USE:
✓ Exploring codebases
✓ Understanding architecture
... [full guidance]",
  "inputSchema": {
    "properties": {
      "path": {
        "description": "Path to file or directory. For directories with many files,
        MUST use limit parameter to avoid exceeding 25K token response limit."
      },
      "limit": {
        "description": "CRITICAL FOR DIRECTORIES: Maximum files to process.
        REQUIRED for directories with >20 files.
        RECOMMENDED VALUES: level=minimal → limit=50, level=full → limit=20"
      }
      // ... more parameters with detailed guidance
    }
  }
}
```

### 3. Intelligent Error Messages

If the LLM makes a mistake, the error message teaches it how to fix the issue:

**Example - Large directory without pagination:**

```
ERROR: Directory contains 347+ files without pagination.

This will likely exceed the 25,000 token MCP response limit.

SOLUTION - Choose one:

1. Get summary first (RECOMMENDED):
   {path: "fib-rag/", format: "summary"}
   → See file count and stats (~2K tokens)

2. Use pagination:
   {path: "fib-rag/", level: "minimal", limit: 30}
   → Process first 30 files

DO NOT retry without pagination or format="summary".
```

**Example - Response too large:**

```
ERROR: Response too large (~45000 tokens, limit is 25,000).

SOLUTION - Use pagination:

1. Try format="summary" first:
   {path: "large-project/", format: "summary"}

2. Or reduce batch size:
   Current: {limit: 50}
   Try: {limit: 25}

3. Or use higher compression:
   Current: {level: "full"}
   Try: {level: "minimal"}
```

## Benefits

### 1. Zero Configuration
- **No system prompt edits needed**
- Works immediately after installation
- Updates automatically when server is updated

### 2. Self-Learning
- LLM learns from error messages
- Adapts behavior based on feedback
- Improves over multiple interactions

### 3. Consistent Behavior
- All MCP clients get same instructions
- No version drift between documentation and server
- Single source of truth

### 4. Maintainability
- Update guidance once (in server code)
- No separate documentation to sync
- Changes deploy with server updates

## Comparison: Before vs After

### ❌ Before (Required Manual Setup)

**Step 1:** User installs MCP server
```bash
npm install -g ucpl-compress-mcp
```

**Step 2:** User adds to Claude Desktop config
```json
{
  "mcpServers": {
    "ucpl-compress": {"command": "ucpl-compress-mcp"}
  }
}
```

**Step 3:** User copies documentation to system prompt
```markdown
## Code Compression Tool (ucpl-compress MCP)

You have access to the `compress_code_context` tool...

**IMPORTANT FOR LARGE DIRECTORIES**: MCP responses are limited to 25,000 tokens...

[500+ words of instructions]
```

**Result:** ❌ Error-prone, inconsistent, outdated documentation

---

### ✅ After (Fully Automatic)

**Step 1:** User installs MCP server
```bash
npm install -g ucpl-compress-mcp
```

**Step 2:** User adds to Claude Desktop config
```json
{
  "mcpServers": {
    "ucpl-compress": {"command": "ucpl-compress-mcp"}
  }
}
```

**Step 3:** Done! ✨

**Result:** ✅ LLM automatically understands how to use the tool

## Design Principles

### 1. Embedded Documentation
All usage guidance is in the tool schema itself:
- Tool description → Usage patterns and examples
- Parameter descriptions → Recommendations and warnings
- Error messages → Corrective instructions

### 2. Progressive Disclosure
- Essential info in tool description
- Detailed guidance in parameter descriptions
- Specific corrections in error messages

### 3. Actionable Guidance
Every message includes:
- **What went wrong** (diagnosis)
- **Why it matters** (context)
- **How to fix it** (solution with examples)
- **What not to do** (prevent repeated errors)

### 4. Token-Aware Design
Tool descriptions are concise but complete:
- ~800 tokens for full tool definition
- Cached by MCP client (sent once per session)
- Minimal overhead compared to benefits

## Implementation Details

### Tool Schema Structure

```javascript
{
  name: 'tool_name',

  // 1. DESCRIPTION: Core usage patterns (200-400 words)
  description: `
    What it does + key constraints

    CRITICAL WARNINGS

    USAGE PATTERNS (with examples)

    WHEN TO USE / WHEN NOT TO USE

    Supported features
  `,

  // 2. PARAMETERS: Detailed per-parameter guidance
  inputSchema: {
    properties: {
      param1: {
        // RECOMMENDATION, WARNING, examples, defaults
        description: "Detailed guidance..."
      }
    }
  }
}
```

### Error Message Template

```javascript
`ERROR: [What went wrong]

[Why this is a problem]

SOLUTION - [Choose one | Use this]:

1. [Option 1 with example]
   {exact: "parameters"}
   → Expected result

2. [Option 2 with example]
   {exact: "parameters"}

[Prevention note]`
```

### Proactive Checks

The server prevents common mistakes:

```javascript
// 1. Pre-execution validation
if (isDirectory && !args.limit && fileCount > 20) {
  return {error: "Use pagination guidance..."};
}

// 2. Post-execution size check
if (estimatedTokens > 25000) {
  return {error: "Response too large guidance..."};
}

// 3. Path validation with hints
if (pathNotFound) {
  return {error: "Path not found + troubleshooting..."};
}
```

## For MCP Server Developers

### Making Your MCP Server Self-Documenting

**1. Rich Tool Descriptions:**
```javascript
description: `Brief summary.

CRITICAL: [Key constraints]

USAGE PATTERNS:
1. [Common case]: Example
2. [Edge case]: Example

WHEN TO USE:
✓ [Good use case]
✗ [Bad use case]`
```

**2. Detailed Parameter Descriptions:**
```javascript
param: {
  description: "What it does. RECOMMENDATION: [Best practice].
  REQUIRED when [condition]. Default: [value]"
}
```

**3. Instructive Error Messages:**
```javascript
catch (error) {
  return {
    error: `ERROR: ${what}

    ${why}

    SOLUTION:
    1. ${howToFix}

    ${preventionTip}`
  };
}
```

**4. Proactive Validation:**
```javascript
// Check before expensive operations
if (wouldFail) {
  return instructiveError();
}
```

## Testing Self-Documentation

### Manual Test

```bash
# Start the server
node server.js

# Send tools/list request
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node server.js

# Verify response contains:
# - Detailed description
# - Usage examples
# - Parameter guidance
# - Token limit warnings
```

### Integration Test

```python
# Test with an LLM
response = llm.query_tools()
tool = response['tools'][0]

assert 'CRITICAL' in tool['description']
assert 'USAGE PATTERNS' in tool['description']
assert 'Example:' in tool['description']
assert 'RECOMMENDED' in tool['inputSchema']['properties']['limit']['description']
```

## Recommended vs Optional Documentation

### ✅ Keep in Tool Schema (Self-Documenting)
- Core usage patterns
- Common examples
- Critical warnings
- Parameter recommendations
- Token/size limits

### 📄 Keep in Separate Docs (Reference)
- Installation instructions
- Configuration examples
- Troubleshooting guides
- Advanced use cases
- Architecture details
- Performance benchmarks

## Future Enhancements

1. **Dynamic Examples**: Generate examples based on user's working directory
2. **Usage Analytics**: Track common errors and update guidance
3. **Context-Aware Tips**: Adapt recommendations based on file counts
4. **Interactive Help**: `{path: "help"}` returns detailed examples
5. **Version Hints**: Include tool version in responses for debugging

## Migration Guide

If you previously used the system prompt snippet:

**Old Way:**
```markdown
~/.claude/CLAUDE.md or project CLAUDE.md:

## Code Compression Tool (ucpl-compress MCP)
[400+ words of instructions]
```

**New Way:**
```markdown
~/.claude/CLAUDE.md or project CLAUDE.md:

(Empty - no changes needed!)
```

The MCP server now handles everything automatically. You can safely remove the old system prompt snippet.

## Summary

**Key Insight:** The MCP protocol's tool discovery mechanism is the perfect place to embed comprehensive usage documentation. By leveraging tool descriptions, parameter descriptions, and error messages, we can create a fully self-documenting tool that requires zero manual configuration.

**Benefits:**
- ✅ Zero setup beyond installation
- ✅ Always up-to-date
- ✅ Consistent across clients
- ✅ Self-correcting via error messages
- ✅ No token overhead (cached by MCP)

**Result:** Users install the MCP server, and it "just works" - no tutorials needed.
