# UCPL Compress MCP Server

Model Context Protocol (MCP) server that provides code context compression as a tool for Claude Desktop, Claude Code, Codex, and other MCP-compatible clients.

## Features

- **🎉 Self-Documenting**: No system prompt configuration needed - LLMs automatically understand how to use it
- **🛡️ Intelligent Error Handling**: Proactive checks and instructive error messages prevent common mistakes
- **✨ MCP 2025 Compliant**: 100% discoverability score with enhanced schema validation
- **📊 Token Savings Statistics**: Track REAL token savings with accurate token counting (not estimates)
- **📄 70-98% token reduction** for code context
- **🧠 Semantic compression** - LLM reads directly without decompression
- **📈 Pagination support** - Handle directories of any size with automatic batching
- **🌍 16 language support**: Python, JavaScript, TypeScript, Java, Go, C#, PHP, Rust, Ruby, C++, PowerShell, Bash/Shell, JSON, YAML, Markdown, Plain Text
- **⚙️ 3 compression levels**: full, signatures, minimal
- **🔌 Universal MCP compatibility**: Works with any MCP client

## Installation

### Quick Start (Recommended)

Install globally via npm:

```bash
npm install -g ucpl-compress-mcp
```

That's it! The package includes both the MCP server and compression CLI.

### Prerequisites

- **Node.js 16+** installed
- **Python 3.7+** (for the compression engine)

### Alternative: Install from Source

If you want to install from this repository:

```bash
cd mcp-server
npm install -g .
```

## Configuration

### Claude Desktop

Add to your config file:
- Linux/Mac: `~/.config/claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ucpl-compress": {
      "command": "ucpl-compress-mcp"
    }
  }
}
```

**That's all!** No absolute paths, no manual setup.

### Claude Code

Claude Code automatically detects MCP servers configured in Claude Desktop. No additional configuration needed.

---

## 🎉 No System Prompt Configuration Needed

The MCP server is **fully self-documenting** with enhanced schema discoverability. When an LLM queries available tools, it receives:
- Comprehensive usage instructions with validation constraints
- Rich enum options with titles and descriptions
- Output schema documentation
- Tool annotations (read-only hints, priority, etc.)
- Pagination guidelines and token limit warnings
- Best practices and common examples

**You don't need to add anything to your system prompt!** See [docs/MCP-SELF-DOCUMENTING.md](../docs/MCP-SELF-DOCUMENTING.md) for details.

### What's New in v1.2 (2025-11-05)

**Enhanced Discoverability** - Achieved 100% discoverability score through:
- Tool description compressed from 676 → 216 chars (within MCP limit)
- All enums converted to `oneOf` pattern with rich descriptions
- Added comprehensive JSON Schema validation constraints
- Defined output schema for structured responses
- Added tool annotations (audience, priority, behavioral hints)
- All parameter descriptions compressed while maintaining clarity

See [docs/MCP-DISCOVERABILITY-IMPROVEMENTS.md](../docs/MCP-DISCOVERABILITY-IMPROVEMENTS.md) for technical details.

### Codex / Other MCP Clients

Refer to your client's MCP server configuration documentation. Use the same pattern:

```json
{
  "command": "ucpl-compress-mcp"
}
```

## Usage

Once configured, two MCP tools become available to your LLM client:

1. **`compress_code_context`** - Compress code files/directories
2. **`get_compression_stats`** - View token savings statistics

### Compression Tool Parameters

- **path** (required): File or directory path to compress
- **level** (optional): Compression level
  - `full` (default): 70-80% reduction, includes docstrings
  - `signatures`: 80-85% reduction, signatures + types only
  - `minimal`: 85-90% reduction, API surface only
- **language** (optional): Programming language (auto-detected if not specified)
  - Options: python, javascript, typescript, java, go, csharp, php, rust, ruby, cpp, powershell, shell, json, yaml, markdown, text
- **format** (optional): Output format
  - `summary` (default): Readable text
  - `json`: Structured JSON
  - `tree`: Hierarchical tree view

### Example Prompts

**In Claude Desktop:**

```
Compress src/main.py to understand its structure
```

Claude will automatically invoke:
```json
{
  "tool": "compress_code_context",
  "arguments": {
    "path": "src/main.py",
    "level": "full"
  }
}
```

**Advanced usage:**

```
Show me the minimal API surface of the entire src/ directory
```

Claude will invoke:
```json
{
  "tool": "compress_code_context",
  "arguments": {
    "path": "src/",
    "level": "minimal"
  }
}
```

### Token Savings Statistics

The server automatically tracks token savings for every compression with **100% accurate token counting** (not estimates) using the `js-tiktoken` library.

#### Viewing Statistics

Ask Claude:
```
Show me my compression statistics
```

Or be specific:
```
Show me compression stats for the last week with details
```

Claude will invoke:
```json
{
  "tool": "get_compression_stats",
  "arguments": {
    "period": "week",
    "includeDetails": true,
    "limit": 10
  }
}
```

#### Statistics Tool Parameters

- **period** (optional): Time period to filter
  - `all` (default): All time statistics
  - `today`: Last 24 hours
  - `week`: Last 7 days
  - `month`: Last 30 days
- **includeDetails** (optional): Include individual compression records (default: false)
- **limit** (optional): Maximum records to show when includeDetails=true (default: 10, max: 100)

#### What Gets Tracked

For each compression, the following is recorded:
- **Timestamp**: When the compression occurred
- **Path**: File or directory that was compressed
- **Original tokens**: ACTUAL token count before compression (using tiktoken)
- **Compressed tokens**: ACTUAL token count after compression
- **Tokens saved**: Difference (original - compressed)
- **Compression ratio**: Compressed / Original (e.g., 0.25 = 75% reduction)
- **Savings percentage**: (Tokens saved / Original) × 100
- **Compression level**: full, signatures, or minimal
- **Format**: text, summary, or json

Statistics are stored in `~/.ucpl/compress/compression-stats.json` (cross-platform user home directory) and persist across sessions.

#### Example Output

```markdown
## Compression Statistics (Last 7 Days)

**Summary:**
- Total Compressions: 15
- Original Tokens: 125,450
- Compressed Tokens: 28,320
- Tokens Saved: 97,130
- Average Compression Ratio: 0.226x
- Average Savings: 77.4%

**Recent Compressions (showing 5 of 15):**

### /home/user/project/src/auth.py
- Date: 11/5/2025, 2:30:15 PM
- Level: full, Format: text
- Original: 8,450 tokens
- Compressed: 2,010 tokens
- Saved: 6,440 tokens (76.2%)

### /home/user/project/src/database/
- Date: 11/5/2025, 1:15:42 PM
- Level: minimal, Format: summary
- Original: 42,300 tokens
- Compressed: 5,120 tokens
- Saved: 37,180 tokens (87.9%)
```

## Workflow Integration

### Seamless Context Compression

1. **User asks about code**: "What does src/auth/ do?"
2. **Claude automatically compresses**: Uses `compress_code_context` tool on src/auth/
3. **Claude reads compressed context**: Gets 70-90% fewer tokens
4. **Claude responds**: Answers question with full semantic understanding

### Benefits

- **Larger codebases fit in context**: Compress 100K tokens → 10-20K tokens
- **Faster responses**: Less context = faster processing
- **Lower costs**: Fewer input tokens = lower API costs
- **No manual steps**: Compression happens automatically when needed

## Troubleshooting

### Server not appearing in Claude Desktop

1. **Verify installation:**
   ```bash
   which ucpl-compress-mcp  # Should show path
   ucpl-compress-mcp --version  # Should not error
   ```

2. **Check config file location:**
   - Linux/Mac: `~/.config/claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

3. **Verify config syntax:**
   ```json
   {
     "mcpServers": {
       "ucpl-compress": {
         "command": "ucpl-compress-mcp"
       }
     }
   }
   ```

4. **Restart Claude Desktop** after config changes

5. **Check logs** (location varies by client):
   - Claude Desktop: `~/.config/claude/logs/` or `%APPDATA%\Claude\logs\`

### Tool execution fails

1. **Verify Python is installed:**
   ```bash
   python3 --version  # Should be 3.7+
   ```

2. **Test the compression CLI:**
   ```bash
   # Find where it's installed
   npm list -g ucpl-compress-mcp

   # Test manually
   cd /your/project
   ucpl-compress-mcp  # Should show it's waiting for input
   ```

3. **Reinstall if needed:**
   ```bash
   npm uninstall -g ucpl-compress-mcp
   npm install -g ucpl-compress-mcp
   ```

4. **Check file paths are accessible** from the working directory

## Technical Details

### Protocol

- **MCP Version**: 2024-11-05
- **Transport**: stdio (JSON-RPC over standard input/output)
- **Methods supported**:
  - `initialize`: Server initialization
  - `tools/list`: List available tools
  - `tools/call`: Execute tool

### Architecture

```
┌─────────────────┐
│  Claude Desktop │
│   Claude Code   │
│  Codex/Gemini   │
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

### Performance

- **Startup time**: ~50ms (Node.js process)
- **Compression time**: 100-500ms per file (depends on size)
- **Memory usage**: ~50MB (Node.js + Python processes)

## Development

### Testing the server

```bash
# Start server manually
node mcp-server/server.js

# Send test request (in another terminal)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node mcp-server/server.js

# Expected output:
# {"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}
```

### Debugging

Enable debug logging:

```javascript
// Add to server.js
console.error('DEBUG:', message);  // Logs to stderr (visible in client logs)
```

## License

MIT

## Related

- [UCPL Documentation](../README.md)
- [Context Compression Research](../docs/CONTEXT-COMPRESSION.md)
- [ucpl-compress CLI Tool](../docs/UCPL-COMPRESS.md)
