---
format: ucpl
version: 1.0
parser: ucpl-standard
description: Batch code refactoring workflow with quality scoring and iterative improvement
---
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