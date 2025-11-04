# Testing the UCPL VS Code Extension

This guide explains how to test the UCPL extension in VS Code's Extension Development Host.

## Prerequisites

1. VS Code installed (version 1.74.0 or higher)
2. Node.js and npm installed
3. Extension dependencies installed (`npm install`)
4. Extension compiled (`npm run compile`)

## Manual Testing in Extension Development Host

### Step 1: Launch Extension Development Host

1. Open the `vscode-extension` folder in VS Code
2. Press **F5** or select **Run > Start Debugging**
3. This opens a new VS Code window with the extension loaded

### Step 2: Test Syntax Highlighting

1. In the Extension Development Host window, create a new file: `test.ucpl`
2. Add the following content:

```ucpl
---
format: ucpl
version: 1.1
---

@role:dev
@task:implement|test
@@search:web[query="test"]
$variable_test
!mandatory_constraint
```

3. Verify syntax highlighting:
   - YAML header should be highlighted differently
   - `@role`, `@task` should be highlighted as keywords
   - `@@search:web` should be highlighted as a tool invocation
   - `$variable_test` should be highlighted as a variable
   - `!` should be highlighted as a constraint operator

### Step 3: Test IntelliSense

1. Type `@` and verify that completion suggestions appear:
   - Should show: role, task, scope, out, workflow, def, if, loop, etc.

2. Type `@role:` and verify that role completions appear:
   - Should show: dev, audit, teach, edit, analyze, debug, design, translate

3. Type `@task:` and verify that task completions appear:
   - Should show: fix, explain, refactor, review, summarize, etc.

4. Type `@@` and verify that tool completions appear:
   - Should show: search:web, search:code, think:deep, etc.

5. Type `@task:refactor|` and verify that modifier completions appear:
   - Should show: concise, formal, beginner, expert, secure, fast, minimal

### Step 4: Test Snippets

1. Type `ucpl-` and press **Ctrl+Space** to see available snippets
2. Test these snippets:
   - `ucpl-header` - Should insert YAML frontmatter
   - `ucpl-task` - Should insert basic task structure
   - `ucpl-workflow` - Should insert workflow with chain
   - `ucpl-if` - Should insert conditional structure
   - `ucpl-def` - Should insert macro definition
   - `tool-search-web` - Should insert web search tool invocation

3. Verify that:
   - Tabstops work correctly (Tab key moves through placeholders)
   - Choice selections work (dropdown for predefined options)
   - Final cursor position ($0) is correct

### Step 5: Test Hover Documentation

1. Hover over `@role` - should show documentation about role directive
2. Hover over `@task` - should show documentation about task directive
3. Hover over `@workflow` - should show documentation about workflow
4. Verify that documentation is displayed in a tooltip with proper formatting

### Step 6: Test with Sample File

Open the included `test-sample.ucpl` file and verify:
- All syntax elements are highlighted correctly
- IntelliSense works throughout the file
- Hover tooltips appear for all directives
- No errors or warnings in the VS Code console

## Expected Results

### Syntax Highlighting
- ✓ YAML frontmatter is highlighted
- ✓ Directives (@role, @task, etc.) are highlighted as keywords
- ✓ Tool invocations (@@search:web) are highlighted distinctly
- ✓ Variables ($var) are highlighted
- ✓ Constraints (!, ?, ~) are highlighted
- ✓ Operators (&, ||, ^, >) are highlighted
- ✓ Strings in quotes are highlighted
- ✓ Comments (#) are highlighted

### IntelliSense
- ✓ Directive completions after @
- ✓ Role completions after @role:
- ✓ Task completions after @task:
- ✓ Modifier completions after |
- ✓ Output format completions after @out:
- ✓ Tool completions after @@

### Snippets
- ✓ All snippets insert correctly
- ✓ Tabstops navigate properly
- ✓ Choice selections work
- ✓ Variable placeholders are functional

### Hover Documentation
- ✓ All directives show documentation
- ✓ Documentation is formatted correctly
- ✓ No JavaScript errors in console

## Debugging

### Check Extension Activation

1. Open **View > Output**
2. Select **Extension Host** from dropdown
3. Look for: "UCPL extension is now active"

### Check for Errors

1. Open **Help > Toggle Developer Tools**
2. Check Console tab for JavaScript errors
3. Common issues:
   - File not found errors → Check paths in package.json
   - JSON parse errors → Validate grammar and snippets JSON
   - Type errors → Run `npm run compile` again

### Verify File Paths

Run from terminal:
```bash
cd vscode-extension
ls -la syntaxes/ucpl.tmGrammar.json
ls -la snippets/ucpl.code-snippets.json
ls -la out/extension.js
```

All files should exist.

## Automated Testing

### Run TypeScript Type Checking

```bash
npm run compile
```

Should complete with no errors.

### Validate JSON Files

```bash
node -e "require('./syntaxes/ucpl.tmGrammar.json'); console.log('Grammar OK')"
node -e "require('./snippets/ucpl.code-snippets.json'); console.log('Snippets OK')"
```

Both should print "OK" messages.

## Common Issues and Solutions

### Issue: Extension doesn't activate
**Solution**:
- Check that `.ucpl` file extension is recognized
- Verify `contributes.languages` in package.json
- Restart Extension Development Host

### Issue: Syntax highlighting not working
**Solution**:
- Verify `syntaxes/ucpl.tmGrammar.json` exists
- Check `contributes.grammars` in package.json
- Validate JSON syntax

### Issue: IntelliSense not appearing
**Solution**:
- Verify `out/extension.js` exists (run `npm run compile`)
- Check Developer Console for activation errors
- Try triggering manually with Ctrl+Space

### Issue: Snippets not showing
**Solution**:
- Verify `snippets/ucpl.code-snippets.json` exists
- Check `contributes.snippets` in package.json
- Try typing full prefix (e.g., `ucpl-task`)

## Performance Testing

Monitor extension performance:

1. Open **Command Palette** (Ctrl+Shift+P)
2. Type "Developer: Show Running Extensions"
3. Find "UCPL - Ultra-Compact Prompt Language"
4. Verify:
   - Activation time < 100ms
   - No significant memory usage
   - No excessive CPU usage

## Test Coverage Checklist

Use this checklist to ensure complete testing:

- [ ] Extension activates on .ucpl file
- [ ] YAML frontmatter highlighted
- [ ] All directive keywords highlighted
- [ ] Tool invocations highlighted
- [ ] Variables highlighted
- [ ] Constraints highlighted
- [ ] Operators highlighted
- [ ] Strings highlighted
- [ ] Comments highlighted
- [ ] @ triggers directive completions
- [ ] @role: triggers role completions
- [ ] @task: triggers task completions
- [ ] @task:x| triggers modifier completions
- [ ] @out: triggers output completions
- [ ] @@ triggers tool completions
- [ ] All snippets insert correctly
- [ ] Tabstops work in snippets
- [ ] Choice selections work in snippets
- [ ] Hover shows docs for @role
- [ ] Hover shows docs for @task
- [ ] Hover shows docs for @workflow
- [ ] Hover shows docs for @if
- [ ] Hover shows docs for @def
- [ ] No console errors
- [ ] Extension performance acceptable

## Next Steps

After manual testing passes:

1. Consider adding automated tests (see `src/test/` directory)
2. Test on different VS Code versions
3. Test on different operating systems (Windows, macOS, Linux)
4. Gather user feedback
5. Iterate on features and fixes

## Reporting Issues

If you find issues during testing:

1. Note the VS Code version
2. Capture screenshots or video
3. Check Developer Console for errors
4. Document steps to reproduce
5. File an issue in the repository
