# Quick Test Guide - UCPL Extension

## Launch Extension (2 minutes)

### Option 1: VS Code GUI

1. Open `/home/dimitri/dev/ultra-compact-prompt-language/vscode-extension` in VS Code
2. Press **F5**
3. A new VS Code window opens with the extension loaded

### Option 2: Command Line

```bash
cd /home/dimitri/dev/ultra-compact-prompt-language/vscode-extension
code .
# Then press F5 in VS Code
```

## Quick Feature Test (5 minutes)

### 1. Test Syntax Highlighting (30 seconds)

Open `test-sample.ucpl` in the Extension Development Host window.

**Expected**:

- YAML header has different colors
- `@role`, `@task` are highlighted
- `@@search:web` is highlighted differently
- `$variables` are highlighted
- `!` constraint is highlighted

### 2. Test IntelliSense (1 minute)

In Extension Development Host, create new file `quick-test.ucpl`:

```ucpl
@
```

**Type `@` and verify**: Dropdown shows role, task, scope, out, workflow, etc.

```ucpl
@role:
```

**Type `@role:` and verify**: Dropdown shows dev, audit, teach, etc.

```ucpl
@@
```

**Type `@@` and verify**: Dropdown shows search:web, think:deep, etc.

### 3. Test Snippets (1 minute)

Type: `ucpl-task` then press **Tab**

**Expected**: Full task structure with tab stops

Type: `ucpl-workflow` then press **Tab**

**Expected**: Workflow template with chain

### 4. Test Hover (30 seconds)

Hover mouse over `@role` in your file

**Expected**: Tooltip shows "Role Directive" documentation

## Verification Checklist

Quick 2-minute checklist:

- [ ] Extension activates (no errors in Output > Extension Host)
- [ ] Syntax highlighting works
- [ ] `@` triggers completions
- [ ] `@role:` triggers role values
- [ ] `@@` triggers tool completions
- [ ] Snippets work (ucpl-task)
- [ ] Hover shows documentation

## Troubleshooting

### Extension doesn't activate

Check: View > Output > Extension Host
Look for: "UCPL extension is now active"

### No syntax highlighting

Check: File has `.ucpl` extension
Check: Bottom-right corner shows "UCPL" language

### IntelliSense doesn't work

Try: Ctrl+Space to manually trigger
Check: Developer Console (Help > Toggle Developer Tools) for errors

## Success Criteria

If all checks pass, the extension is working correctly and ready for production use.

## Next Steps

- Review full TESTING.md for comprehensive testing
- Test with real UCPL files from examples/
- Provide feedback or report issues
