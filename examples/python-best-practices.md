---
  format: ucpl
  version: 1.1
  parser: ucpl-standard
  ---
  @role:code_quality_analyst
  @scope:current_folder
  @focus:python_files

  @def analyze_quality:
    @task:analyze|security|documentation|magic_values
    !flag_violations
    @out:issues_list

  @workflow:
    @chain:
      1.@@search:web[query="Python coding best practices 2025", recent=true]
      2.@@search:web[query="best Python static analysis tools 2025", recent=true]
      3.@@read:files[pattern=*.py] > $python_files
      4.@loop: @for each $file in $python_files:
          @use analyze_quality > $violations
          @if $violations.count>0:
            @task:refactor|fix_violations
            @@write:files[path=$file, mode=overwrite]
            !preserve_functionality
            !follow_best_practices

  @out:refactored_files+analysis_report