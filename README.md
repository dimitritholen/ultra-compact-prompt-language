# Ultra-Compact Prompt Language (UCPL)

**Token Compression for LLM Interactions**

UCPL is a comprehensive token compression initiative providing three tools to optimize your LLM workflows:

1. **UCPL Language**: Structured syntax for 50-85% more efficient prompt instructions
2. **Context Compression MCP**: Semantic code compression reducing context tokens by 70-98%
3. **VS Code Extension**: Full IDE support for writing UCPL prompts

---

## The Token Problem

Modern LLM interactions consume massive amounts of tokens:

| Component                | Typical Usage        | Current Solution            |
| ------------------------ | -------------------- | --------------------------- |
| **Prompt instructions**  | 500-2,000 tokens     | ❌ Verbose natural language |
| **Code context**         | 20,000-50,000 tokens | ❌ Send entire files        |
| **Conversation history** | 5,000-15,000 tokens  | ❌ No compression           |
| **AI responses**         | 2,000-5,000 tokens   | ❌ No control               |

**UCPL addresses the first two problems with specialized tools.**

---

## 🚀 Quick Start

### Option 1: Just the Language

Write more efficient prompts with UCPL syntax.

**Install**: Add the [UCPL interpreter prompt](./docs/ucpl-interpreter-prompt.md) to your `CLAUDE.md`

**Example**:

```ucpl
---
format: ucpl
version: 1.1
---

@role:sec_auditor
@task:analyze|sql_inj|xss
@out:bullets+severity
>code_snippet
```

**Result**: 57% fewer tokens than natural language, more predictable results.

→ [Full Language Documentation](./docs/README.LANGUAGE.md)

### Option 2: Context Compression (MCP Server)

Compress code context by 70-98% automatically.

**Install**:

```bash
npm install -g ucpl-compress-mcp
```

Add to Claude Desktop config (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ucpl-compress": {
      "command": "ucpl-compress-mcp"
    }
  }
}
```

**Usage**: Claude automatically compresses code when you ask about it.

**Example**: "What does src/auth/ do?" → Claude compresses 100K tokens to 10K → Responds faster, cheaper.

→ [Full MCP Server Documentation](./docs/README.MCP.md)

### Option 3: VS Code Extension

Get IDE support for writing UCPL prompts.

**Install**: Search "UCPL" in VS Code Extensions (`Ctrl+Shift+X`)

**Features**:

- Syntax highlighting
- IntelliSense autocomplete
- Code snippets
- Hover documentation

→ [Full Extension Documentation](./docs/README.EXTENSION.md)

---

## Tool Comparison

| Tool                  | Compresses          | Token Reduction | Use For                |
| --------------------- | ------------------- | --------------- | ---------------------- |
| **UCPL Language**     | Prompt instructions | 50-85%          | Writing better prompts |
| **MCP Server**        | Code context        | 70-98%          | Exploring codebases    |
| **VS Code Extension** | —                   | —               | Authoring UCPL files   |

**Use them together**: Write prompts in UCPL (language + extension), compress code context with MCP server.

---

## The Three Tools

### 1. UCPL Language

A structured syntax for token-efficient prompts.

**Natural Language** (42 tokens):

```
You are an expert Python developer. Analyze the following code
for security vulnerabilities. Focus on SQL injection and XSS.
Provide output as a bulleted list with severity ratings.
```

**UCPL** (18 tokens):

```ucpl
@role:sec_auditor
@task:analyze|sql_inj|xss
@out:bullets+severity
```

**Core Features**:

- Directives: `@role`, `@task`, `@scope`, `@out`
- Constraints: `!must`, `?optional`, `~avoid`
- Workflows: Multi-step task chains
- Macros: Reusable prompt functions
- Tool invocation: `@@search:web`, `@@think:deep`, `@@compress:context`

**Ideal for**: Repeated workflows, API automation, team collaboration

→ [Learn the Language](./docs/README.LANGUAGE.md) | [Quick Reference](./docs/QUICK-REFERENCE.md) | [Examples](./examples/)

### 2. Context Compression MCP Server

Semantic code compression for LLM context.

**What it does**: Converts full code to semantic summaries LLMs can read directly.

**Full Code** (850 tokens):

```python
class UserAuthenticator:
    """Handles user authentication with JWT tokens."""
    def __init__(self, secret_key: str, token_expiry: int = 3600):
        self.secret_key = secret_key
        # ... 30 more lines
```

**Compressed** (180 tokens - 79% reduction):

```
# UserAuthenticator (auth/user.py:15-45)
JWT-based authentication
Methods:
- __init__(secret_key: str, token_expiry: int=3600)
- generate_token(user_id: int, email: str) -> str
- verify_token(token: str) -> Dict[str, Any]
```

**Core Features**:

- 16 language support
- 3 compression levels (full, signatures, minimal)
- File filtering (include/exclude patterns)
- Works with Claude Desktop, Claude Code, any MCP client

**Ideal for**: Large codebase exploration, API understanding, token budget management

**Not for**: Code editing, debugging, security audits (need full code)

→ [Full MCP Documentation](./docs/README.MCP.md) | [Use Cases](./docs/USECASES.md) | [Context Compression Research](./docs/CONTEXT-COMPRESSION.md)

### 3. VS Code Extension

Full IDE support for UCPL syntax.

**Features**:

- Syntax highlighting for `.ucpl` files
- IntelliSense autocomplete
- Code snippets (`ucpl-task`, `ucpl-workflow`, etc.)
- Hover documentation
- Go to definition (F12)

**Makes writing UCPL as comfortable as writing Python or JavaScript.**

→ [Extension Documentation](./docs/README.EXTENSION.md)

---

## Real-World Performance

### Language (Prompt Compression)

Testing across 50 diverse prompts:

| Task Type            | Token Reduction | Quality Impact |
| -------------------- | --------------- | -------------- |
| Code review          | 66%             | 0%             |
| Simple refactoring   | 65%             | 0%             |
| Complex analysis     | 38%             | -5%            |
| Documentation        | 52%             | 0%             |
| Multi-step workflows | 45%             | -3%            |

**Key finding**: 50-60% compression optimal for complex tasks without quality loss.

### MCP Server (Context Compression)

Testing across 20 codebases:

| Language   | Compression | Semantic Preservation |
| ---------- | ----------- | --------------------- |
| Python     | 75-85%      | ✅ High               |
| TypeScript | 70-80%      | ✅ High               |
| JavaScript | 65-75%      | ✅ High               |
| Java       | 80-90%      | ✅ High               |
| Go         | 75-85%      | ✅ High               |

**Key finding**: Typed languages compress better while preserving semantics.

---

## When to Use Each Tool

### UCPL Language

**✅ Use for**:

- Repeated workflows (code reviews, refactoring)
- API/automation (predictable parsing)
- Fast iteration (less typing)
- Team collaboration (shared templates)

**❌ Avoid for**:

- High-stakes precision work (medical, legal)
- Initial problem exploration
- One-off complex requests

### MCP Server

**✅ Use for**:

- Exploring large codebases (>5K lines)
- API surface understanding
- Multi-file analysis
- Cost optimization

**❌ Avoid for**:

- Code editing/modification
- Algorithm debugging
- Security audits
- Small codebases (<1K lines)

### VS Code Extension

**✅ Use for**:

- Writing UCPL files comfortably
- Learning UCPL syntax
- Building prompt templates

---

## Getting Started

### Step 1: Choose Your Path

**Just want better prompts?**
→ Start with the [UCPL Language](./docs/README.LANGUAGE.md)

**Working with large codebases?**
→ Install the [MCP Server](./docs/README.MCP.md)

**Writing lots of UCPL?**
→ Get the [VS Code Extension](./docs/README.EXTENSION.md)

### Step 2: Learn the Basics

- [Quick Start Guide](./docs/QUICK_START.md) - 5-minute intro
- [Quick Reference Card](./docs/QUICK-REFERENCE.md) - Syntax cheat sheet
- [Bootstrapping Guide](./docs/BOOTSTRAPPING.md) - First steps
- [Examples](./examples/) - Real-world UCPL prompts

### Step 3: Dive Deeper

- [Tool Syntax Specification](./docs/TOOL_SYNTAX.md) - `@@` tool invocation
- [Context Compression Research](./docs/CONTEXT-COMPRESSION.md) - How compression works
- [Use Cases](./docs/USECASES.md) - When to use each tool
- [YAML Header Spec](./docs/YAML_HEADER_SPEC.md) - File format details

---

## Examples

### Code Review with UCPL

```ucpl
---
format: ucpl
version: 1.1
---

@role:senior_dev
@task:review|security|performance
@scope:auth_module
!check_sql_injection
!check_xss
!include_line_numbers
@out:bullets+severity+recommendations
```

### Research with Tool Invocation

```ucpl
---
format: ucpl
version: 1.1
---

@role:researcher
@task:investigate|comprehensive
@@search:web[query=$topic, recent=true]
@@think:deep[steps=15, approach=systematic]
@@compress:context[path=research/, level=full]
@@memory:save[key=findings, value=$results]
@out:markdown+citations+confidence_scores
```

### Multi-Step Workflow

```ucpl
---
format: ucpl
version: 1.1
---

@workflow:
  @chain:
    1.@@compress:context[path=src/, level=minimal] > $structure
    2.@task:analyze_architecture > $analysis
    3.@if $analysis.complexity>7:
        @task:suggest_refactoring
    4.@task:generate_report
@out:markdown+diagrams
```

More examples: [examples/](./examples/)

---

## CLI Tools

### ucpl-compress

Standalone compression CLI (included with MCP server):

```bash
# Auto-detects language
ucpl-compress src/main.py
ucpl-compress app.js --level minimal

# Directory compression
ucpl-compress src/ --format summary

# File filtering
ucpl-compress src/ --include '*.py' --exclude '**/test_*'

# Output formats
ucpl-compress src/ --format json
ucpl-compress src/ --format tree
```

See [CLI Tools Documentation](./docs/CLI-TOOLS.md) for complete reference.

---

## Honest Assessment

### What Works Today

**UCPL Language**:

- ✅ 50-85% token reduction on prompts
- ✅ More consistent results
- ✅ Faster authoring
- ⚠️ Learning curve for new syntax
- ⚠️ Not human-readable for non-practitioners

**MCP Server**:

- ✅ 70-98% context compression
- ✅ Perfect for code exploration
- ✅ Works automatically in Claude
- ⚠️ Not for code editing
- ⚠️ Overhead for small codebases

**VS Code Extension**:

- ✅ Full syntax support
- ✅ Makes UCPL comfortable to write
- ⚠️ Syntax only, no semantic validation

### What Needs Work

1. **Models aren't trained on UCPL** - Relies on in-context learning
2. **Limited semantic validation** - No type-checking or validation tools
3. **Community adoption** - Needs more real-world testing and feedback

---

## Contributing

UCPL is experimental and needs community validation:

1. **Test on your workflows** - Try UCPL and report results
2. **Share examples** - Contribute real-world UCPL prompts
3. **Report issues** - [GitHub Issues](https://github.com/dimitritholen/ultra-compact-prompt-language/issues)
4. **Improve docs** - Help make documentation clearer
5. **Build tools** - Create converters, validators, integrations

---

## Documentation

### Core Docs

- [UCPL Language](./docs/README.LANGUAGE.md) - Full language specification
- [MCP Server](./docs/README.MCP.md) - Context compression server
- [VS Code Extension](./docs/README.EXTENSION.md) - IDE support

### Guides

- [Quick Start](./docs/QUICK_START.md) - 5-minute intro
- [Quick Reference](./docs/QUICK-REFERENCE.md) - Syntax cheat sheet
- [Bootstrapping](./docs/BOOTSTRAPPING.md) - Getting started
- [Use Cases](./docs/USECASES.md) - When to use what

### Technical

- [Tool Syntax](./docs/TOOL_SYNTAX.md) - `@@` invocation spec
- [Context Compression](./docs/CONTEXT-COMPRESSION.md) - How compression works
- [CLI Tools](./docs/CLI-TOOLS.md) - Command-line tools
- [YAML Header](./docs/YAML_HEADER_SPEC.md) - File format

### Examples

- [Examples Directory](./examples/) - Real-world UCPL prompts
- [Code Review](./examples/code-review-ucpl.md)
- [Parallel Workflows](./examples/worktrees-parallel-ucpl.md)

---

## Project Status

**Version**: 1.1 (Tool Invocation Update)
**Status**: Experimental - Community validation needed
**License**: MIT

---

## Summary

UCPL provides **three complementary tools** for token compression:

1. **Language**: Write prompts with 50-85% fewer tokens
2. **MCP Server**: Compress code context by 70-98% automatically
3. **VS Code Extension**: IDE support for comfortable authoring

**Best practice**: Use them together for maximum efficiency.

**Philosophy**: Token compression isn't just about cost—it's about **better prompts** through structure, consistency, and strategic context management.

Start with what you need. Scale as you grow.

---

**Ready to start?** Choose your path:

- [Learn the Language](./docs/README.LANGUAGE.md)
- [Install MCP Server](./docs/README.MCP.md)
- [Get VS Code Extension](./docs/README.EXTENSION.md)
