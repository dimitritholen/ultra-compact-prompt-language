# UCPL - Ultra-Compact Prompt Language

Write powerful AI prompts with 90% less tokens using UCPL's compact syntax.

## What is UCPL?

UCPL (Ultra-Compact Prompt Language) is a specialized language for writing token-efficient AI prompts. Instead of verbose natural language instructions, UCPL uses compact directives, operators, and workflows to express complex prompting logic.

## Features

- **Syntax Highlighting** - Full syntax coloring for UCPL directives, constraints, and operators
- **IntelliSense** - Smart autocomplete for all UCPL syntax elements
- **Code Snippets** - Quick templates for common patterns (workflows, macros, tasks)
- **Hover Documentation** - Inline help and syntax explanations
- **Go to Definition** - Jump to macro definitions with F12
- **Bracket Matching** - Auto-close and highlight matching brackets

## Quick Start

1. Create a new file with `.ucpl` extension
2. Start with the YAML header:

```ucpl
---
format: ucpl
version: 1.1
---
```

3. Use IntelliSense (Ctrl+Space) to explore available directives

## Example: Simple Task

```ucpl
---
format: ucpl
version: 1.1
---

@role:developer
@task:refactor|optimize
@scope:auth_module
!preserve_functionality
!add_tests
@out:code+tests
```

This expands to: "You are a developer. Refactor and optimize the auth_module. You MUST preserve functionality and add tests. Output code and tests."

## Core Syntax

### Directives

- `@role:X` - Set the AI role (e.g., `@role:developer`)
- `@task:X|Y` - Define task with focus areas
- `@scope:X` - Limit work to specific area
- `@out:X+Y` - Specify output format

### Constraints

- `!X` - MUST do X (mandatory)
- `?X` - OPTIONAL: X (nice-to-have)
- `~X` - AVOID: X (discouraged)

### Operators

- `&` - AND (all conditions)
- `||` - OR (any condition)
- `>` - Output to / then do
- `^X` - Focus on / prioritize X

### Workflows

```ucpl
@workflow:
  @chain:
    1.step_one
    2.step_two
    3.step_three
```

### Macros (Reusable Functions)

```ucpl
@def validate:
  @task:check|syntax|types
  !fail_fast
  @out:error_report

@use validate > $results
```

## Using Snippets

Type `ucpl-` and press Ctrl+Space to see all available snippets:

- `ucpl-task` - Basic task template
- `ucpl-workflow` - Sequential workflow
- `ucpl-macro` - Macro definition
- `ucpl-conditional` - If/else logic
- `ucpl-loop` - Loop structure
- `ucpl-full` - Complete UCPL template

## Tips

1. **Always start with YAML header** - The header identifies your file as UCPL
2. **Use IntelliSense** - Press Ctrl+Space anywhere to get context-aware suggestions
3. **Hover for help** - Hover over any directive to see documentation
4. **Use snippets** - Type `ucpl-` to quickly scaffold common patterns
5. **Jump to definitions** - Press F12 on `@use` to jump to macro definitions

## More Examples

### Research Task with Tool Usage

```ucpl
---
format: ucpl
version: 1.1
---

@role:researcher
@task:investigate|comprehensive
@@search:web[query="AI prompt optimization", recent=true]
@@think:deep[steps=10]
@out:markdown+citations
```

### Conditional Workflow

```ucpl
---
format: ucpl
version: 1.1
---

@workflow:
  @chain:
    1.@task:analyze_code > $issues
    2.@if $issues.critical>0:
        @task:fix_critical & !run_tests
    3.@task:generate_report
```

## Learn More

- [UCPL Language Specification](https://github.com/dimitritholen/ultra-compact-prompt-language)
- [Examples and Tutorials](https://github.com/dimitritholen/ultra-compact-prompt-language/tree/main/examples)
- [Report Issues](https://github.com/dimitritholen/ultra-compact-prompt-language/issues)

## Contributing

For development setup and contribution guidelines, see [DEVELOPMENT.md](./docs/DEVELOPMENT.md).

## License

MIT - See [LICENSE](../LICENSE)
