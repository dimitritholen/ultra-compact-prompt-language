# UCPL Compress MCP Server

Model Context Protocol (MCP) server that provides code context compression as a tool for Claude Desktop, Claude Code, Codex, and other MCP-compatible clients.

## Features

- **70-98% token reduction** for code context
- **Semantic compression** - LLM reads directly without decompression
- **16 language support**: Python, JavaScript, TypeScript, Java, Go, C#, PHP, Rust, Ruby, C++, PowerShell, Bash/Shell, JSON, YAML, Markdown, Plain Text
- **3 compression levels**: full, signatures, minimal
- **Universal MCP compatibility**: Works with any MCP client

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

### Codex / Other MCP Clients

Refer to your client's MCP server configuration documentation. Use the same pattern:

```json
{
  "command": "ucpl-compress-mcp"
}
```

## Usage

Once configured, the MCP tool `compress_code_context` becomes available to your LLM client.

### Tool Parameters

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
