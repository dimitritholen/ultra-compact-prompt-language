# UCPL Compress MCP Server

[![Tests](https://github.com/dimitritholen/ultra-compact-prompt-language/actions/workflows/test.yml/badge.svg)](https://github.com/dimitritholen/ultra-compact-prompt-language/actions/workflows/test.yml)
[![npm version](https://badge.fury.io/js/ucpl-compress-mcp.svg)](https://www.npmjs.com/package/ucpl-compress-mcp)
[![npm downloads](https://img.shields.io/npm/dm/ucpl-compress-mcp.svg)](https://www.npmjs.com/package/ucpl-compress-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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

### What's New in v1.3 (2025-01-06)

**Enhanced Statistics & Cost Tracking** - Comprehensive improvements to compression statistics:

- **Flexible Date Queries**: Query statistics using ISO dates, relative time ("7 days ago", "last week"), or simple day counts
- **Automatic LLM Detection**: Detects Claude Desktop, Claude Code, VSCode, and other clients via environment variables
- **Cost Tracking**: Calculates and tracks USD cost savings based on detected LLM model pricing
- **Model-Specific Breakdowns**: View per-model statistics showing which LLM you saved the most tokens (and money) on
- **Configuration System**: Override model detection with `~/.ucpl/compress/config.json`
- **Enhanced Error Messages**: Clear, actionable error messages for date parsing and configuration issues

**Pricing Support for 7 LLM Models**:

- Claude Sonnet 4 ($3.00/M tokens) - Claude Opus 4 ($15.00/M tokens)
- GPT-4o ($2.50/M tokens) - GPT-4o Mini ($0.15/M tokens)
- Gemini 2.0 Flash ($0.10/M tokens)
- OpenAI o1 ($15.00/M tokens) - OpenAI o1-mini ($3.00/M tokens)

See [TEST-COVERAGE-REPORT.md](./TEST-COVERAGE-REPORT.md) for implementation details and test coverage.

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

The server automatically tracks token savings for every compression with **100% accurate token counting** (not estimates) using the `js-tiktoken` library. Now includes **automatic LLM detection** and **USD cost savings tracking** for 7 popular AI models.

#### Viewing Statistics - Natural Language Examples

The statistics tool now supports flexible date queries using ISO dates, relative time, or simple day counts. Here are 15+ ways to query your stats:

**Simple Queries (using presets):**

```
Show me my compression statistics
Show me stats for today
Show me compression stats for the last week
Show me monthly compression data
```

**Relative Time Queries:**

```
Show me compressions from the last 7 days
Show me stats from 2 weeks ago until now
What did I compress in the last 30 days?
Show me compressions from yesterday
```

**ISO Date Range Queries:**

```
Show me compressions from 2025-01-01 to 2025-01-06
Show me stats for January 2025
What did I save between 2024-12-15 and 2025-01-01?
```

**Natural Language Time Expressions:**

```
Show me compressions from last week
What did I compress 3 days ago?
Show me stats from the beginning of the month
```

**Cost-Focused Queries:**

```
How much money have I saved with compressions?
Show me cost savings by model
What's my total cost savings this month?
```

**Detailed Analysis:**

```
Show me detailed compression records for the last 10 days
Give me stats with individual compression details
Show me the last 20 compression operations
```

#### Statistics Tool Parameters

The tool supports three ways to specify date ranges (in priority order):

**1. Simple Day Count** (easiest):

- **relativeDays** (optional): Number of days to look back from now
  - Example: `relativeDays: 7` = last 7 days
  - Must be between 1 and 365

**2. Custom Date Range** (flexible):

- **startDate** (optional): Start date for filtering
  - Accepts ISO format: `"2025-01-01"` or `"2025-01-01T10:00:00Z"`
  - Accepts relative time: `"2 hours ago"`, `"yesterday"`, `"last week"`
  - If omitted: no start boundary (queries from beginning of time)
- **endDate** (optional): End date for filtering
  - Accepts same formats as startDate
  - If omitted: defaults to current time

**3. Legacy Presets** (backward compatible):

- **period** (optional): Time period preset
  - `all` (default): All time statistics
  - `today`: Last 24 hours
  - `week`: Last 7 days
  - `month`: Last 30 days

**Display Options:**

- **includeDetails** (optional): Include individual compression records (default: false)
- **limit** (optional): Maximum records to show when includeDetails=true (default: 10, max: 100)

#### What Gets Tracked

For each compression, the following is recorded:

**Token Metrics:**

- **Timestamp**: When the compression occurred
- **Path**: File or directory that was compressed
- **Original tokens**: ACTUAL token count before compression (using tiktoken)
- **Compressed tokens**: ACTUAL token count after compression
- **Tokens saved**: Difference (original - compressed)
- **Compression ratio**: Compressed / Original (e.g., 0.25 = 75% reduction)
- **Savings percentage**: (Tokens saved / Original) × 100
- **Compression level**: full, signatures, or minimal
- **Format**: text, summary, or json

**Cost Tracking (NEW in v1.3):**

- **Model**: Detected LLM model (e.g., "claude-sonnet-4", "gpt-4o")
- **Client**: Detected client name (e.g., "claude-desktop", "claude-code")
- **Price per M tokens**: Current pricing for the detected model
- **Cost savings USD**: Actual dollar savings based on tokens saved and model pricing
- **Currency**: Always "USD"

**Summary Statistics (NEW in v1.3):**

- **Total cost savings USD**: Aggregate cost savings across all compressions
- **Average cost per compression**: Mean cost savings per compression operation
- **Model breakdown**: Per-model statistics showing:
  - Model name and pricing
  - Number of compressions
  - Total tokens saved
  - Total cost savings for that model
- **Records with/without cost**: Count of records with cost tracking (post-v1.3) vs legacy records

Statistics are stored in `~/.ucpl/compress/compression-stats.json` (cross-platform user home directory) and persist across sessions.

**Note:** The statistics file path is hardcoded and cannot be configured via environment variables. This ensures consistent behavior across all MCP clients and simplifies debugging.

#### Example Output (with Cost Tracking)

```markdown
## Compression Statistics (Last 7 Days)

**Summary:**

- Total Compressions: 15
- Original Tokens: 125,450
- Compressed Tokens: 28,320
- Tokens Saved: 97,130
- Average Compression Ratio: 0.226x
- Average Savings: 77.4%

**Cost Savings (NEW):**

- Total Cost Savings: $0.29 USD
- Average Cost per Compression: $0.019 USD
- Detected Model: Claude Sonnet 4 ($3.00/M tokens)

**Model Breakdown:**

- Claude Sonnet 4: 15 compressions, 97,130 tokens saved, $0.29 USD saved
- Records with cost tracking: 15/15 (100%)

**Recent Compressions (showing 5 of 15):**

### /home/user/project/src/auth.py

- Date: 1/6/2025, 2:30:15 PM
- Level: full, Format: text
- Original: 8,450 tokens
- Compressed: 2,010 tokens
- Saved: 6,440 tokens (76.2%)
- Cost Savings: $0.019 USD
- Model: Claude Sonnet 4 ($3.00/M tokens)

### /home/user/project/src/database/

- Date: 1/6/2025, 1:15:42 PM
- Level: minimal, Format: summary
- Original: 42,300 tokens
- Compressed: 5,120 tokens
- Saved: 37,180 tokens (87.9%)
- Cost Savings: $0.112 USD
- Model: Claude Sonnet 4 ($3.00/M tokens)
```

## Configuration

### Automatic LLM Detection

The server automatically detects which LLM client you're using to provide accurate cost tracking. Detection happens once per server lifecycle and is cached for performance.

**Detection Methods (in priority order):**

1. **Config File Override** (highest priority)
   - Location: `~/.ucpl/compress/config.json`
   - Allows manual model specification

2. **Environment Variables**:
   - `CLAUDE_DESKTOP_VERSION` → Claude Desktop (uses Claude Sonnet 4)
   - `VSCODE_PID` or `CLINE_VERSION` → Claude Code/VSCode (uses Claude Sonnet 4)
   - `ANTHROPIC_MODEL` → Custom Anthropic model
   - `OPENAI_MODEL` → Custom OpenAI model

3. **Default Fallback**:
   - If no client detected, defaults to Claude Sonnet 4 ($3.00/M tokens)

**Example Detection Log** (visible in MCP server logs):

```
[INFO] Detected Claude Desktop (version: 1.2.3)
[INFO] Using model: claude-sonnet-4
```

### Manual Model Configuration

Create a config file to override automatic detection:

**File Location:** `~/.ucpl/compress/config.json`

**Example Configuration:**

```json
{
  "model": "gpt-4o"
}
```

**Supported Models:**
| Model ID | Name | Price per M tokens |
|----------|------|-------------------|
| `claude-sonnet-4` | Claude Sonnet 4 | $3.00 |
| `claude-opus-4` | Claude Opus 4 | $15.00 |
| `gpt-4o` | GPT-4o | $2.50 |
| `gpt-4o-mini` | GPT-4o Mini | $0.15 |
| `gemini-2.0-flash` | Gemini 2.0 Flash | $0.10 |
| `o1` | OpenAI o1 | $15.00 |
| `o1-mini` | OpenAI o1-mini | $3.00 |

**Steps to Configure:**

1. Create the config directory:

   ```bash
   mkdir -p ~/.ucpl/compress
   ```

2. Create the config file:

   ```bash
   echo '{"model": "gpt-4o"}' > ~/.ucpl/compress/config.json
   ```

3. Restart your MCP client (Claude Desktop, Claude Code, etc.)

4. Verify in logs:
   ```
   [INFO] Using model from config file: gpt-4o
   ```

**Invalid Config Fallback:**
If the config file exists but contains an invalid model ID, the server will:

1. Log a warning: `[WARN] Unknown model in config: xyz, falling back to env detection`
2. Continue with environment variable detection
3. If no env vars found, use default model

**Config Schema:**

```json
{
  "type": "object",
  "properties": {
    "model": {
      "type": "string",
      "enum": [
        "claude-sonnet-4",
        "claude-opus-4",
        "gpt-4o",
        "gpt-4o-mini",
        "gemini-2.0-flash",
        "o1",
        "o1-mini"
      ],
      "description": "LLM model to use for cost calculations"
    }
  },
  "required": ["model"]
}
```

### Environment Variables for Custom Models

If you're using a custom client or want to set the model via environment variables:

**For Anthropic Models:**

```bash
export ANTHROPIC_MODEL="claude-sonnet-4"
```

**For OpenAI Models:**

```bash
export OPENAI_MODEL="gpt-4o"
```

**Note:** Config file always takes precedence over environment variables.

## Workflow Integration

### Seamless Context Compression

1. **User asks about code**: "What does src/auth/ do?"
2. **Claude automatically compresses**: Uses `compress_code_context` tool on src/auth/
3. **Claude reads compressed context**: Gets 70-90% fewer tokens
4. **Claude responds**: Answers question with full semantic understanding

### Benefits

- **Larger codebases fit in context**: Compress 100K tokens → 10-20K tokens
- **Faster responses**: Less context = faster processing
- **Lower costs**: Fewer input tokens = lower API costs (now tracked automatically!)
- **No manual steps**: Compression happens automatically when needed
- **Transparent cost tracking**: See exactly how much you're saving with each compression

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

### LLM Detection Issues (NEW)

**Problem:** Cost tracking shows "unknown" model or incorrect pricing

**Solutions:**

1. **Check detection in server logs:**

   ```
   [INFO] Detected Claude Desktop (version: 1.2.3)
   [INFO] Using model: claude-sonnet-4
   ```

2. **Verify environment variables:**

   ```bash
   # For Claude Desktop
   echo $CLAUDE_DESKTOP_VERSION

   # For Claude Code / VSCode
   echo $VSCODE_PID
   echo $CLINE_VERSION

   # Custom model overrides
   echo $ANTHROPIC_MODEL
   echo $OPENAI_MODEL
   ```

3. **Check config file (if using manual override):**

   ```bash
   cat ~/.ucpl/compress/config.json
   ```

   Should contain valid JSON:

   ```json
   {
     "model": "claude-sonnet-4"
   }
   ```

4. **Verify model ID is supported:**
   - Valid IDs: `claude-sonnet-4`, `claude-opus-4`, `gpt-4o`, `gpt-4o-mini`, `gemini-2.0-flash`, `o1`, `o1-mini`
   - Check server.js line 35-43 for full MODEL_PRICING list

5. **If detection fails, create config file:**

   ```bash
   mkdir -p ~/.ucpl/compress
   echo '{"model": "claude-sonnet-4"}' > ~/.ucpl/compress/config.json
   ```

6. **Restart MCP client** after config changes

### Date Query Parsing Issues (NEW)

**Problem:** Error when using custom date ranges like "Show me stats from last week"

**Common Issues & Solutions:**

1. **Invalid date format:**

   ```
   Error: Invalid date format: "xyz"
   ```

   **Fix:** Use supported formats:
   - ISO: `"2025-01-01"` or `"2025-01-01T10:00:00Z"`
   - Relative: `"7 days ago"`, `"yesterday"`, `"last week"`
   - Simple: Use `relativeDays: 7` parameter instead

2. **Date range backwards (startDate > endDate):**

   ```
   Error: Invalid date range: startDate is after endDate
   ```

   **Fix:** Ensure startDate comes before endDate:

   ```json
   {
     "startDate": "2025-01-01",
     "endDate": "2025-01-06"
   }
   ```

3. **relativeDays out of range:**

   ```
   Error: relativeDays must be a number between 1 and 365
   ```

   **Fix:** Use value between 1-365:

   ```json
   {
     "relativeDays": 30
   }
   ```

4. **Ambiguous natural language:**

   ```
   [WARN] Could not parse relative time: "sometime last year"
   ```

   **Fix:** Use more specific expressions:
   - "7 days ago" (not "a week ago")
   - "30 days ago" (not "last month")
   - Or use ISO dates for precision

5. **Future endDate warning:**

   ```
   [WARN] endDate is in the future, using current time instead
   ```

   **Fix:** This is not an error - server automatically adjusts to current time

### Cost Tracking Shows Zero (NEW)

**Problem:** Statistics show `costSavingsUSD: 0` or cost fields are missing

**Possible Causes:**

1. **Legacy statistics (pre-v1.3):**
   - Compressions done before v1.3 don't have cost data
   - Solution: This is normal, new compressions will include cost tracking

2. **Model detection failed:**
   - Check logs for: `[WARN] LLM detection failed`
   - Solution: Follow "LLM Detection Issues" steps above

3. **Unknown model ID:**
   - Check logs for: `[WARN] Unknown model 'xyz', using default`
   - Solution: Update config file with valid model ID

4. **Invalid token counts:**
   - Rare: Token counting failed, falling back to estimate
   - Check logs for: `[WARN] Token counting failed`
   - Solution: Reinstall `js-tiktoken` dependency:
     ```bash
     npm install -g ucpl-compress-mcp
     ```

### Config File Issues (NEW)

**Problem:** Config file not being read or causing errors

**Solutions:**

1. **Check file exists:**

   ```bash
   ls -la ~/.ucpl/compress/config.json
   ```

2. **Validate JSON syntax:**

   ```bash
   cat ~/.ucpl/compress/config.json | python3 -m json.tool
   ```

   Should output formatted JSON without errors

3. **Check file permissions:**

   ```bash
   chmod 644 ~/.ucpl/compress/config.json
   ```

4. **Look for warning in logs:**

   ```
   [WARN] Config file error: Unexpected token
   ```

   Indicates invalid JSON syntax

5. **Example valid config:**

   ```json
   {
     "model": "gpt-4o"
   }
   ```

6. **To reset config:**

   ```bash
   rm ~/.ucpl/compress/config.json
   ```

   Server will fall back to automatic detection

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
console.error("DEBUG:", message); // Logs to stderr (visible in client logs)
```

## License

MIT

## Related

- [UCPL Documentation](../README.md)
- [Context Compression Research](../docs/CONTEXT-COMPRESSION.md)
- [ucpl-compress CLI Tool](../docs/UCPL-COMPRESS.md)
