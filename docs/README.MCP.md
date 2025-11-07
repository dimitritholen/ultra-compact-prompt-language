# UCPL-Compress MCP Server

Model Context Protocol server that provides **semantic code compression** for Claude Desktop, Claude Code, and other MCP-compatible clients.

## What It Does

Compresses code context by **70-98%** using semantic summaries that LLMs can read directly—no decompression needed.

Instead of sending this (850 tokens):

```python
class UserAuthenticator:
    """Handles user authentication with JWT tokens."""

    def __init__(self, secret_key: str, token_expiry: int = 3600):
        self.secret_key = secret_key
        self.token_expiry = token_expiry
        # ... 30 more lines
```

You send this (180 tokens):

```
# UserAuthenticator (auth/user.py:15-45)
Class: JWT-based user authentication
Methods:
- __init__(secret_key: str, token_expiry: int=3600)
- generate_token(user_id: int, email: str) -> str
- verify_token(token: str) -> Dict[str, Any]
```

**The LLM understands both equally well.**

## Key Features

- **70-98% token reduction** for code context
- **Semantic compression**: LLM reads directly without decompression
- **16 language support**: Python, JavaScript, TypeScript, Java, Go, C#, PHP, Rust, Ruby, C++, PowerShell, Bash, JSON, YAML, Markdown, Plain Text
- **3 compression levels**: full (70-80%), signatures (80-85%), minimal (85-90%)
- **File filtering**: Include/exclude patterns for selective compression
- **Universal compatibility**: Works with any MCP client

## Installation

### Quick Start

```bash
npm install -g ucpl-compress-mcp
```

This installs both the MCP server and the CLI tool.

### Prerequisites

- Node.js 16+
- Python 3.7+

### Configuration

#### Claude Desktop

Add to `~/.config/claude/claude_desktop_config.json` (Linux/Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "ucpl-compress": {
      "command": "ucpl-compress-mcp"
    }
  }
}
```

Restart Claude Desktop.

#### Claude Code

Auto-detects MCP servers from Claude Desktop config. No additional setup needed.

#### Other MCP Clients

Refer to your client's documentation. Use the same pattern:

```json
{
  "command": "ucpl-compress-mcp"
}
```

## Usage

Once configured, Claude can automatically use the `compress_code_context` tool.

### Example Interactions

**User**: "What does src/auth/ do?"

**Claude**: _Automatically compresses src/auth/_ → Reads 10K tokens instead of 100K → "The auth module handles JWT authentication with UserAuthenticator and SessionManager classes..."

**User**: "Show me the API surface of the entire codebase"

**Claude**: _Compresses at 'minimal' level_ → Gets function signatures only → "Here are all the public APIs available..."

### Tool Parameters

- **path** (required): File or directory to compress
- **level** (optional): `full` (default), `signatures`, `minimal`
- **language** (optional): Auto-detected if omitted
- **format** (optional): `text` (default), `json`, `summary`
- **include** (optional): Glob patterns for files to include (e.g., `["*.py", "src/**/*.js"]`)
- **exclude** (optional): Glob patterns for files to exclude (e.g., `["**/test_*", "**/__pycache__"]`)

### CLI Usage

The global install also provides a standalone CLI:

```bash
# Basic usage (auto-detects language)
ucpl-compress src/main.py
ucpl-compress app.js --level minimal
ucpl-compress src/ --format summary

# File filtering
ucpl-compress src/ --include '*.py' --include '*.js'
ucpl-compress src/ --exclude '**/test_*' --exclude '**/__pycache__'
ucpl-compress src/ --include '*.py' --exclude '**/test_*.py'
```

## When to Use

### ✅ Ideal For

1. **Exploring large codebases**: Get 30,000-foot view before diving deep
2. **API surface understanding**: Learn interfaces without implementation details
3. **Context budget management**: Fit more code when hitting token limits
4. **Multi-file analysis**: Understand relationships across files
5. **Cost optimization**: 70-90% fewer tokens = lower API costs

### ❌ Not Suitable For

1. **Algorithm debugging**: Need exact implementation details
2. **Code modification**: Can't edit from summaries
3. **Security audits**: Vulnerabilities hide in details
4. **Performance optimization**: Need actual code for profiling
5. **Small codebases (<1000 lines)**: Overhead not worth it
6. **Test writing**: Need precise behavior understanding
7. **Documentation writing**: Need nuance and examples

See [USECASES.md](./USECASES.md) for detailed use case guidance.

## Compression Levels

| Level          | Reduction | What's Included                     | Use For                |
| -------------- | --------- | ----------------------------------- | ---------------------- |
| **full**       | 70-80%    | Signatures + docstrings + key logic | Detailed understanding |
| **signatures** | 80-85%    | Signatures + type hints only        | API exploration        |
| **minimal**    | 85-90%    | Function/class names only           | High-level structure   |

## Workflow Integration

### Two-Phase Approach (Recommended)

**Phase 1: Exploration (Compressed)**

```
"What does this project do?"
"Where is authentication handled?"
"Which modules depend on the database?"
```

→ Use compression to explore and orient

**Phase 2: Implementation (Full Code)**

```
"Fix the bug in auth/user.py:45"
"Refactor the calculate_discount function"
"Add error handling to API routes"
```

→ Read full files for actual work

### Smart Strategy

```
1. Compress src/ at 'minimal' → Understand structure
2. Compress auth/ at 'full' → See module details
3. Read auth/user.py fully → Edit specific file
```

## Architecture

```
┌─────────────────┐
│  Claude Desktop │
│   Claude Code   │
│     Codex       │
└────────┬────────┘
         │ MCP Protocol (JSON-RPC)
         │
┌────────▼────────┐
│  server.js      │  Node.js MCP Server
│  (MCP Handler)  │
└────────┬────────┘
         │ spawn()
         │
┌────────▼────────┐
│ ucpl-compress   │  Python compression script
│ (16 languages)  │
└─────────────────┘
```

## Performance

- **Startup**: ~50ms
- **Compression**: 100-500ms per file
- **Memory**: ~50MB (Node.js + Python)

## Troubleshooting

### Server not appearing

1. Verify installation: `which ucpl-compress-mcp`
2. Check config file location and syntax
3. Restart Claude Desktop
4. Check logs: `~/.config/claude/logs/`

### Tool execution fails

1. Verify Python: `python3 --version` (should be 3.7+)
2. Test CLI manually: `ucpl-compress --version`
3. Reinstall: `npm uninstall -g ucpl-compress-mcp && npm install -g ucpl-compress-mcp`
4. Check file paths are accessible

## Technical Details

- **MCP Version**: 2024-11-05
- **Transport**: stdio (JSON-RPC)
- **Methods**: `initialize`, `tools/list`, `tools/call`

## Development

### Testing the server

```bash
# Start server manually
node mcp-server/server.js

# Send test request
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node mcp-server/server.js
```

### Debugging

Add to `server.js`:

```javascript
console.error("DEBUG:", message); // Logs to stderr
```

## Limitations

1. **Not for editing**: Can't modify code from compressed view
2. **Details matter tasks**: Security audits, debugging need full code
3. **Lossy compression**: Implementation details are summarized
4. **Overhead for small files**: Not worth it for <1000 line codebases
5. **Language support**: Best with typed languages (Python, TypeScript, Java)

## Honest Assessment

**What it's great for**: Exploring codebases, understanding architecture, fitting more context

**What it's not for**: Actual code editing, debugging, security reviews

**Think of it as**: A map (compressed) vs. walking the street (full code). Use the right tool for the task.

## Related Resources

- [Context Compression Research](./CONTEXT-COMPRESSION.md)
- [Use Cases Guide](./USECASES.md)
- [CLI Tools Documentation](./CLI-TOOLS.md)

## Status

**Version**: 1.0.0
**Status**: Production-ready
**License**: MIT

---

**Best practice**: Compress for context, read full code for work. Use compression strategically, not universally.
