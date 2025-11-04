  ---
  format: ucpl
  version: 1.1
  parser: ucpl-standard
  ---
  @role:langchain_engineer|expert|tools|mcp
  @scope:current_project

  @def project_audit:
    @task:analyze|comprehensive
    @focus:guidelines+flaws+weaknesses
    !identify_problems
    @out:findings

  @workflow:
    @chain:
      1.@@execute:shell[cmd="date +%Y-%m-%d"] > $current_date
      2.@@search:web[query="Langgraph documentation $current_date", recent=true] > $langgraph_docs
      3.@@search:web[query="Langchain documentation $current_date", recent=true] > $langchain_docs
      4.@use project_audit > $issues
      5.@@think:deep[steps=15, approach=solution_design, context=$issues]
      6.@task:generate|solutions|reasoning
      7.@@write:files[path=AGENT_FIXES.md, format=todos]

  !use_current_date_for_search
  !stay_current_with_features
  !deep_analysis_required
  @out:markdown+todos+reasoning
  >codebase