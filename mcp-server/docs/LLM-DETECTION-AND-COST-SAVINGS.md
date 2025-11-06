# LLM Detection and Cost Savings

**Implemented:** 2025-11-06 (Task 005)
**Status:** Production-ready

## Overview

The MCP server automatically detects which LLM client is being used and calculates cost savings based on token reduction from compression. This helps quantify the monetary value of using ucpl-compress.

## Features

1. **Automatic LLM Detection**: Detects Claude Desktop, Claude Code, and other clients via environment variables
2. **Cost Calculation**: Calculates USD savings based on input token pricing
3. **Config Override**: Optional config file for manual model selection
4. **Multiple Models Supported**: Claude Sonnet 4, Opus 4, GPT-4o, Gemini 2.0, O1, and more

## Detection Methods

The server uses a **priority cascade** for detection:

### 1. Config File (Highest Priority)
**Location**: `~/.ucpl/compress/config.json`

**Format**:
```json
{
  "model": "claude-opus-4"
}
```

**Supported models**:
- `claude-sonnet-4` - Claude Sonnet 4 ($3/M tokens)
- `claude-opus-4` - Claude Opus 4 ($15/M tokens)
- `gpt-4o` - GPT-4o ($2.50/M tokens)
- `gpt-4o-mini` - GPT-4o Mini ($0.15/M tokens)
- `gemini-2.0-flash` - Gemini 2.0 Flash ($0.10/M tokens)
- `o1` - OpenAI o1 ($15/M tokens)
- `o1-mini` - OpenAI o1-mini ($3/M tokens)

### 2. Claude Desktop Detection
**Environment Variable**: `CLAUDE_DESKTOP_VERSION`

When detected, assumes `claude-sonnet-4` as the default model.

### 3. Claude Code / VSCode Detection
**Environment Variables**: `VSCODE_PID` or `CLINE_VERSION`

When detected, assumes `claude-sonnet-4` as the default model.

### 4. Direct Model Environment Variables
- `ANTHROPIC_MODEL` - Anthropic SDK usage
- `OPENAI_MODEL` - OpenAI SDK usage

### 5. Fallback
If no detection succeeds, defaults to `claude-sonnet-4` (conservative choice).

## Cost Calculation

### Formula
```
Cost Savings (USD) = (Tokens Saved / 1,000,000) × Price per Million Tokens
```

### Example
- **Tokens Saved**: 50,000
- **Model**: Claude Sonnet 4 ($3/M tokens)
- **Cost Savings**: (50,000 / 1,000,000) × $3 = **$0.15 USD**

### Precision
- All costs are rounded to **2 decimal places** (cents)
- Maximum token cap: 1 billion tokens (prevents precision errors)

## Integration with get_compression_stats

The `get_compression_stats` tool automatically includes cost savings:

```json
{
  "summary": {
    "totalCompressions": 42,
    "totalTokensSaved": 1250000,
    "costSavingsUSD": 3.75,
    "detectedModel": "Claude Sonnet 4",
    "pricePerMillionTokens": 3.00
  }
}
```

**Output includes**:
- `costSavingsUSD` - Total savings in USD
- `detectedModel` - Human-readable model name
- `pricePerMillionTokens` - Price used for calculation

## Configuration Examples

### Example 1: Override Detection with Config File

Create `~/.ucpl/compress/config.json`:
```json
{
  "model": "gpt-4o"
}
```

Now all cost calculations will use GPT-4o pricing ($2.50/M tokens), regardless of which client is detected.

### Example 2: Claude Desktop (Automatic)

When using Claude Desktop, no configuration needed. The server automatically:
1. Detects `CLAUDE_DESKTOP_VERSION` environment variable
2. Uses `claude-sonnet-4` pricing ($3/M tokens)
3. Displays savings in `get_compression_stats` output

### Example 3: Multiple Clients

If you switch between clients frequently, the detection automatically adapts:
- **Claude Desktop** → Uses Claude Sonnet 4 pricing
- **Claude Code (VSCode)** → Uses Claude Sonnet 4 pricing
- **Custom SDK with `OPENAI_MODEL=gpt-4o`** → Uses GPT-4o pricing

## Validation and Error Handling

### Input Validation
- Checks `tokensSaved` is a valid non-negative number
- Caps maximum at 1 billion tokens
- Returns zero cost on invalid input

### Config Validation
- Verifies config file is valid JSON
- Checks model is in supported list
- Falls back to environment detection if invalid

### Logging
All detection and calculation events are logged to **stderr**:
```
[INFO] Detected Claude Desktop (version: 1.0.0)
[INFO] Using model from config file: gpt-4o
[WARN] Unknown model in config: invalid-model, falling back to env detection
[WARN] Token count capped at 1 billion (was: 2000000000)
```

## Testing

Run the test suite:
```bash
cd mcp-server
node test-llm-detection.js
```

**Tests cover**:
- All detection methods (env vars, config file)
- Cost calculation accuracy
- Rounding behavior
- Edge cases (zero tokens, large numbers, invalid models)
- Auto-detection with different clients

## Pricing Update Process

To update prices (e.g., when Claude releases new models):

1. Edit `server.js` - Update `MODEL_PRICING` constant
2. Update this documentation with new prices
3. Run tests to verify calculations
4. Commit changes

Example:
```javascript
const MODEL_PRICING = {
  'claude-sonnet-4': { pricePerMTok: 3.00, name: 'Claude Sonnet 4' },
  'claude-sonnet-5': { pricePerMTok: 4.00, name: 'Claude Sonnet 5' }, // NEW
  // ... other models
};
```

## Limitations

1. **Input tokens only**: Cost calculation is based on INPUT token savings (not output tokens)
2. **No real-time API calls**: Prices are hardcoded constants (not fetched from APIs)
3. **Detection limitations**: MCP protocol doesn't expose client info directly, relies on env vars
4. **Approximate pricing**: Actual API costs may vary based on caching, batch discounts, etc.

## Future Enhancements

Potential improvements (not currently implemented):
- Output token tracking
- Real-time price API integration
- Per-compression cost breakdown
- Monthly cost reports
- Budget alerts

## References

- **Task**: 005
- **Implementation**: `/mcp-server/server.js` (lines 33-163)
- **Tests**: `/mcp-server/test-llm-detection.js`
- **Config File**: `~/.ucpl/compress/config.json` (optional)
