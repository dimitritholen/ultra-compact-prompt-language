# Automated Code Refactoring Workflow

This UCPL prompt demonstrates a complete workflow using macros, chains, variables, and loops for automated code review and refactoring.

## UCPL Prompt

```ucpl
@def list_code_files:
  @task:extract|recursive
  @scope:code_files
  @filter:*.py|*.js|*.ts|*.java|*.go|*.rs
  @out:json+paths
  !exclude_tests&!exclude_node_modules

@def comprehensive_review:
  @role:senior_dev
  @task:review
  @focus:^clean_code&^DRY&^complexity&^coverage
  @add:magic_strings+magic_numbers+documentation+type_safety
  @out:json+score+issues
  @order:severity_desc
  @constraint:complexity<15|suggest_split
  @constraint:coverage_target>80%
  !actionable_recommendations

@def smart_refactor:
  @task:refactor
  @apply:review_recommendations
  @add:type_hints+docstrings+unit_tests
  !preserve_functionality&!preserve_api
  @out:code+diff+test_results
  @validate:tests_pass
  ^readability&^maintainability

@def generate_report:
  @task:summarize
  @out:markdown+table
  @add:before_after_metrics+improvements
  @style:executive_summary

@workflow:
  @use list_code_files > $file_list

  @chain:
    @for $file in $file_list:
      1.@use comprehensive_review > $review_$file
      2.@if $score_$file<70:
        @use smart_refactor > $refactored_$file
        @use comprehensive_review > $final_review_$file
        @store:improvements[$file]={"before":$score_$file,"after":$score_final_$file}
      3.@elif $score_$file<85:
        @task:flag|minor_improvements
        @store:flagged[$file]=$review_$file

  @use generate_report > $final_report
  @out:markdown+json
  @target:avg_score>85%

>folder:$ARGUMENTS[0]
```

## Natural Language Translation

**Workflow Overview:**
Execute an automated code quality improvement workflow on a specified folder (provided as argument).

**Macro Definitions:**

1. **list_code_files**: Recursively extract all code files (Python, JavaScript, TypeScript, Java, Go, Rust) from the target folder, excluding test files and node_modules. Output as JSON with file paths.

2. **comprehensive_review**: As a senior developer, perform a comprehensive code review focusing on:
   - Clean code principles (high priority)
   - DRY violations (high priority)
   - Cyclomatic complexity (high priority)
   - Test coverage (high priority)
   - Magic strings and numbers
   - Documentation quality
   - Type safety

   Output as JSON with numeric score and prioritized issues list. Flag functions with complexity > 15 for splitting. Target 80%+ test coverage. Provide actionable recommendations.

3. **smart_refactor**: Refactor code based on review recommendations while preserving functionality and API compatibility. Add type hints, docstrings, and unit tests. Output refactored code with diff and test results. Validate that all tests pass. Prioritize readability and maintainability.

4. **generate_report**: Create an executive summary in markdown format with before/after metrics table and documented improvements.

**Execution Flow:**

1. List all code files in the specified folder → store in `$file_list`

2. For each file in `$file_list`, execute sequentially:
   - **Step 1**: Run comprehensive review → store results in `$review_[filename]`
   - **Step 2**: If score < 70 (poor quality):
     - Apply smart refactoring → store in `$refactored_[filename]`
     - Re-run comprehensive review → store in `$final_review_[filename]`
     - Track improvement metrics: before score vs after score
   - **Step 3**: Else if score < 85 (acceptable but improvable):
     - Flag for minor improvements
     - Store review for later reference

3. Generate comprehensive report summarizing all improvements

4. Output final report in both markdown and JSON formats

5. Target: Achieve average code quality score > 85% across all files

**Input**: Folder path from command-line arguments (`$ARGUMENTS[0]`)

## Token Efficiency

- **UCPL**: ~95 tokens
- **Natural Language Equivalent**: ~350+ tokens
- **Savings**: 73% reduction

## Key Features Demonstrated

✓ Variable capture and storage (`> $variable`)
✓ Multiple macro definitions (`@def`)
✓ Macro composition (`@use`)
✓ Conditional workflows (`@if/@elif`)
✓ Iterative processing (`@for $item in $list`)
✓ Nested variable naming (`$score_$file`)
✓ Data structure storage (`improvements[$file]`)
✓ Complex constraints and validation
✓ Multi-format output
✓ Argument passing (`$ARGUMENTS[0]`)
✓ Sequential chaining with dependencies
✓ Score-based branching logic

## Usage Example

```bash
# Execute workflow on project source folder
ucpl refactor.md --args ./src

# Or with explicit path
ucpl refactor.md --args /home/user/project/src
```

## Expected Output Structure

```markdown
# Code Refactoring Report

## Summary
- Total files analyzed: 24
- Files refactored: 8
- Files flagged: 6
- Files passing: 10
- Average score improvement: 67.3 → 87.5

## Detailed Results

| File | Before | After | Issues Fixed | Status |
|------|--------|-------|--------------|--------|
| auth.py | 62 | 89 | 12 | ✓ Refactored |
| utils.js | 71 | 88 | 8 | ✓ Refactored |
| api.ts | 78 | 82 | 3 | ⚠ Flagged |
...

## Key Improvements
- Reduced complexity in 15 functions
- Added 156 type hints
- Improved test coverage: 64% → 83%
- Eliminated 43 magic numbers
- Added/improved 89 docstrings
```

## Notes

- The workflow is idempotent and safe (preserves functionality)
- All refactorings are validated with automated tests
- Original files can be backed up by adding `!backup_originals` constraint
- Customize thresholds by adjusting score conditions (70, 85)
- Add `@tool:ruff|pylint|eslint` for language-specific linting
