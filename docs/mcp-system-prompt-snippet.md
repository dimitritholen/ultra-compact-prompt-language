## Code Compression Tool (ucpl-compress MCP)

You have access to the `compress_code_context` tool via the ucpl-compress MCP server. This tool compresses code files/directories into semantic summaries with 70-98% token reduction while preserving meaning.

**IMPORTANT FOR LARGE DIRECTORIES**: MCP responses are limited to 25,000 tokens. When compressing directories, ALWAYS use pagination:

- Use `limit: 10-50` for initial exploration
- Use `format: "summary"` to see file list and stats without content
- Use `offset` parameter to paginate through results

### When to Use (Automatic Invocation)

**✅ USE for:**

- **Codebase exploration**: "What does src/auth/ do?", "Where is the payment logic?"
- **Architecture understanding**: Understanding structure without implementation details
- **API discovery**: Finding available functions/classes/methods
- **Large codebases**: Projects >5,000 lines or when context approaches 50K tokens
- **Multi-file analysis**: Understanding relationships across multiple modules
- **Initial investigation**: Before diving into specific file edits

**❌ DO NOT USE for:**

- **Code modification/writing**: Always read full files when editing code
- **Bug fixes**: Need exact implementation to debug correctly
- **Security audits**: Vulnerabilities hide in implementation details
- **Algorithm debugging**: Need precise logic flow
- **Test writing**: Requires understanding exact behavior
- **Small files**: <500 lines (overhead not worth it)

### Compression Levels

Choose level based on task depth:

- `full` (70-80% reduction): Signatures + docstrings + key logic → Default for exploration
- `signatures` (80-85% reduction): Signatures + types only → API surface understanding
- `minimal` (85-90% reduction): Names only → High-level architecture overview

### Usage Pattern

**Two-Phase Workflow** (Recommended):

1. **Exploration Phase**: Compress directories/files to understand structure
2. **Implementation Phase**: Read full files when ready to modify

**Example Session:**

```
User: "Understand the authentication flow in this codebase"

Claude:
1. compress_code_context(path="src/", format="summary", limit=50) → Get overview + stats
2. compress_code_context(path="src/auth/", level="full", limit=20) → Understand auth module
3. compress_code_context(path="src/auth/", offset=20, limit=20) → Next batch if needed
4. Read full files (src/auth/authenticator.py) → If modifications needed
```

**Pagination Strategy for Large Directories:**

```
Step 1: Get overview (summary format shows ALL files without content)
  compress_code_context(path="large-project/", format="summary")
  → Returns: File list + token stats (lightweight response)

Step 2: Compress files in batches
  compress_code_context(path="large-project/", level="minimal", limit=20, offset=0)
  → Files 1-20 compressed

Step 3: Continue pagination if needed
  compress_code_context(path="large-project/", limit=20, offset=20)
  → Files 21-40 compressed

Step 4: Deep dive on specific files
  Read individual files for modification
```

### File Filtering

Use `include`/`exclude` for selective compression:

- `include`: ["*.py", "src/**/*.js"] → Only these patterns
- `exclude`: ["**/test_*", "**/**pycache**"] → Skip tests/caches

### Decision Tree

```
User asks question about code
    ↓
Is it exploratory? ("What/Where/How is X organized?")
    ↓ YES
    Is it a directory with many files?
        ↓ YES
        Use compress_code_context with limit=10-50 (or format="summary")
        ↓ NO
        Use compress_code_context with appropriate level
    ↓ NO
Does user need to modify code?
    ↓ YES
    Read full file (DO NOT compress)
    ↓ NO
Is codebase >5K lines OR context >50K tokens?
    ↓ YES
    Use compression with pagination (limit parameter)
    ↓ NO
    Read full file normally
```

### Parameters

- **path** (required): File or directory path
- **level** (optional): `full` (default), `signatures`, `minimal`
- **format** (optional): `text` (default), `summary`, `json`
- **limit** (optional): Max files to process (10-50 recommended for directories)
- **offset** (optional): Skip first N files (for pagination)
- **include** (optional): Array of glob patterns to include
- **exclude** (optional): Array of glob patterns to exclude

### Key Principle

**Compress for understanding, read full for modification.** The compressed output is designed for LLMs to read directly—you don't need to "decompress" it, just process the semantic summary naturally.

````

---

## Installation Instructions for Users

If users want to enable this MCP server, they need to:

1. **Install the MCP server:**
   ```bash
   npm install -g ucpl-compress-mcp
````

2. **Configure Claude Desktop** (add to `~/Library/Application Support/Claude/claude_desktop_config.json`):

   ```json
   {
     "mcpServers": {
       "ucpl-compress": {
         "command": "ucpl-compress-mcp"
       }
     }
   }
   ```

3. **Add the prompt snippet above** to your system prompt in `~/.claude/CLAUDE.md`

4. **Restart Claude Desktop**

---

## Example Use Cases

### Use Case 1: New Developer Onboarding

```
User: "I'm new to this codebase, what does it do?"

Claude uses: compress_code_context(path=".", level="minimal")
→ Gets high-level structure (85-90% token savings)
→ Responds with architecture overview
```

### Use Case 2: Finding the Right File

```
User: "Where is the user authentication logic?"

Claude uses: compress_code_context(path="src/", level="signatures")
→ Scans all files for auth-related functions (80-85% savings)
→ Points to specific files
```

### Use Case 3: Cost Optimization

```
User: "Review all API endpoints for consistency"

Claude uses: compress_code_context(path="api/", level="full", exclude=["**/test_*"])
→ Reviews all endpoints with 70-80% fewer tokens
→ Significant cost savings for large codebases
```

### Use Case 4: Two-Phase Implementation

```
User: "Add rate limiting to our API"

Phase 1 (Exploration):
  compress_code_context(path="api/", level="full")
  → Understand existing patterns

Phase 2 (Implementation):
  Read api/middleware.py (full file)
  → Write actual code with full context
```

---

## Notes for LLM Providers

- **Auto-detection works**: Language is auto-detected from file extensions
- **Glob patterns**: Use standard glob syntax (\*, \*\*, ?)
- **Error handling**: Tool gracefully handles non-existent paths
- **Format options**: Use `format="summary"` to get just statistics without content
- **Memory efficient**: Processes files incrementally, no size limits

---

## Version Info

- UCPL-Compress MCP: v2.0+
- Supported Languages: Python, JavaScript, TypeScript, Java, Go, C#, PHP, Rust, Ruby, C++, PowerShell, Bash, JSON, YAML, Markdown, Plain Text
- Model Context Protocol: Compatible with Claude Desktop, Claude Code, Codex, and all MCP clients
