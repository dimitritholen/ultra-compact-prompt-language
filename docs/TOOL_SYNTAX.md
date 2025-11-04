# UCPL Tool Invocation Syntax

**Version**: 1.1
**Purpose**: Enable explicit, tool-agnostic tool invocation in UCPL prompts

---

## Overview

The `@@` syntax allows UCPL prompts to explicitly trigger tool usage without hardcoding specific tool names or implementations. This makes UCPL portable across different LLM providers and tooling environments.

## Design Philosophy

1. **Tool-Agnostic**: Use abstract capability names, not concrete tool implementations
2. **LLM Decides**: The executing LLM maps capabilities to available tools
3. **Explicit > Implicit**: Tools are invoked only when explicitly requested via `@@`
4. **Backwards Compatible**: Files without `@@` work as before

---

## Syntax

### Basic Format

```
@@capability[:subcategory][parameters]
```

**Components**:
- `@@` - Tool invocation prefix (double at-sign)
- `capability` - Abstract tool category (search, think, read, write, etc.)
- `:subcategory` - Optional refinement (web, code, deep, etc.)
- `[parameters]` - Optional parameters in `key=value` format

### Examples

```ucpl
@@search:web                                    # Simple capability
@@search:web[query=$topic]                      # With parameters
@@think:deep[steps=10, complexity=high]         # Multiple parameters
@@read:files[pattern=*.py, recursive=true]      # Complex parameters
```

---

## Universal Tool Categories

### 1. Search (`@@search`)

**Purpose**: Find information in various domains

**Subcategories**:
- `@@search:web` - Web/internet search
- `@@search:code` - Code pattern search in files
- `@@search:docs` - Documentation search
- `@@search:semantic` - Semantic/similarity search

**Parameters**:
- `query` - Search query string
- `recent` - Filter for recent results (true/false)
- `sources` - Preferred sources (academic, official, community)
- `limit` - Maximum number of results

**Examples**:
```ucpl
@@search:web[query="UCPL syntax", recent=true]
@@search:code[query="function.*Error", pattern=*.js]
@@search:docs[query="authentication", sources=official]
```

**Maps To**:
- Claude Code: WebSearch, Grep
- GPT: browser, web_search
- Gemini: Google Search
- Local: ripgrep, semantic search tools

---

### 2. Deep Thinking (`@@think`)

**Purpose**: Engage reasoning/analysis capabilities

**Subcategories**:
- `@@think:deep` - Extended reasoning with step-by-step analysis
- `@@think:cot` - Chain-of-thought reasoning
- `@@think:systematic` - Systematic problem decomposition

**Parameters**:
- `steps` - Number of reasoning steps
- `complexity` - Problem complexity (low, medium, high)
- `approach` - Reasoning approach (analytical, creative, critical)

**Examples**:
```ucpl
@@think:deep[steps=15]
@@think:cot[approach=analytical]
@@think:systematic[complexity=high]
```

**Maps To**:
- Claude Code: mcp__sequential-thinking__sequentialthinking
- OpenAI: o1-preview, o1-mini (reasoning models)
- Gemini: Gemini 2.0 thinking mode
- Generic: Extended context window analysis

---

### 3. File Operations (`@@read`, `@@write`)

**Purpose**: Read/write files in the workspace

**Read Subcategories**:
- `@@read:files` - Read file contents
- `@@read:structure` - Analyze directory structure

**Write Subcategories**:
- `@@write:files` - Create or overwrite files
- `@@edit:files` - Edit existing files

**Parameters**:
- `path` - File or directory path
- `pattern` - Glob pattern for multiple files
- `recursive` - Include subdirectories (true/false)
- `encoding` - File encoding (default: utf-8)

**Examples**:
```ucpl
@@read:files[pattern=src/**/*.py]
@@write:files[path=output.md, encoding=utf-8]
@@edit:files[path=config.json, key=version, value=2.0]
```

**Maps To**:
- Claude Code: Read, Write, Edit, Glob
- GPT Code Interpreter: file operations
- Generic: File system APIs

---

### 4. Fetch (`@@fetch`)

**Purpose**: Retrieve content from URLs or external resources

**Subcategories**:
- `@@fetch:url` - Fetch URL content
- `@@fetch:api` - Call REST APIs
- `@@fetch:docs` - Fetch documentation

**Parameters**:
- `url` - Target URL
- `format` - Expected format (html, json, markdown, pdf)
- `headers` - Custom HTTP headers
- `timeout` - Request timeout in seconds

**Examples**:
```ucpl
@@fetch:url[url=https://example.com/api/data, format=json]
@@fetch:docs[url=https://docs.python.org/3/library/asyncio.html]
```

**Maps To**:
- Claude Code: WebFetch
- GPT: browser tool
- Generic: curl, requests library

---

### 5. Execute (`@@execute`)

**Purpose**: Run shell commands or scripts

**Subcategories**:
- `@@execute:shell` - Run shell commands
- `@@execute:script` - Run scripts
- `@@execute:test` - Run test suites

**Parameters**:
- `command` - Command to execute
- `cwd` - Working directory
- `env` - Environment variables
- `timeout` - Execution timeout

**Examples**:
```ucpl
@@execute:shell[command="npm test"]
@@execute:script[path=scripts/build.sh, cwd=/project]
@@execute:test[suite=unit, coverage=true]
```

**Maps To**:
- Claude Code: Bash
- GPT Code Interpreter: python, bash
- Generic: subprocess, shell

---

### 6. Memory (`@@memory`)

**Purpose**: Persist and retrieve data across sessions

**Subcategories**:
- `@@memory:save` - Save data
- `@@memory:load` - Retrieve data
- `@@memory:search` - Search saved data

**Parameters**:
- `key` - Storage key
- `value` - Data to store
- `category` - Data category (decision, progress, note)
- `channel` - Organization channel

**Examples**:
```ucpl
@@memory:save[key=architecture_decision, value=$design, category=decision]
@@memory:load[key=architecture_decision]
@@memory:search[query="authentication", category=decision]
```

**Maps To**:
- Claude Code: memory-keeper MCP
- GPT: Memory feature
- Generic: Any persistence tool/database

---

## Advanced Usage

### Chaining Tools

Use tool outputs in subsequent operations:

```ucpl
@@search:web[query=$topic] > $findings
@@think:deep[steps=10] → analyze $findings
@@memory:save[key=analysis, value=$result]
```

### Conditional Tool Use

```ucpl
@if $needs_research:
  @@search:web[query=$question]
@else:
  @@read:files[path=cache/$question.md]
```

### Tool Workflows

```ucpl
@workflow:
  @chain:
    1.@@search:web[query=$topic] > $raw_data
    2.@@think:deep[steps=15] → synthesize $raw_data
    3.@@memory:save[key=$topic_slug, value=$synthesis]
    4.@@write:files[path=reports/$topic.md, content=$synthesis]
```

---

## How LLMs Process `@@` Directives

### Expansion Phase (UUIP)

When UUIP expands `@@search:web[query="X"]`:

```
MUST: Use any available web search tool (examples: WebSearch, browser, search API) to search for "X"
```

### Execution Phase (LLM)

The executing LLM:
1. Reads the expanded "MUST use" instruction
2. Checks available tools in its environment
3. Selects the best matching tool (WebSearch, browser, etc.)
4. Invokes the tool with appropriate parameters

### Example Flow

**UCPL**:
```ucpl
@@search:web[query="async programming", recent=true]
```

**UUIP Expands To**:
```
MUST: Use any available web search tool (WebSearch, browser, search API, etc.) to search for "async programming". Filter for recent results.
```

**Claude Code Executes**:
```xml
<use_tool>
  <tool_name>WebSearch</tool_name>
  <parameters>
    <query>async programming</query>
    <recent>true</recent>
  </parameters>
</use_tool>
```

**GPT Executes**:
```json
{
  "tool": "web_search",
  "query": "async programming",
  "time_filter": "recent"
}
```

---

## Adding Custom Tool Categories

Users can define custom categories in YAML headers:

```yaml
---
format: ucpl
version: 1.1
parser: ucpl-standard
custom_tools:
  - name: "@@deploy"
    maps_to: ["vercel deploy", "netlify deploy"]
    description: "Deploy to hosting"
  - name: "@@notify"
    maps_to: ["slack send", "email send"]
    description: "Send notifications"
---
```

Then use in UCPL:

```ucpl
@@deploy[env=production]
@@notify[channel=#releases, message="Deployed v2.0"]
```

---

## Best Practices

### 1. Be Specific with Parameters

❌ Vague: `@@search:web`
✅ Clear: `@@search:web[query="specific topic", recent=true]`

### 2. Use Variables for Dynamic Values

```ucpl
@@search:web[query=$user_question]
@@memory:save[key=$topic_slug, value=$result]
```

### 3. Provide Fallbacks

```ucpl
@try:
  @@search:web[query=$topic]
@fallback:
  @@read:files[path=cache/$topic.md]
```

### 4. Document Custom Tools

If using custom `@@` categories, document them in YAML headers or comments.

---

## Backwards Compatibility

**Files without `@@`**: Work exactly as before. No changes needed.

**Mixed usage**: Can combine old syntax with new `@@` syntax:

```ucpl
@role:researcher
@task:investigate       # Old syntax
@@search:web[query=$q]  # New tool syntax
@out:markdown           # Old syntax
```

---

## Version History

- **v1.1** (2025-01-15): Added `@@` tool invocation syntax
- **v1.0** (2025-01-15): Initial UCPL specification

---

## Related Documentation

- [UUIP (Universal Interpreter Prompt)](./ucpl-interpreter-prompt.md) - Includes `@@` expansion rules
- [YAML Header Spec](./YAML_HEADER_SPEC.md) - Custom tool definitions
- [Examples](../examples/) - See `research.md` for tool usage

---

**Questions?** Open an issue or discussion on GitHub.
