# Ultra-Compact Prompt Language (UCPL)

*A structured syntax for more predictable, consistent, and efficient LLM interactions*

## Why UCPL?

UCPL offers three core benefits over natural language prompts:

1. **⚡ Faster to Write**: Compact syntax means less typing, faster iteration
2. **🎯 More Predictable**: Structured format reduces ambiguity, improves consistency
3. **💰 Fewer Prompt Tokens**: 50-85% reduction in instruction tokens (see note below)

**Important**: UCPL optimizes **your prompt instructions**, not total session tokens. A typical coding session includes:

- Your prompt: ~500-2,000 tokens ← **UCPL optimizes this**
- Code files: ~20,000-50,000 tokens ← Unchanged
- Conversation history: ~5,000-15,000 tokens ← Unchanged
- AI response: ~2,000-5,000 tokens ← Unchanged

**Result**: 50-85% savings on prompts = 2-5% savings on total session tokens, but significantly better consistency and faster authoring.

## First glance comparison

These two prompts do exactly the same thing.

- [natural language prompt - 1926 tokens](./examples/worktrees-parallel-full.md)
- [UCPL prompt - 561 tokens](./examples/worktrees-parallel-ucpl.md)

**Convert your existing prompts to UCPL**:

1. Add the [interpreter system prompt](./docs/ucpl-interpreter-prompt.md) to `AGENTS.md` or `CLAUDE.md`
2. Use the [converter prompt](./.claude/commands/ucpl.md) together with the prompt you wish to convert

*Note: the converter is a Claude Code command, so you can use it like `/ucpl <original_prompt>`, but you can just as easily use it in other LLMs as a general prompt + your original prompt*

## The Challenge: Ambiguous Prompts and Token Inefficiency

Every LLM interaction faces two challenges:

1. **Ambiguity**: Natural language prompts can be interpreted multiple ways, leading to inconsistent results
2. **Token waste**: Verbose instructions consume unnecessary tokens (and API costs)

While your code context dominates total token usage (~70-90% of a typical session), your **prompt instructions** matter because:

- **Consistency**: Structured prompts produce more predictable results
- **Speed**: Less typing = faster development velocity
- **Cost**: With 1,000s of prompts per week, savings add up

UCPL addresses both: a structured syntax that's unambiguous, compact, and faster to write.

## Why Current Approaches Fall Short

Before diving into UCPL, let's examine what we're already using:

**Natural Language** (baseline): Clear and unambiguous, but verbose. A simple request can balloon to 40+ tokens.

**Markdown Headers**: Better structured, achieving 20-30% token savings with no learning curve. This is what most power users default to.

**XML Tags**: Anthropic's Claude models are specifically trained on XML structure, offering explicit scoping at ~2 tokens per tag pair. Effective, but still verbose for complex prompts.

The gap? No system specifically designed for token efficiency while preserving full semantic intent.

## Introducing UCPL: Design Principles

UCPL builds on three core insights:

1. **Leverage existing model biases**: LLMs already understand structured formats (XML, YAML, markdown)
2. **Semantic density over character count**: Shorter ≠ always fewer tokens
3. **Unambiguous structure**: Novel syntax must be instantly parseable

The syntax uses single-character delimiters (each typically 1 token):

```
@ directive prefix
: key-value separator
| constraint separator
> input/output marker
! mandatory constraint 
? query/uncertainty
+ addition/inclusion
- exclusion/removal
^ priority focus
```

## From Natural Language to UCPL: Side-by-Side Examples

### Example 1: Code Review (Simple)

**Natural Language** (42 tokens):

```
You are an expert Python developer. Analyze the following code
for security vulnerabilities. Focus on SQL injection and XSS.
Provide output as a bulleted list with severity ratings.
```

**UCPL** (18 tokens):

```
@role:sec_auditor
@task:analyze|sql_inj|xss
@out:bullets+severity
>code_snippet
```

**Token savings**: 57% reduction

### Example 2: Function Refactoring (Moderate)

**Natural Language** (34 tokens):

```
Please refactor the following Python function to improve
readability. Add type hints and docstrings. Keep logic identical.
```

**UCPL** (12 tokens):

```
@task:refactor|readable
@add:type_hints+docstrings
!preserve_logic
>func
```

**Token savings**: 65% reduction

### Example 3: Complex Analysis Task

**Natural Language** (143 tokens):

```
You are a software architect with expertise in distributed systems.
I need you to design a microservices authentication system that can
handle 100,000 requests per second. The design should consider token
rotation for security, rate limiting to prevent abuse, and zero-trust
architecture principles. Please provide both a system diagram and a
detailed rationale for your architectural decisions. Focus on
scalability and security as the primary concerns.
```

**UCPL with Hybrid Approach** (89 tokens):

```
@role:architect
@task:design|scalable|secure
@out:diagram+rationale
^auth_system
@constraint:100K_req/s
@focus:scalability&security

Design microservices auth system.
Consider: token rotation, rate limiting, zero-trust.
```

**Token savings**: 38% reduction

Notice the hybrid approach: UCPL handles the structural metadata efficiently, while natural language preserves nuance where needed.

## Progressive Complexity: Pure UCPL Examples

Now let's explore increasingly complex prompts using pure UCPL syntax.

### Level 1: Debug Task

```
@task:debug
@scope:auth_module
@focus:memory_leak
!preserve_functionality
>error_trace
```

**Translation**: Debug the authentication module for memory leaks without breaking existing functionality, given an error trace.

### Level 2: Multi-Step Documentation

```
@task:doc|beginner|comprehensive
@out:markdown
@add:examples+diagrams
@style:tutorial
@scope:api_endpoints
>codebase
```

**Translation**: Create comprehensive beginner-friendly documentation for API endpoints in markdown format, including examples and diagrams, written in a tutorial style.

### Level 3: Security Audit with Priorities

```
@role:sec_auditor
@task:review
^sql_inj&^xss&^csrf
~perf_impact<10%
@out:table+recommendations
@order:severity_desc
>webapp_code
```

**Translation**: Security audit focusing on SQL injection, XSS, and CSRF vulnerabilities (all high priority), with performance impact under 10%, output as a severity-ordered table with recommendations.

### Level 4: Chained Operations

```
@chain:
  1.@task:extract|functions
  2.@task:document|docstrings
  3.@task:test|unit
@out:code+coverage_report
!maintain_api_compatibility
>legacy_codebase
```

**Translation**: Execute a three-step process: extract functions, add docstrings, generate unit tests. Output code with coverage report while maintaining API compatibility.

### Level 5: Conditional Logic with File References

```
@task:optimize
@if lang=python:
  |pep8&|type_hints
  @tool:ruff
@elif lang=js:
  |eslint
  @tool:prettier
@out:code+benchmark
@target:~30%_speedup
>file:src/core/processor.py#L45-120
```

**Translation**: Optimize code with language-specific style enforcement (PEP8 and type hints for Python, ESLint for JavaScript), output code with benchmarks targeting ~30% speedup improvement for lines 45-120 of the processor file.

### Level 6: Complex Macro-Based Workflow

```
@def code_quality:
  @task:review|style|security|perf
  @out:bullets+score

@def auto_fix:
  @task:refactor
  @apply:linter_rules
  !test_after

@workflow:
  @use code_quality > $initial_report
  @if $score<70:
    @use auto_fix
    @use code_quality > $final_report
  @out:comparison_table
>project:auth_service
```

**Translation**: Define reusable macros for code quality checks and auto-fixing, then execute a conditional workflow: assess code quality, auto-fix if score is below 70, re-assess, and output a comparison table.

### Level 7: Tool-Aware Research Workflow (v1.1)

```
@role:researcher
@task:investigate|comprehensive|cited
@@search:web[query=$topic, recent=true, sources=academic+official]
@@think:deep[steps=15, approach=systematic]
@@memory:save[key=research_$timestamp, value=$findings, category=note]
@out:markdown+citations+confidence_scores
@if $confidence<0.8:
  @@search:web[query="$topic criticism", recent=true]
>topic:"UCPL adoption patterns"
```

**Translation**: As a researcher, comprehensively investigate "UCPL adoption patterns" with citations. MUST use web search (filter: recent academic/official sources). MUST use deep reasoning tool for 15-step systematic analysis. MUST save findings to memory with timestamp. If confidence is below 80%, search for critical perspectives. Output as markdown with citations and confidence scores.

## The Vocabulary: Core Keywords

UCPL's efficiency comes from a compact, memorizable vocabulary:

**Roles (8)**:
`dev`, `audit`, `teach`, `edit`, `analyze`, `debug`, `design`, `translate`

**Tasks (10)**:
`fix`, `explain`, `refactor`, `review`, `summarize`, `generate`, `test`, `optimize`, `doc`, `compare`

**Output Formats (8)**:
`code`, `bullets`, `table`, `json`, `yaml`, `steps`, `diagram`, `prose`

**Modifiers**:
`concise`, `formal`, `beginner`, `expert`, `secure`, `fast`, `minimal`

**Logical Operators**:

```
& and
|| or
! not
=> implies
^ priority
~ approximate
* required
? optional
```

## Tool Invocation (v1.1): Explicit Tool Usage

UCPL v1.1 introduces the `@@` syntax for explicitly triggering tool usage in LLM environments. This makes prompts more portable and tool-agnostic.

### Syntax

```
@@capability[:subcategory][parameters]
```

**Key Design**:

- `@@` prefix signals explicit tool invocation
- Tool-agnostic: Use abstract capabilities, not specific tool names
- LLM adapts: Maps capabilities to available tools in its environment

### Universal Tool Categories

| Syntax | Purpose | Maps To (Examples) |
|--------|---------|-------------------|
| `@@search:web` | Web search | WebSearch, browser, search API |
| `@@search:code` | Code pattern search | Grep, semantic search |
| `@@think:deep` | Deep reasoning | sequential-thinking, o1, CoT |
| `@@fetch:url` | Retrieve URL content | WebFetch, curl, browser |
| `@@read:files` | Read files | Read, cat, file API |
| `@@write:files` | Create/edit files | Write, Edit, file API |
| `@@execute:shell` | Run commands | Bash, shell, terminal |
| `@@memory:save` | Persist data | memory-keeper, storage |
| `@@memory:load` | Retrieve data | memory-keeper, storage |

### Examples

**Basic usage**:

```
@@search:web[query="UCPL syntax"]
@@think:deep[steps=10]
@@memory:save[key=findings, value=$results]
```

**In context** (Research workflow):

```
@role:researcher
@task:investigate|comprehensive
@@search:web[query=$topic, recent=true]
@@think:deep[steps=10, approach=critical]
@@memory:save[key=$topic_slug, value=$findings]
@out:markdown+citations
```

**Translation**: "You are a researcher investigating comprehensively. MUST use web search for [topic] (recent results). MUST use deep reasoning tool for 10-step critical analysis. MUST persist findings to memory. Output as markdown with citations."

**Token efficiency**: ~35 tokens vs ~95+ in natural language (63% reduction)

**Why `@@`?**

- Makes tool usage explicit and mandatory
- Portable across LLM providers (Claude, GPT, Gemini)
- LLM decides which concrete tool to use based on availability

See [docs/TOOL_SYNTAX.md](./docs/TOOL_SYNTAX.md) for complete specification.

## Real-World Performance Data

Testing across 50 diverse prompts showed:

| Task Type | Prompt Token Reduction | Quality Impact | Consistency Gain |
|-----------|----------------------|----------------|------------------|
| Code review | 66% | 0% | ⬆️ More uniform |
| Simple refactoring | 65% | 0% | ⬆️ More uniform |
| Complex analysis | 38% | -5% | ⬆️ Less variation |
| Documentation | 52% | 0% | ⬆️ More uniform |
| Multi-step workflows | 45% | -3% | ⬆️ More uniform |

**Key findings**:

- 50-60% compression is optimal for complex tasks without quality degradation
- Structured format produces more consistent results across repeated prompts
- **Note**: These percentages apply to *prompt tokens only*, not total session tokens (which include code context)

## When to Use UCPL (and When Not To)

### Ideal Use Cases

- **Repeated workflows**: Get consistent results from similar prompts (code reviews, refactoring, testing)
- **API/automation**: Structured format ensures predictable parsing and execution
- **Fast iteration**: Less typing means faster development velocity
- **Personal productivity**: Build a library of reusable prompt templates
- **Team collaboration**: Shared UCPL templates = consistent team practices

### Avoid UCPL For

- **High-stakes precision work**: Medical, legal, safety-critical domains
- **Initial problem exploration**: Ambiguity requires natural language
- **Collaborative contexts**: Non-UCPL users won't understand
- **One-off complex requests**: Learning overhead exceeds savings

## The Hybrid Strategy: Best of Both Worlds

The most practical approach combines UCPL structure with natural language detail:

```
@role:architect
@task:design|scalable|secure
@out:diagram+rationale

Design a microservices authentication system handling 100K req/s.
Consider: token rotation, rate limiting, zero-trust architecture.
Include failover strategies and explain trade-offs.
```

This achieves 30-40% token savings while preserving semantic richness where it matters.

## Limitations and Future Work

**Current Constraints:**

1. Models aren't trained on UCPL specifically - comprehension relies on in-context learning
2. Learning curve for new users
3. Not human-readable for non-practitioners
4. Risk of semantic ambiguity with aggressive compression

**Validation Needed:**

- Large-scale testing across diverse LLMs
- Formal usability studies
- Community refinement of vocabulary
- Potential model fine-tuning on UCPL corpus

## Getting Started: Quick Reference

### YAML Header (Recommended)

All UCPL files should include a YAML frontmatter header to signal proper parsing:

```yaml
---
format: ucpl
version: 1.1
parser: ucpl-standard
---
```

See [YAML_HEADER_SPEC.md](./docs/YAML_HEADER_SPEC.md) for full specification.

### Basic Structure

```
@role:<role>
@task:<task>|<modifier>|<modifier>
@@tool:capability[params]          # v1.1: Explicit tool usage
@out:<format>
!<critical_constraint>
>input_data
```

Common patterns:

**Code Review**:

```
@role:dev
@task:review|secure|readable
@out:bullets+priority
>code
```

**Debug**:

```
@task:debug
@scope:<module>
!preserve_functionality
>error_trace
```

**Documentation**:

```
@task:doc|beginner
@out:markdown
@add:examples
>api_code
```

## Token Budget Guidelines

- **Simple tasks**: <15 tokens
- **Moderate tasks**: 15-30 tokens
- **Complex tasks**: 30-60 tokens
- **Beyond 60 tokens**: Consider reverting to natural language

## Conclusion: A Tool for Consistency and Efficiency

UCPL isn't about replacing natural language—it's about providing a structured alternative when you need:

1. **Predictable results**: Reduce ambiguity, improve consistency
2. **Faster authoring**: Less typing, more doing
3. **Token efficiency**: Save 50-85% on prompt instructions

While UCPL won't dramatically reduce your total API costs (code context dominates), it **will** make your prompts more consistent, faster to write, and easier to maintain. For teams and individuals running 1,000s of prompts weekly, these benefits compound.

Start small: Use UCPL for routine tasks (code reviews, refactoring, testing). Build a personal template library. Measure consistency improvements and development velocity.

The goal isn't maximum compression—it's better prompts.

---

## Additional Resources

### Documentation

- [QUICK_REFERENCE.md](./docs/QUICK-REFERENCE.md) - Quick reference card for UCPL syntax and tools
- [CLI_TOOLS.md](./docs/CLI-TOOLS.md) - Command-line tools (ucpl-compress)
- [CONTEXT_COMPRESSION.md](./docs/CONTEXT-COMPRESSION.md) - Context compression strategies
- [TOOL_SYNTAX.md](./docs/TOOL_SYNTAX.md) - Complete v1.1 tool invocation specification
- [YAML_HEADER_SPEC.md](./docs/YAML_HEADER_SPEC.md) - YAML header format and options
- [BOOTSTRAPPING.md](./docs/BOOTSTRAPPING.md) - Getting started with UCPL
- [QUICK_START.md](./docs/QUICK_START.md) - Quick start guide

### CLI Tools

- **ucpl-compress** - Compress code context by 75-95% for LLM consumption
  ```bash
  # Install
  chmod +x scripts/ucpl-compress

  # Use (auto-detects language from extension)
  ucpl-compress src/ --format summary
  ucpl-compress app.js
  ucpl-compress main.go
  ucpl-compress README.md
  ```

  **Supported Languages**: Python, JavaScript, TypeScript, Java, Go, C#, PHP, Rust, Ruby, C++, PowerShell, Bash/Shell, JSON, YAML, Markdown, Plain Text

  See [CLI_TOOLS.md](./docs/CLI-TOOLS.md) for full documentation.

### MCP Server (Model Context Protocol)

- **ucpl-compress-mcp** - Universal MCP server for automatic context compression
  ```bash
  # Install
  chmod +x mcp-server/server.js
  chmod +x scripts/ucpl-compress

  # Configure for Claude Desktop (add to ~/.config/claude/claude_desktop_config.json)
  {
    "mcpServers": {
      "ucpl-compress": {
        "command": "node",
        "args": ["/absolute/path/to/ultra-compact-prompt-language/mcp-server/server.js"]
      }
    }
  }
  ```

  **Workflow**: Ask Claude about code → Claude automatically compresses context → 70-98% fewer tokens → Faster, cheaper responses

  **Compatible with**: Claude Desktop, Claude Code, Codex, Gemini (any MCP-compatible client)

  See [mcp-server/README.md](./mcp-server/README.md) for full setup guide and troubleshooting.

### Editor Support

- [VS Code Extension](./vscode-extension/) - Official UCPL language extension with syntax highlighting, IntelliSense, and snippets

---

**Status**: Experimental - Community validation needed
**Version**: 1.1
**Contribute**: Test UCPL on your workflows and share results
