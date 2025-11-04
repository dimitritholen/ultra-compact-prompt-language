# UCPL YAML Header Specification

## Overview

UCPL files use YAML frontmatter to signal to LLMs and parsers that the content should be interpreted using the Ultra-Compact Prompt Language format.

## Standard Header Format

```yaml
---
format: ucpl
version: 1.0
parser: ucpl-standard
---
```

## Field Reference

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `format` | string | Identifies file as UCPL (signals parser activation) | `ucpl` |
| `version` | string | UCPL specification version | `1.0` |
| `parser` | string | Parser implementation to use | `ucpl-standard` |

### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `description` | string | Human-readable summary of the prompt | `"Staff engineer workflow"` |
| `encoding` | string | Character encoding (default: utf-8) | `utf-8` |
| `schema` | string | UCPL dialect/variant identifier | `ucpl-extended` |
| `strict` | boolean | Enable strict parsing mode | `true` |
| `author` | string | Prompt author/maintainer | `"DevTeam"` |
| `updated` | string | Last modification date (ISO 8601) | `"2025-01-15"` |

## Parser Types

### `ucpl-standard`
Default parser for UCPL v1.0 specification. Supports all core syntax:
- Directives (`@role`, `@task`, etc.)
- Constraints (`!`, `?`, `~`)
- Operators (`&`, `||`, `^`, etc.)
- Macros (`@def`, `@use`)
- Workflows (`@chain`, `@if`, `@loop`)

### Future Parser Types
- `ucpl-minimal`: Subset parser for basic directives only
- `ucpl-extended`: Parser with experimental features
- `ucpl-strict`: Enforces stricter validation rules

## Usage Examples

### Basic Task

```yaml
---
format: ucpl
version: 1.0
parser: ucpl-standard
description: Debug authentication module
---
@task:debug
@scope:auth_module
@focus:memory_leak
!preserve_functionality
>error_trace
```

### Complex Workflow

```yaml
---
format: ucpl
version: 1.0
parser: ucpl-standard
description: Staff engineer development workflow with quality gates
strict: true
author: DevTeam
updated: 2025-01-15
---
@role:staff_engineer
@principles:YAGNI+CleanCode+SOLID

@def investigate_codebase:
  @task:analyze|patterns|arch|naming|test_framework
  @scope:existing_code
  @out:bullets+conventions
  !match_patterns_mandatory

@workflow:
  @chain:
    1.@use investigate_codebase > $patterns
    2.@use implement_feature > $implementation
    3.@use write_tests > $tests
  @out:markdown+code+tests
```

### Hybrid UCPL + Natural Language

```yaml
---
format: ucpl
version: 1.0
parser: ucpl-standard
description: Architecture design with detailed requirements
---
@role:architect
@task:design|scalable|secure
@out:diagram+rationale
^auth_system
@constraint:100K_req/s

Design a microservices authentication system handling 100K requests/second.
Consider: token rotation, rate limiting, zero-trust architecture.
Include failover strategies and explain trade-offs.
```

## Parser Behavior

When an LLM encounters a file with UCPL headers:

1. **Format Detection**: The `format: ucpl` field signals UCPL mode
2. **Version Check**: Parser validates compatibility with specified version
3. **Parser Selection**: Loads the specified parser (`ucpl-standard`, etc.)
4. **Strict Mode**: If `strict: true`, enforces stricter validation
5. **Context Loading**: Optional fields provide additional context

## Best Practices

### Always Include
- `format`, `version`, and `parser` in all UCPL files
- `description` for complex workflows or shared prompts

### Consider Including
- `strict: true` for production/critical prompts
- `author` and `updated` for team collaboration
- `schema` when using experimental UCPL features

### File Naming
- Use `.ucpl` extension (future convention)
- Or `.md` with UCPL header for compatibility
- Example: `developer-workflow.ucpl` or `developer.md`

## Integration with Tools

### LLM Prompt Detection
```python
def is_ucpl_prompt(content: str) -> bool:
    """Check if content has UCPL header"""
    if content.startswith('---'):
        yaml_end = content.find('---', 3)
        if yaml_end != -1:
            header = yaml.safe_load(content[3:yaml_end])
            return header.get('format') == 'ucpl'
    return False
```

### Parser Selection
```python
def load_ucpl_parser(header: dict):
    """Load appropriate UCPL parser"""
    parser_type = header.get('parser', 'ucpl-standard')
    version = header.get('version', '1.0')

    if parser_type == 'ucpl-standard':
        return UCPLStandardParser(version)
    elif parser_type == 'ucpl-strict':
        return UCPLStrictParser(version)
    # ...
```

## Migration Path

### Existing UCPL Files
1. Add YAML header to existing `.md` files
2. No changes to UCPL content required
3. Backward compatible (files without headers work as before)

### Version Upgrades
When UCPL 2.0 is released:
```yaml
---
format: ucpl
version: 2.0  # Updated version
parser: ucpl-standard-v2
---
```

## Validation

### Valid Header
```yaml
---
format: ucpl
version: 1.0
parser: ucpl-standard
---
```
✅ All required fields present

### Invalid Headers
```yaml
---
format: markdown
---
```
❌ Missing `version` and `parser`

```yaml
format: ucpl
version: 1.0
```
❌ Missing YAML delimiters (`---`)

## Related Documentation

- [README.md](./README.md) - UCPL specification overview
- [examples/developer.md](./examples/developer.md) - Developer workflow example
- [examples/research.md](./examples/research.md) - Research workflow example

## Version History

- **1.0** (2025-01-15): Initial YAML header specification
