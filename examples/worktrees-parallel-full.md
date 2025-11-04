# Parallel Task Execution with Git Worktrees

<role>
Workflow orchestration agent coordinating parallel task execution using git worktrees and specialized sub-agents
</role>

<objective>
Implement all pending tasks from `./.tasks/*.json` in parallel using git worktrees, ensuring each task passes quality checks before merging to main, while preserving dependency order and handling failures gracefully with interactive cleanup.
</objective>

<context>
- **Task storage**: All tasks are in `./.tasks/*.json` files as JSON arrays
- **Task format**: Each task has structure with fields: `id`, `title`, `category`, `priority`, `status`, `dependencies` (array), `framework`, `tags`, `estimatedTokens`, `estimatedHours`, and `prompt` (COSTAR object with context, objective, style, tone, audience, response)
- **Parallelization strategy**: Tasks can run in parallel if their `dependencies` array is empty OR all dependency task IDs are already completed
- **Quality enforcement**: Use existing project linting/analysis configs (pyproject.toml, eslintrc, etc.)
- **Git workflow**: Each task gets its own worktree branched from main
- **Failure policy**: If quality checks fail, block merge but keep worktree for manual review
- **Cleanup policy**: Successful tasks have worktrees removed automatically; failed task worktrees require user decision
</context>

<instructions>

## Step 1: Task Discovery and Analysis

1. Find all JSON files in `./.tasks/` directory
2. Parse each file to extract task array
3. Build dependency graph using `dependencies` field
4. Filter to tasks with `status: "PENDING"`
5. Identify tasks that can run immediately (no unmet dependencies)

## Step 2: Parallel Worktree Creation

For each parallelizable task:

1. Create git worktree with branch name: `task/{task.id}`
2. Base branch on current `main` HEAD
3. Document worktree location and associated task ID

## Step 3: Sub-Agent Task Execution

For each worktree in parallel:

1. Launch Task tool with `subagent_type: "developer"`
2. Pass the task's complete COSTAR prompt from `prompt` object
3. Set working directory to the worktree path
4. Provide context: "Implement this task in the current worktree. Ensure all code has proper documentation, no magic numbers/strings, and follows project conventions."

## Step 4: Quality Assurance

After each task implementation:

1. **Discover linting configs**: Check for pyproject.toml, .eslintrc.json, .prettierrc, tslint.json, etc.
2. **Run configured tools**: Execute linters/formatters found in project configs
3. **Check requirements**:
   - [ ] All linting errors resolved
   - [ ] Code has documentation (docstrings, comments)
   - [ ] No magic numbers or strings
   - [ ] Cyclomatic complexity within limits
4. **Auto-fix attempt**: If fixable issues found, apply auto-fixes and re-run checks
5. **Outcome decision**:
   - ✓ **Pass**: All checks pass → Proceed to merge
   - ✗ **Fail**: Issues remain → Keep worktree, block merge, log failure

## Step 5: Merge and Cleanup (Per Task)

**If quality checks passed:**

1. Switch to main branch
2. Merge worktree branch: `git merge --no-ff task/{task.id}`
3. **Remove worktree immediately**: `git worktree remove path/to/worktree`
4. Delete branch: `git branch -d task/{task.id}`
5. Update task file: Set `status: "DONE"` in `./.tasks/*.json`
6. Check if this task completion unblocks other pending tasks → Add to parallel queue

**If quality checks failed:**

1. Keep worktree intact at current location
2. Keep branch for potential fixes
3. Log failure with details: task ID, worktree path, failing checks
4. Do NOT update task status
5. Continue processing other tasks

## Step 6: Final Report

Generate execution summary:

- ✓ **Completed tasks**: IDs merged to main
- ✗ **Failed tasks**: IDs with worktree locations and failure reasons
- ⏳ **Blocked tasks**: IDs waiting on dependencies
- 📊 **Statistics**: Total tasks, success rate, elapsed time

## Step 7: Interactive Worktree Cleanup

**If any tasks failed (have preserved worktrees):**

For each failed task worktree:

1. Use `AskUserQuestion` tool with format:

   ```
   Task {id}: {title} failed quality checks
   Worktree location: {path}
   Failure reason: {reason}

   What would you like to do with this worktree?
   A) Keep for manual review/fixes
   B) Remove worktree and branch (cannot be undone)
   ```

2. **If user chooses "Keep":**
   - Leave worktree and branch intact
   - Output instructions: "To work on this task: cd {path}"

3. **If user chooses "Remove":**
   - Remove worktree: `git worktree remove {path}`
   - Delete branch: `git branch -D task/{id}` (force delete since unmerged)
   - Optionally reset task status or mark as "FAILED"

4. After all decisions, output final cleanup summary:

   ```
   Worktree Cleanup Summary:
   - Kept for review: {count} ({task IDs})
   - Removed: {count} ({task IDs})
   ```

</instructions>

<output_format>
**Execution Log** (during workflow):

```
[DISCOVERY] Found N tasks: {task IDs}
[PARALLEL] Starting tasks: {IDs with no dependencies}
[WORKTREE] Created task/001 at path/to/worktree/001
[AGENT] Launching developer agent for task 001...
[QA] Running linting for task 001...
[MERGE] Task 001 passed - merging to main
[CLEANUP] Removed worktree for task 001
[FAIL] Task 003 failed quality checks - worktree kept at path/to/worktree/003
```

**Final Summary** (at completion):

```markdown
## Parallel Task Execution Report

### Completed ✓
- Task 001: {title} (merged to main, worktree removed)
- Task 002: {title} (merged to main, worktree removed)

### Failed ✗
- Task 003: {title}
  - Worktree: path/to/worktree/003
  - Branch: task/003
  - Reason: Linting errors in {files}

### Blocked ⏳
- Task 004: {title} (waiting on: 003)

### Statistics
- Total: 4 tasks
- Completed: 2 (50%)
- Failed: 1 (25%)
- Blocked: 1 (25%)
- Duration: 45 minutes
```

**Interactive Cleanup Prompts** (for failed tasks):

```
[User is asked about each failed worktree]

Worktree Cleanup Summary:
- Kept for review: 1 (003)
- Removed: 0

To work on kept worktrees:
- Task 003: cd path/to/worktree/003
```

</output_format>

<success_criteria>

- [ ] All `./.tasks/*.json` files parsed successfully
- [ ] Dependency graph correctly identifies parallelizable tasks
- [ ] Git worktrees created without conflicts
- [ ] Each task executed by appropriate sub-agent with full COSTAR prompt
- [ ] Quality checks run using existing project configs
- [ ] Successful tasks merged to main with `status: "DONE"` update
- [ ] **Successful task worktrees removed immediately after merge**
- [ ] Failed tasks have worktrees preserved for review
- [ ] No merge to main for any task failing quality checks
- [ ] **User prompted for cleanup decision on each failed worktree**
- [ ] **Chosen worktrees removed with both worktree and branch deletion**
- [ ] Final report includes all task outcomes and remaining worktree locations
- [ ] Dependent tasks blocked until dependencies complete
</success_criteria>

<assumptions>
- Main branch is the merge target
- Sub-agent has access to worktree paths
- Linting tools are installed in project environment
- Task dependencies are acyclic (no circular dependencies)
- Sufficient disk space for concurrent worktrees
- Git repository is in clean state before starting
- User is available to respond to cleanup prompts after execution
</assumptions>

<constraints>
- **No merge on failure**: Tasks failing QA must not merge to main
- **Preserve worktrees initially**: Failed task worktrees kept until user decision
- **Immediate cleanup on success**: Remove worktrees/branches right after successful merge
- **Respect dependencies**: Never start a task with unmet dependencies
- **Atomic updates**: Each task's status update is independent
- **Read-only main**: Main branch only updated via successful merges
- **Force delete only user-approved**: Only force-delete unmerged branches if user chooses removal
</constraints>
