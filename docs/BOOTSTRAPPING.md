# UCPL Bootstrapping Guide

**How any LLM can automatically understand and use UCPL**

---

## Overview

UCPL is designed to be **self-bootstrapping**: any LLM can learn to parse and expand UCPL syntax without prior training, using only the information embedded in UCPL files themselves.

This document explains the bootstrapping mechanism and how to create bootstrappable UCPL files.

## The Three-Component System

### 1. UUIP (Universal UCPL Interpreter Prompt)

**Location**: [`docs/ucpl-interpreter-prompt.md`](./ucpl-interpreter-prompt.md)

A compact (~800 token) meta-prompt that teaches any LLM to:

- Parse UCPL syntax
- Expand compact directives into natural language
- Handle macros, workflows, and conditionals
- Preserve requirements and constraints

**Purpose**: Acts as the "Rosetta Stone" for UCPL interpretation.

### 2. Enhanced YAML Headers

Every UCPL file includes a YAML frontmatter with:

**Required fields:**

```yaml
format: ucpl # Identifies this as UCPL
version: 1.0 # UCPL spec version
parser: ucpl-standard # Parser implementation
```

**Recommended fields:**

```yaml
description: "Brief description"
spec_url: "https://..." # Link to UUIP
tags: [workflow, dev]
updated: "2025-01-15"
```

**Purpose**: Makes files self-describing and version-safe.

### 3. UUIP Reference Comment

Each file starts with:

```html
<!-- UCPL: Expand with UUIP v1.0 | https://github.com/your-repo/ucpl/blob/main/docs/ucpl-interpreter-prompt.md -->
```

**Purpose**: Immediately signals to LLMs where to find interpretation instructions.

## How Bootstrapping Works

### Two-Phase Interpretation

```
┌─────────────────┐
│  UCPL File      │
│  + UUIP         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Phase 1: LLM   │ ← Reads UUIP + UCPL
│  Expands UCPL   │ → Outputs natural language
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Phase 2: LLM   │ ← Receives expanded prompt
│  Executes Task  │ → Performs the work
└─────────────────┘
```

**Key insight**: The same LLM can handle both phases, or different LLMs can specialize (one for parsing, one for execution).

### Example Workflow

**Input (UCPL file):**

```markdown
## <!-- UCPL: Expand with UUIP v1.0 | https://... -->

format: ucpl
version: 1.0
parser: ucpl-standard

---

@role:developer
@task:refactor|optimize
@scope:auth_module
!preserve_functionality
@out:code
```

**Phase 1 (LLM with UUIP):**

```
You are a developer. Your task is to refactor and optimize code in the auth_module.

MUST: Preserve all existing functionality

Output format: Provide the refactored code.
```

**Phase 2 (LLM executes):**

```python
# Refactored auth_module code...
```

## Creating Bootstrappable UCPL Files

### Step 1: Start with Template

Copy [`docs/ucpl-header-template.yaml`](./ucpl-header-template.yaml):

```yaml
<!-- UCPL: Expand with UUIP v1.0 | https://github.com/your-repo/ucpl/blob/main/docs/ucpl-interpreter-prompt.md -->
---
format: ucpl
version: 1.0
parser: ucpl-standard
description: "Your prompt description"
spec_url: "https://github.com/your-repo/ucpl/blob/main/docs/ucpl-interpreter-prompt.md"
tags: [your, tags]
---
# Your UCPL content here
```

### Step 2: Write UCPL Content

Use standard UCPL syntax (see [README.md](../README.md) for full specification).

### Step 3: Validate

Run the validation script:

```bash
python scripts/validate_ucpl.py your-file.md
```

**Checks for:**

- ✓ Required YAML fields
- ✓ UUIP reference comment
- ✓ Valid field values
- ⚠ Recommended fields
- ℹ Optional enhancements

### Step 4: Test Interpretation

**Manual test:**

1. Copy `docs/ucpl-interpreter-prompt.md` content
2. Paste into any LLM
3. Paste your UCPL file
4. Verify expansion is correct

**Automated test (coming soon):**

```bash
python scripts/test_ucpl_expansion.py your-file.md
```

## Using UCPL with Different LLMs

### Claude (via API or UI)

```python
import anthropic

client = anthropic.Anthropic()

# Read UUIP and UCPL file
uuip = open("docs/ucpl-interpreter-prompt.md").read()
ucpl_file = open("examples/developer.md").read()

# Phase 1: Expand UCPL
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    messages=[{
        "role": "user",
        "content": f"{uuip}\n\nExpand this UCPL:\n{ucpl_file}"
    }]
)

expanded_prompt = response.content[0].text

# Phase 2: Execute task
result = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    messages=[{"role": "user", "content": expanded_prompt}]
)
```

### GPT-4 (OpenAI)

```python
from openai import OpenAI

client = OpenAI()

uuip = open("docs/ucpl-interpreter-prompt.md").read()
ucpl_file = open("examples/developer.md").read()

# Phase 1: Expand
expansion = client.chat.completions.create(
    model="gpt-4",
    messages=[{
        "role": "user",
        "content": f"{uuip}\n\nExpand this UCPL:\n{ucpl_file}"
    }]
)

# Phase 2: Execute
result = client.chat.completions.create(
    model="gpt-4",
    messages=[{
        "role": "user",
        "content": expansion.choices[0].message.content
    }]
)
```

### Local Models (Llama, Mistral, etc.)

Works the same way via any inference API (ollama, llama.cpp, etc.)

## Why This Works

### Zero External Dependencies

- No special libraries required
- No training needed
- No API-specific features

### Pattern Recognition

- LLMs excel at grammar inference from examples
- UUIP provides 3-5 concrete examples
- Syntax rules are explicit and compact

### Version Safety

- `version: 1.0` locks compatibility
- Future versions maintain backward compatibility
- Old files work indefinitely

### Portability

- Works with any frontier LLM
- No vendor lock-in
- Can be implemented in any language

## Validation & Quality Assurance

### Automated Validation

```bash
# Validate single file
python scripts/validate_ucpl.py examples/developer.md

# Validate entire directory
python scripts/validate_ucpl.py examples/

# Output
✓ VALID: examples/developer.md
  ℹ Consider setting 'strict: true' for production prompts

Summary: 3/3 files valid
Success rate: 100.0%
```

### Success Metrics

A bootstrappable UCPL file should achieve:

- **<5% expansion error rate** across different LLMs
- **100% field validation** (all required fields present)
- **Semantic preservation** (expanded prompt maintains intent)

### Continuous Integration

Add to CI/CD pipeline:

```yaml
# .github/workflows/validate-ucpl.yml
name: Validate UCPL
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: "3.10"
      - name: Install dependencies
        run: pip install pyyaml
      - name: Validate UCPL files
        run: python scripts/validate_ucpl.py examples/
```

## Advanced Features

### Custom Parsers

Define custom behavior in headers:

```yaml
parser: ucpl-extended
schema: mycompany-v1
```

Then provide extended UUIP for your custom syntax.

### Inline Micro-Grammar

For small extensions, embed rules in YAML:

```yaml
format: ucpl
version: 1.0
parser: ucpl-standard
custom_syntax:
  - "@@agent:X → Delegate task to agent X"
  - "%%priority:N → Set priority level N"
```

### Multi-Language Support

UCPL is language-agnostic. Expand to any natural language:

```yaml
output_language: es # Spanish
```

Then instruct UUIP: "Expand to Spanish natural language"

## Troubleshooting

### "LLM doesn't understand UCPL"

**Cause**: UUIP not provided or outdated

**Fix**: Ensure you're passing the current UUIP with your UCPL file

### "Expansion is incorrect"

**Cause**: UCPL syntax error or ambiguous structure

**Fix**:

1. Run validation: `python scripts/validate_ucpl.py your-file.md`
2. Check syntax against examples
3. Simplify complex nested structures

### "Version mismatch errors"

**Cause**: Using UUIP v2.0 with UCPL v1.0 file

**Fix**: Match UUIP version to YAML header version field

## Future Enhancements

### Planned Features

- [ ] Automated expansion testing suite
- [ ] UCPL→AST parser for programmatic use
- [ ] Browser extension for one-click UCPL expansion
- [ ] VSCode extension with syntax highlighting
- [ ] Online UCPL playground

### Version Roadmap

- **v1.0** (current): Core syntax + bootstrapping
- **v1.1** (Q2 2025): Enhanced macros, type system
- **v2.0** (Q4 2025): Multi-agent workflows, event system

## Resources

- [UUIP Template](./ucpl-interpreter-prompt.md) - The interpreter prompt
- [Header Template](./ucpl-header-template.yaml) - YAML header template
- [YAML Spec](./YAML_HEADER_SPEC.md) - Full field reference
- [Examples](../examples/) - Working UCPL files
- [Validation Script](../scripts/validate_ucpl.py) - Bootstrappability checker

## Contributing

To improve the bootstrapping system:

1. **Test with different LLMs**: Report expansion accuracy
2. **Improve UUIP**: Submit PRs to make it clearer/more compact
3. **Add examples**: Show new use cases
4. **Write adapters**: Create libraries for different languages

## License

This bootstrapping system is part of UCPL and uses the same license as the main project.

---

**Questions?** Open an issue or discussion on GitHub.
