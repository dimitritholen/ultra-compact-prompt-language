---
format: ucpl
version: 1.1
parser: ucpl-standard
description: Parallel task execution with git worktrees and quality gates
tags: [workflow, git, parallel, qa, automation]
---

@role:workflow_orchestrator
@task:implement|parallel|quality_assured
@scope:.tasks/*.json

# Macros for reusable operations

@def qa_check:
  @@read:files[pattern="*{pyproject.toml,eslintrc,prettierrc}*"]
  @@execute:shell[cmd=$linting_tools]
  @task:validate|documentation|complexity|magic_values
  @if $fixable_issues>0:
    @task:autofix
    @loop: @until $linting_errors==0 || $attempts>1

@def merge_workflow:
  @if $qa_passed:
    @@execute:shell[cmd="git merge --no-ff task/${task_id}"]
    @@execute:shell[cmd="git worktree remove ${worktree_path}"]
    @@execute:shell[cmd="git branch -d task/${task_id}"]
    @task:update|status="DONE"
    ^check_unblocked_tasks
  @else:
    @task:log|failure
    ~update_status
    ~merge

# Main workflow

@workflow:
  @chain:
    1.@@read:files[pattern=".tasks/*.json"] > $tasks
    2.@task:parse|build_dep_graph
    3.@task:filter[status="PENDING"] > $pending
    4.@task:identify|parallelizable > $parallel_tasks

    5.@loop $parallel_tasks:
      @@execute:shell[cmd="git worktree add -b task/${id}"]
      @task:launch_agent[type=developer, prompt=$costar]
      @use qa_check > $qa_result
      @use merge_workflow

    6.@task:generate_report

    7.@if $failed_tasks>0:
      @loop $failed_worktrees:
        @task:ask_user[keep_or_remove]
        @if $user_choice=="remove":
          @@execute:shell[cmd="git worktree remove ${path}"]
          @@execute:shell[cmd="git branch -D task/${id}"]
      @out:cleanup_summary

# Constraints

!block_merge_on_fail
!honor_deps
!use_project_configs
!cleanup_success_immediately
~force_delete_without_approval

# Output specification

@out:log+report+summary
@out:format=structured_markdown

# Input
>
>.tasks/*.json
