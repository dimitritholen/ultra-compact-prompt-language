# UCPL Language Specification

A structured syntax for writing token-efficient, predictable LLM prompts.

## The Problem

Natural language prompts are:

- **Verbose**: Simple requests balloon to 40+ tokens
- **Ambiguous**: Same prompt interpreted differently across runs
- **Slow to write**: Typing detailed instructions is time-consuming

## The Solution

UCPL (Ultra-Compact Prompt Language) is a **structured syntax** that optimizes prompt instructions:

- **50-85% fewer tokens** than natural language
- **More predictable**: Reduced ambiguity improves consistency
- **Faster authoring**: Less typing, more iteration

## Quick Comparison

**Natural Language** (42 tokens):

```
You are an expert Python developer. Analyze the following code
for security vulnerabilities. Focus on SQL injection and XSS.
Provide output as a bulleted list with severity ratings.
```

**UCPL** (18 tokens):

```yaml
---
format: ucpl
version: 1.1
---

@role:sec_auditor
@task:analyze|sql_inj|xss
@out:bullets+severity
>code_snippet
```

**Result**: 57% token reduction with identical semantic meaning.

## Core Syntax

### Directives (Context Setting)

```ucpl
@role:developer          # Set AI role
@task:refactor|optimize  # Define task with focus areas
@scope:auth_module       # Limit work to specific scope
@out:code+tests          # Specify output format
@principles:SOLID+DRY    # Follow coding principles
```

### Constraints (Requirements)

```ucpl
!preserve_functionality  # MUST: mandatory requirement
?add_examples           # OPTIONAL: nice-to-have
~avoid_complexity       # AVOID: discouraged practice
```

### Operators

```ucpl
& and                   # All conditions must be met
|| or                   # Any condition is sufficient
> then / output to      # Sequence or output direction
^ focus on / prioritize # Increase importance
```

### Workflows (Multi-Step Tasks)

```ucpl
@workflow:
  @chain:
    1.@task:analyze_code > $issues
    2.@if $issues.critical>0:
        @task:fix_critical
    3.@task:generate_report
```

### Macros (Reusable Functions)

```ucpl
@def code_review:
  @task:review|style|security
  @out:bullets+score
  !check_tests

@use code_review > $report
```

### Tool Invocation (v1.1)

Explicitly trigger LLM tool usage with `@@` syntax:

```ucpl
@@search:web[query="topic", recent=true]     # Web search
@@think:deep[steps=10]                       # Deep reasoning
@@memory:save[key=findings, value=$results]  # Persist data
@@read:files[pattern=*.py]                   # Read files
@@compress:context[path=src/, level=full]    # Compress code
```

**Tool-agnostic**: The LLM maps capabilities to available tools (WebSearch, sequential-thinking, memory-keeper, etc.)

## YAML Header

All UCPL files should start with:

```yaml
---
format: ucpl
version: 1.1
parser: ucpl-standard
---
```

This signals to the LLM that the content should be parsed as UCPL.

## Compression Levels by Task Type

| Task Type            | Token Reduction | Quality Impact |
| -------------------- | --------------- | -------------- |
| Code review          | 66%             | 0%             |
| Simple refactoring   | 65%             | 0%             |
| Complex analysis     | 38%             | -5%            |
| Documentation        | 52%             | 0%             |
| Multi-step workflows | 45%             | -3%            |

**Optimal compression**: 50-60% for complex tasks without quality loss.

## When to Use UCPL

### ✅ Ideal Use Cases

- **Repeated workflows**: Code reviews, refactoring, testing
- **API/automation**: Predictable parsing and execution
- **Fast iteration**: Less typing = faster velocity
- **Personal productivity**: Build reusable template library
- **Team collaboration**: Shared templates = consistent practices

### ❌ Avoid UCPL For

- **High-stakes precision**: Medical, legal, safety-critical domains
- **Initial exploration**: Ambiguity requires natural language
- **Collaborative contexts**: Non-UCPL users won't understand
- **One-off complex tasks**: Learning overhead exceeds savings

## Hybrid Approach (Recommended)

Combine UCPL structure with natural language detail:

```ucpl
---
format: ucpl
version: 1.1
---

@role:architect
@task:design|scalable|secure
@out:diagram+rationale
^auth_system
@constraint:100K_req/s

Design microservices auth system.
Consider: token rotation, rate limiting, zero-trust.
Include failover strategies and explain trade-offs.
```

**Result**: 30-40% token savings while preserving semantic richness.

## Core Vocabulary

**Roles**: dev, audit, teach, edit, analyze, debug, design, translate

**Tasks**: fix, explain, refactor, review, summarize, generate, test, optimize, doc, compare

**Output Formats**: code, bullets, table, json, yaml, steps, diagram, prose

**Modifiers**: concise, formal, beginner, expert, secure, fast, minimal

## Token Budget Guidelines

- **Simple tasks**: <15 tokens
- **Moderate tasks**: 15-30 tokens
- **Complex tasks**: 30-60 tokens
- **Beyond 60 tokens**: Consider natural language

## Getting Started

1. **Install the interpreter**: Add the [UCPL interpreter prompt](./ucpl-interpreter-prompt.md) to your `CLAUDE.md` or `AGENTS.md`
2. **Start small**: Use UCPL for routine tasks (code reviews, refactoring)
3. **Build templates**: Create reusable patterns for common workflows
4. **Measure consistency**: Track how results improve across repeated prompts
5. **Use hybrid approach**: Combine UCPL with natural language where needed

## Limitations

1. **Not trained on UCPL**: Models rely on in-context learning (not fine-tuned)
2. **Learning curve**: New syntax requires familiarization
3. **Not human-readable**: Non-practitioners won't understand
4. **Risk of ambiguity**: Aggressive compression can lose semantic meaning

## Converting Existing Prompts

Use the [UCPL converter](../.claude/commands/ucpl.md) to transform natural language prompts:

```bash
# In Claude Code
/ucpl <your_original_prompt>

# In other LLMs
<paste converter prompt + your original prompt>
```

## Examples

See the [examples directory](../examples/) for real-world UCPL prompts:

- [Code review workflow](../examples/code-review-ucpl.md)
- [Parallel task execution](../examples/worktrees-parallel-ucpl.md)
- [Documentation generation](../examples/doc-generation-ucpl.md)

## Additional Resources

- [Quick Reference Card](./QUICK-REFERENCE.md)
- [Tool Syntax Specification](./TOOL_SYNTAX.md)
- [YAML Header Specification](./YAML_HEADER_SPEC.md)
- [Bootstrapping Guide](./BOOTSTRAPPING.md)
- [Quick Start Guide](./QUICK_START.md)

## Status

**Version**: 1.1 (Tool Invocation Update)
**Status**: Experimental - Community validation needed
**Contribute**: Test UCPL on your workflows and share results

---

**Remember**: UCPL isn't about maximum compression—it's about **better prompts** through structure, consistency, and efficiency.
