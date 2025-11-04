# UCPL Quick Reference

## UCPL Syntax (Prompts)

### Basic Structure
```
@role:developer
@task:implement|test
@out:code+tests
!preserve_api
>input_data
```

### Directives
| Syntax | Meaning |
|--------|---------|
| `@role:X` | Adopt role X |
| `@task:X\|Y` | Task X with focus on Y |
| `@out:X+Y` | Output formats X and Y |
| `@scope:X` | Limit work to X |
| `@principles:X` | Follow principles X |

### Constraints
| Syntax | Meaning |
|--------|---------|
| `!X` | MUST do X (mandatory) |
| `?X` | OPTIONAL: X (nice-to-have) |
| `~X` | AVOID: X (discouraged) |

### Operators
| Syntax | Meaning |
|--------|---------|
| `&` | AND (all conditions) |
| `\|\|` | OR (any condition) |
| `^X` | Priority/focus on X |
| `>X` | Output to X |

### Tool Invocation
```
@@search:web[query="topic"]
@@think:deep[steps=10]
@@compress:context[path=src/, level=full]
@@memory:save[key=findings, value=$results]
```

---

## Context Compression Tool

### Supported Languages

| Language | File Extensions | Compression | Features |
|----------|----------------|-------------|----------|
| **Python** | .py | AST-based (~85-90%) | Classes, functions, docstrings, type hints, imports |
| **JavaScript** | .js, .jsx | Regex-based (~80-85%) | Classes, functions, JSDoc, ES6 imports, arrow functions |
| **TypeScript** | .ts, .tsx | Regex-based (~80-85%) | All JS features + interfaces, types, type annotations |
| **Go** | .go | Regex-based (~75-80%) | Structs, interfaces, functions, methods, packages |
| **Markdown** | .md, .markdown | Structure (~90-95%) | Headings, structure, code blocks, links, summary |

**Auto-detection**: Language is detected from file extension automatically.

### Quick Commands

```bash
# Single file (auto-detects language)
ucpl-compress file.py
ucpl-compress app.js
ucpl-compress main.go
ucpl-compress README.md

# Directory summary
ucpl-compress src/ --format summary

# Explicit language
ucpl-compress file.ts --language typescript

# JSON for LLMs
ucpl-compress file.py --format json

# Pipe input
cat file.py | ucpl-compress
```

### Compression Levels

| Level | Use Case | Savings |
|-------|----------|---------|
| `full` | General use (default) | ~85% |
| `signatures` | API review | ~90% |
| `minimal` | Quick overview | ~95% |

### Output Formats

| Format | Use Case |
|--------|----------|
| `text` | Human-readable (default) |
| `summary` | Token savings table |
| `json` | LLM consumption |

---

## Token Savings

### UCPL (Prompts)
- **Before**: 1,500 tokens (natural language)
- **After**: 250-400 tokens (UCPL schema)
- **Savings**: 70-85%

### Context Compression
- **Before**: 45,000 tokens (full code)
- **After**: 6,000 tokens (compressed)
- **Savings**: 85-90%

### Combined Impact
- **Total session**: 50,000 → 10,000 tokens
- **Savings**: 80% on entire interaction
- **Cost**: ~$0.15 → ~$0.03 per session

---

## Common Patterns

### Code Review
```
@role:reviewer
@task:review|security|performance
@@compress:context[path=src/]
@out:bullets+severity
!actionable_feedback
```

### Architecture Analysis
```
@role:architect
@task:analyze|scalability
@@compress:context[path=src/, level=signatures]
@out:diagram+recommendations
^design_patterns&^bottlenecks
```

### Refactoring
```
@role:developer
@task:refactor|readable
@@compress:context[path=module.py, level=full]
!preserve_functionality
@out:code+tests
```

### Bug Investigation
```
@role:debugger
@task:investigate|fix
# Don't compress - need full code for bugs
@scope:auth_module
!preserve_tests
>error_trace
```

---

## Integration Examples

### With Claude Code
```bash
# Create alias
alias compress='python scripts/ucpl-compress'

# Use in prompts
compress src/ > context.md
# Then paste context.md in conversation
```

### With API
```python
from scripts.ucpl_compress import ContextCompressor

compressor = ContextCompressor(level="full")
result = compressor.compress_code(code, "file.py")

# Send to LLM
messages = [
    {"role": "system", "content": "You are a code reviewer"},
    {"role": "user", "content": result.compressed_content}
]
```

### With UCPL
```
@role:architect
@@compress:context[path=src/]
@task:review|architecture
@out:analysis
```

---

## When to Use What

### Use UCPL When:
- ✅ Need consistent results
- ✅ Repeated workflows
- ✅ Fast iteration
- ✅ Team collaboration

### Use Compression When:
- ✅ Large codebases (>10k tokens)
- ✅ Architecture review
- ✅ API design
- ✅ Code structure analysis

### Don't Compress When:
- ❌ Bug fixing (need full code)
- ❌ Algorithm optimization
- ❌ Small files (<500 tokens)
- ❌ Active debugging

---

## Cheat Sheet

### UCPL Conversion
```bash
# Natural language (1,500 tokens)
"You are a developer. Review this code for security issues.
Output as bullet points with severity ratings."

# UCPL (300 tokens)
@role:developer
@task:review|security
@out:bullets+severity
>code
```

### Context Compression
```bash
# Full code (3,000 tokens)
class AuthService:
    def __init__(self, db, cache):
        # ... 100 lines of implementation

# Compressed (400 tokens)
## AuthService
Methods:
- __init__(db, cache)
- authenticate(credentials) -> User
- verify_token(token) -> bool
```

### Combined Savings
```bash
# Total before: 50,000 tokens
Prompt: 1,500
Context: 45,000
Response: 3,500

# Total after: 10,000 tokens
Prompt: 300 (UCPL)
Context: 6,000 (compressed)
Response: 3,500 (same)

# Savings: 80% ✨
```

---

## Tips

1. **Start simple**: Use UCPL for prompts first
2. **Add compression**: Enable when context >10k tokens
3. **Choose level wisely**: `full` is usually best
4. **Test quality**: Verify output meets needs
5. **Iterate**: Adjust compression level if needed

## Links

- [Full UCPL Spec](../README.md)
- [Context Compression Guide](./CONTEXT-COMPRESSION.md)
- [CLI Tools Documentation](./CLI-TOOLS.md)
- [Tool Syntax Reference](./TOOL_SYNTAX.md)
