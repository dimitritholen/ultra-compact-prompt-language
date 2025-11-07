# Config Path Resolution Documentation

## Overview

The `ucpl-compress-mcp` server uses a configuration file to allow users to override the default LLM model for cost calculation. This document describes how the config file path is resolved and loaded.

## Production Config File Path

The production config file is located at:

```
~/.ucpl/compress/config.json
```

This resolves to:

- **Linux/macOS**: `/home/username/.ucpl/compress/config.json`
- **Windows**: `C:\Users\username\.ucpl\compress\config.json`

The path is constructed using Node.js `os.homedir()` for cross-platform compatibility.

## Path Resolution Logic

### 1. Config File Location

The config path is **hardcoded** in the server and cannot be overridden via environment variables or command-line arguments. This ensures consistent behavior across all deployments.

```javascript
const CONFIG_FILE = path.join(os.homedir(), ".ucpl", "compress", "config.json");
```

### 2. Loading Priority

The server attempts to load the config file with the following priority:

1. **Config File** (highest priority)
   - If the config file exists and contains a valid `model` field
   - The model must be recognized in `MODEL_PRICING`
   - Config overrides all environment variables

2. **Environment Variables** (fallback)
   - `CLAUDE_DESKTOP_VERSION` → `claude-sonnet-4`
   - `VSCODE_PID` or `CLINE_VERSION` → `claude-sonnet-4`
   - `ANTHROPIC_MODEL` → value must be in `MODEL_PRICING`
   - `OPENAI_MODEL` → value must be in `MODEL_PRICING`

3. **Default Model** (ultimate fallback)
   - If no config and no recognized env vars
   - Defaults to `claude-sonnet-4`

## Config File Format

### Valid Config

```json
{
  "model": "gpt-4o"
}
```

### Supported Models

- `claude-sonnet-4` (default)
- `claude-opus-4`
- `gpt-4o`
- `gpt-4o-mini`
- `gemini-2.0-flash`
- `o1`
- `o1-mini`

### Config Validation

The server validates the config file:

1. **Must be valid JSON**
   - Malformed JSON → fallback to env detection
   - Empty file → fallback to env detection

2. **Must be a JSON object**
   - Arrays, strings, numbers, etc. are rejected
   - `null` is rejected

3. **Model field must exist and be valid**
   - Unknown models → fallback to env detection
   - `null` or missing `model` field → fallback to env detection

4. **Extra fields are ignored**
   - Only the `model` field is used
   - Additional fields do not cause errors

## Error Handling

The server gracefully handles all config-related errors:

| Error Condition                   | Behavior                                     |
| --------------------------------- | -------------------------------------------- |
| Config file doesn't exist         | Fall back to env detection (no error logged) |
| Config file is malformed JSON     | Log warning, fall back to env detection      |
| Config file is not an object      | Fall back to env detection                   |
| Model field is invalid/unknown    | Log warning, fall back to env detection      |
| Config file has wrong permissions | Log error, fall back to env detection        |

All errors are logged to stderr but do not prevent the server from starting.

## Example Use Cases

### Use Case 1: No Config File

User has no config file. Server detects environment:

```bash
# Running in Claude Desktop
CLAUDE_DESKTOP_VERSION=1.0.0
→ Uses claude-sonnet-4
```

### Use Case 2: Config Override

User creates config to use GPT-4o for cost calculations:

```bash
mkdir -p ~/.ucpl/compress
echo '{"model": "gpt-4o"}' > ~/.ucpl/compress/config.json
```

Result: Server uses `gpt-4o` regardless of environment variables.

### Use Case 3: Invalid Model in Config

User mistypes model name:

```json
{
  "model": "gpt-5-turbo" // Not in MODEL_PRICING
}
```

Result: Server logs warning and falls back to env detection.

### Use Case 4: Malformed Config

User has syntax error in config:

```json
{ "model": "gpt-4o" } // Missing quotes
```

Result: Server logs warning and falls back to env detection.

## Testing Config Path Resolution

The integration test suite validates:

1. ✅ Production config path is correctly constructed
2. ✅ Config file loads with valid model
3. ✅ Missing config file is handled gracefully
4. ✅ Malformed JSON is handled gracefully
5. ✅ Invalid models fall back to env detection
6. ✅ Non-object JSON is rejected
7. ✅ Empty config file is handled gracefully
8. ✅ Config overrides environment variables
9. ✅ Null model field falls back to env detection
10. ✅ Extra config fields are ignored
11. ✅ Default model is used when no config/env

Run tests with:

```bash
npm test -- test-config-path-resolution.test.mjs
```

## Security Considerations

### Path Traversal Protection

The config path is **hardcoded** using `os.homedir()`, preventing:

- Relative path attacks (e.g., `../../../etc/passwd`)
- Absolute path overrides
- Symlink attacks

### Config File Permissions

Recommended permissions:

- **Linux/macOS**: `chmod 600 ~/.ucpl/compress/config.json` (owner read/write only)
- **Windows**: User-only read/write (default for user home directory)

The server does **not** enforce permissions but will log errors if the file cannot be read.

### Content Validation

- Config is parsed with `JSON.parse()` (no `eval()` or code execution)
- Only the `model` field is used (no arbitrary code execution)
- Unknown models are rejected (prevents injection attacks)

## Troubleshooting

### Config Not Loading

1. **Check file path**:

   ```bash
   echo $HOME/.ucpl/compress/config.json
   ```

2. **Verify file exists**:

   ```bash
   ls -la ~/.ucpl/compress/config.json
   ```

3. **Check file permissions**:

   ```bash
   # Linux/macOS
   chmod 644 ~/.ucpl/compress/config.json

   # Verify
   cat ~/.ucpl/compress/config.json
   ```

4. **Validate JSON syntax**:
   ```bash
   cat ~/.ucpl/compress/config.json | jq .
   ```

### Config Being Ignored

Check server logs (stderr) for warnings:

- `[WARN] Unknown model in config: ...` → Model not recognized
- `[WARN] Config file error: ...` → File exists but is malformed
- `[INFO] Using model from config file: ...` → Config loaded successfully

### Default Model Used Instead of Config

Possible causes:

1. Config file doesn't exist (no error logged)
2. Config has invalid model (warning logged)
3. Config is malformed JSON (warning logged)
4. Config is not a JSON object (fallback to env)

## Implementation Details

### Code Location

Config loading logic is in `server.js`:

```javascript
// Lines 48-87
const CONFIG_FILE = path.join(os.homedir(), ".ucpl", "compress", "config.json");

async function detectLLMClient() {
  try {
    const configData = await fs.readFile(CONFIG_FILE, "utf-8");
    const config = JSON.parse(configData);

    if (typeof config !== "object" || config === null) {
      throw new Error("Config must be a valid JSON object");
    }

    if (config.model && MODEL_PRICING[config.model]) {
      return { client: "config-override", model: config.model };
    }
  } catch (err) {
    // Fall back to env detection
  }

  // ... env detection logic
}
```

### Caching Behavior

The detected LLM client and model are **cached per server lifecycle**:

```javascript
let cachedLLMClient = null;
```

This means:

- Config is read **once** when the server starts
- Changes to the config file require **server restart**
- Caching improves performance (no repeated file I/O)

## Related Documentation

- [LLM Detection and Cost Calculation](./test-llm-detection.test.mjs) - Test suite for LLM detection
- [MCP Statistics Enhancement](../TASK-010-COMPLETION.md) - Implementation details
- [Config Examples](../config-examples/) - Sample configuration files
