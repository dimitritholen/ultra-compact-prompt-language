---
description: Convert natural language prompt to token-efficient UCPL format
argument-hint: [natural language prompt to convert]
context: global
gitignored: false
---

You are a UCPL (Ultra-Compact Prompt Language) converter expert.

## Task

Parse the natural language prompt and convert it to UCPL syntax:

**Component Mapping**:

- Role/persona → `@role:X`
- Main action → `@task:X|modifier1|modifier2`
- Scope/focus area → `@scope:X` or `@focus:X`
- Output format → `@out:format` or `@out:format+details`
- Mandatory constraints → `!constraint`
- Optional elements → `?element`
- Things to avoid → `~avoid`
- High priority items → `^priority`
- Sequential steps → `@chain:` with numbered steps
- Conditional logic → `@if condition:` / `@elif:` / `@else:`
- Reusable components → `@def macro_name:` and `@use macro_name`
- Tool invocations → `@@capability[:subcategory][params]` (v1.1)
- Variables → `$variable_name`
- Input data → `>source`

**Process**:

1. Analyze the natural language prompt step-by-step
2. Identify all components (role, task, constraints, output, etc.)
3. **Detect tool triggers** - look for phrases that imply tool usage:
   - "search the web", "look up", "find information online" → `@@search:web`
   - "search the code", "find in files", "grep for" → `@@search:code`
   - "think deeply", "analyze carefully", "reason through" → `@@think:deep`
   - "fetch from URL", "get webpage", "retrieve from" → `@@fetch:url`
   - "read files", "load file", "get file contents" → `@@read:files`
   - "write to file", "save to", "create file" → `@@write:files`
   - "run command", "execute", "shell command" → `@@execute:shell`
   - "save this", "remember", "persist" → `@@memory:save`
   - "recall", "retrieve saved", "load from memory" → `@@memory:load`
4. **Identify macro opportunities** - scan for patterns that benefit from extraction:
   - **Repeatable operations**: Same action mentioned multiple times with slight variations
   - **Logical groupings**: Related steps that form a cohesive unit (e.g., "validate, fix, test")
   - **Reusable assessments**: Quality checks, reviews, audits that could be invoked multiple times
   - **Token efficiency**: Only create macros if they reduce total token count (typically when reused 2+ times or when grouping saves >15 tokens)
   - **Decision criteria**:
     - CREATE macro if: repetition exists OR grouping reduces tokens significantly
     - SKIP macro if: single-use operation OR overhead exceeds savings
5. Show your reasoning for each mapping decision (including tool triggers and macro decisions)
6. Construct the UCPL equivalent (with `@def` macros if beneficial)
7. Add YAML header with format, version, and parser

**YAML Header Template**:

```yaml
---
format: ucpl
version: 1.1
parser: ucpl-standard
---
```

## Output

Provide:

1. Brief reasoning (bullet points explaining key mappings)
2. Complete UCPL prompt with YAML header

## Examples

**Input**: "Review this code for security issues and provide a bulleted report"

**Reasoning**:

- Task: review with security focus
- Output: bulleted format
- Input: code to be provided

**Output**:

```yaml
---
format: ucpl
version: 1.1
parser: ucpl-standard
---
@task:review|security
@out:bullets
>code
```

---

**Input**: "First analyze the codebase structure, then write comprehensive tests, then run them and generate a coverage report"

**Reasoning**:

- Sequential steps detected (first, then, then) → @chain
- Step 1: analyze structure
- Step 2: write tests with comprehensive modifier
- Step 3: run tests + generate report (combined output)
- Output: coverage report

**Output**:

```yaml
---
format: ucpl
version: 1.1
parser: ucpl-standard
---
@chain:
  1.@task:analyze|structure
  2.@task:test|write|comprehensive
  3.@task:test|run
@out:code+coverage_report
>codebase
```

---

**Input**: "Search the web for recent UCPL documentation, analyze it deeply, and save your findings"

**Reasoning**:

- Tool triggers detected:
  - "Search the web" → @@search:web with recent=true parameter
  - "analyze it deeply" → @@think:deep for analysis
  - "save your findings" → @@memory:save to persist results
- Task: investigate with comprehensive analysis
- Macro opportunity: None (single-use workflow, no repetition)
- Output: Implied findings/report

**Output**:

```yaml
---
format: ucpl
version: 1.1
parser: ucpl-standard
---
@task:investigate|comprehensive
@@search:web[query="UCPL documentation", recent=true]
@@think:deep[steps=10, approach=analytical]
@@memory:save[key=ucpl_findings, value=$results, category=note]
@out:markdown
```

---

**Input**: "Review the code for security issues, performance problems, and maintainability concerns. For each issue found, check if it's critical, and if so, fix it immediately and re-review to confirm the fix. Generate a report at the end."

**Reasoning**:

- Task: Multi-stage review and fix workflow
- Output: Report
- Macro opportunity: **YES** - "review" operation is repeated (initial + re-review after fixes)
  - Macro benefit: Saves ~20 tokens by defining reusable review logic
  - Pattern: review → assess → conditional fix → re-review
- Macro definition: `quality_check` for reusable review logic
- Workflow: Initial review → conditional fix loop → final report

**Output**:

```yaml
---
format: ucpl
version: 1.1
parser: ucpl-standard
---
@def quality_check:
  @task:review|security|performance|maintainability
  @out:bullets+severity

@workflow:
  @use quality_check > $initial_report
  @if $critical_count>0:
    @task:fix|critical
    !test_after
    @use quality_check > $final_report
  @out:comparison_report
>codebase
```

**Token comparison**:

- Without macros: ~75 tokens
- With macros: ~55 tokens
- Savings: 27%

## Reference

See `.claude/skills/ucpl-parser.md` for complete UCPL syntax specification.

Now convert: $ARGUMENTS
