# UCPL Quick Start: Making LLMs Understand UCPL Automatically

**TL;DR**: Any LLM can parse UCPL if you give it the UUIP (Universal UCPL Interpreter Prompt) alongside your UCPL file.

---

## 5-Minute Setup

### 1. Create a UCPL File

```markdown
## <!-- UCPL: Expand with UUIP v1.0 | https://your-repo/ucpl/docs/ucpl-interpreter-prompt.md -->

format: ucpl
version: 1.0
parser: ucpl-standard
description: "Code reviewer with quality scoring"

---

@role:senior_engineer
@task:review|security|performance
@scope:auth_module
!check_edge_cases
!check_vulnerabilities
@out:json+score+recommendations
```

### 2. Get the UUIP

Location: `docs/ucpl-interpreter-prompt.md`

This ~800-token prompt teaches any LLM to read UCPL.

### 3. Use It

**Copy-paste method:**

```
[Paste entire UUIP document]

Now expand this UCPL file:
[Paste your UCPL file]
```

**Programmatic method:**

```python
uuip = open("docs/ucpl-interpreter-prompt.md").read()
ucpl = open("my-prompt.md").read()

response = llm.query(f"{uuip}\n\nExpand this UCPL:\n{ucpl}")
```

### 4. Validate

```bash
python scripts/validate_ucpl.py my-prompt.md
```

---

## What Gets Created

The UUIP expands your compact UCPL into full natural language:

**UCPL Input (14 lines)**

```
@role:senior_engineer
@task:review|security|performance
@scope:auth_module
!check_edge_cases
@out:json+score
```

**Natural Language Output (~50 words)**

```
You are a senior engineer. Your task is to review code with focus
on security and performance. Limit your review to the auth_module.

MUST: Check for edge cases and boundary conditions

Output format: Provide a JSON object with a quality score and
detailed recommendations.
```

**Token Savings**: ~60% reduction in prompt size

---

## File Structure

```
your-ucpl-file.md
├── <!-- UUIP comment -->        ← LLM knows where to find grammar
├── YAML Header                  ← Self-describing metadata
│   ├── format: ucpl             ← Signals UCPL mode
│   ├── version: 1.0             ← Spec version
│   └── parser: ucpl-standard    ← Which parser to use
└── UCPL Content                 ← Your compact prompt
```

---

## Core Syntax (Reminder)

| Syntax    | Meaning          | Example                   |
| --------- | ---------------- | ------------------------- |
| `@role:X` | Set role         | `@role:architect`         |
| `@task:X` | Define task      | `@task:debug\|optimize`   |
| `!X`      | MUST requirement | `!preserve_api`           |
| `?X`      | Optional         | `?add_comments`           |
| `~X`      | Avoid            | `~premature_optimization` |
| `@out:X`  | Output format    | `@out:code+tests`         |
| `&`       | AND              | `security&performance`    |
| `\|\|`    | OR               | `refactor\|\|document`    |
| `^X`      | Focus/priority   | `^readability`            |

Full syntax: [README.md](../README.md)

---

## Why This Works

1. **Self-contained**: Everything needed is in the file
2. **Zero training**: LLMs learn from examples in UUIP
3. **Version-safe**: `version: 1.0` ensures compatibility
4. **Portable**: Works with GPT, Claude, Llama, any LLM

---

## Common Use Cases

### Development Workflows

```yaml
@role:staff_engineer
@workflow:
  @chain:
    1.@task:analyze_codebase
    2.@task:implement_feature
    3.@task:write_tests
    4.@task:verify_quality
```

### Research Tasks

```yaml
@role:researcher
@task:investigate|comprehensive
@sources:academic&technical
@out:markdown+citations
!verify_sources
!date_sensitive
```

### Code Review

```yaml
@role:senior_dev
@task:review|security|style
@focus:^security&^maintainability
@out:json+score+issues
!actionable_recommendations
```

---

## Next Steps

- **Learn full syntax**: [README.md](../README.md)
- **See examples**: [examples/](../examples/)
- **Deep dive**: [BOOTSTRAPPING.md](./BOOTSTRAPPING.md)
- **Contribute**: [GitHub Issues](https://github.com/your-repo/ucpl/issues)

---

## Quick Validation

```bash
# Check if your file is bootstrappable
python scripts/validate_ucpl.py my-file.md

# Expected output:
✓ VALID: my-file.md
```

---

**That's it!** You now have a self-bootstrapping UCPL file that any LLM can understand.
