# UCPL VS Code Extension

Official VS Code language extension providing IDE support for writing UCPL (Ultra-Compact Prompt Language) prompts.

## What It Does

Adds full language support for `.ucpl` files in VS Code, making UCPL syntax as comfortable to write as Python or JavaScript.

**Without this extension**: Writing UCPL in plain text—no colors, no autocomplete, no help.

**With this extension**: Syntax highlighting, IntelliSense, code snippets, hover documentation, and navigation.

## Features

### 🎨 Syntax Highlighting
Full color-coding for UCPL elements:
- Directives (`@role:`, `@task:`, `@workflow:`)
- Constraints (`!`, `?`, `~`)
- Operators (`&`, `||`, `>`, `^`)
- Tool invocations (`@@`)
- Variables (`$variable`)
- Comments and strings

### 💡 IntelliSense (Autocomplete)
Smart autocomplete for all UCPL syntax:
- Press `Ctrl+Space` to see context-aware suggestions
- Autocomplete directive names, operators, and common patterns
- Parameter suggestions for tool invocations

### 📦 Code Snippets
Quick templates for common patterns:

| Trigger | Description |
|---------|-------------|
| `ucpl-header` | YAML header boilerplate |
| `ucpl-task` | Basic task template |
| `ucpl-workflow` | Sequential workflow |
| `ucpl-macro` | Macro definition |
| `ucpl-conditional` | If/else logic |
| `ucpl-loop` | Loop structure |
| `ucpl-full` | Complete UCPL template |

Type the trigger and press `Tab` to expand.

### 📖 Hover Documentation
Hover over any UCPL element to see:
- Syntax explanation
- Usage examples
- Parameter details

### 🔍 Go to Definition
- Press `F12` on `@use macro_name` to jump to the macro definition
- Works across the same file

### 🔧 Bracket Matching
- Auto-close brackets, quotes, and delimiters
- Highlight matching pairs

## Installation

### From VS Code Marketplace (Recommended)

1. Open VS Code
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac)
3. Search for "UCPL"
4. Click "Install"

### From Source (Development)

```bash
cd vscode-extension
npm install
npm run compile

# Install locally
code --install-extension .
```

## Usage

### Creating a UCPL File

1. Create a new file with `.ucpl` extension
2. The extension auto-activates
3. Start with the YAML header:

```ucpl
---
format: ucpl
version: 1.1
---
```

### Using IntelliSense

Press `Ctrl+Space` anywhere to get suggestions:

```ucpl
---
format: ucpl
version: 1.1
---

@  ← Press Ctrl+Space here to see all directives
```

### Using Snippets

Type `ucpl-` and press `Ctrl+Space` to see all snippets:

```ucpl
ucpl-task  ← Press Tab to expand
```

Expands to:
```ucpl
---
format: ucpl
version: 1.1
---

@role:developer
@task:taskname
@out:format
```

### Hover Help

Hover over `@task:` to see:
```
@task:X|Y|Z
Define the primary task with focus areas.
Example: @task:refactor|optimize|test
```

## Quick Start Example

1. Create `code-review.ucpl`
2. Type `ucpl-full` and press `Tab`
3. Fill in the template:

```ucpl
---
format: ucpl
version: 1.1
---

@role:senior_dev
@task:review|security|performance
@scope:auth_module
!check_sql_injection
!check_xss
@out:bullets+severity

Review the authentication module for security issues.
```

4. Use syntax highlighting and IntelliSense to refine

## Common Patterns

### Code Review Template

```ucpl
---
format: ucpl
version: 1.1
---

@role:reviewer
@task:review|style|security
@out:bullets+priority
!include_line_numbers
>file:path/to/code.py
```

### Workflow Template

```ucpl
---
format: ucpl
version: 1.1
---

@workflow:
  @chain:
    1.@task:analyze > $results
    2.@if $results.issues>0:
        @task:fix_issues
    3.@task:generate_report
```

### Research Task with Tools

```ucpl
---
format: ucpl
version: 1.1
---

@role:researcher
@task:investigate|comprehensive
@@search:web[query="topic", recent=true]
@@think:deep[steps=10]
@@memory:save[key=findings, value=$results]
@out:markdown+citations
```

## Configuration

The extension works out of the box, but you can customize:

### File Associations

Add to VS Code `settings.json`:
```json
{
  "files.associations": {
    "*.ucpl": "ucpl",
    "*.prompt": "ucpl"
  }
}
```

### Theme Colors

UCPL syntax uses standard TextMate scopes that work with all VS Code themes:
- `keyword.control.ucpl` - Directives
- `keyword.operator.ucpl` - Operators
- `support.function.ucpl` - Tool invocations
- `variable.other.ucpl` - Variables

## Tips

1. **Always start with header**: The YAML header identifies your file as UCPL
2. **Use IntelliSense liberally**: Press `Ctrl+Space` often
3. **Leverage snippets**: Type `ucpl-` to quickly scaffold patterns
4. **Hover for help**: Hover over any directive for documentation
5. **Jump to definitions**: Use `F12` to navigate macro definitions

## Language Support

The extension provides syntax support for UCPL v1.1, including:
- Core directives (`@role`, `@task`, `@scope`, `@out`)
- Constraints (`!`, `?`, `~`)
- Operators (`&`, `||`, `>`, `^`)
- Workflows (`@workflow`, `@chain`, `@parallel`)
- Macros (`@def`, `@use`)
- Conditionals (`@if`, `@elif`, `@else`)
- Loops (`@loop`, `@until`)
- Variables (`$var`, `> $var`)
- Tool invocations (`@@capability:subcategory[params]`)
- Comments (`#` single-line, `/* */` multi-line)

## Limitations

1. **No semantic validation**: The extension provides syntax support only, not validation
2. **Single-file navigation**: Go to definition works within a single file
3. **No execution**: This is a language extension, not an interpreter
4. **Basic IntelliSense**: Context-aware suggestions are limited to syntax, not semantic understanding

## Development

### Project Structure

```
vscode-extension/
├── syntaxes/          # TextMate grammar (ucpl.tmLanguage.json)
├── snippets/          # Code snippets (ucpl.json)
├── language-configuration.json  # Language features
├── package.json       # Extension manifest
└── README.md          # Extension documentation
```

### Building from Source

```bash
cd vscode-extension
npm install
npm run compile
```

### Testing

1. Open `vscode-extension/` in VS Code
2. Press `F5` to launch Extension Development Host
3. Open a `.ucpl` file to test features

### Contributing

See [DEVELOPMENT.md](../vscode-extension/docs/DEVELOPMENT.md) for contribution guidelines.

## Troubleshooting

### Extension not activating

1. Check file extension is `.ucpl`
2. Reload VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"
3. Verify extension is installed: `Ctrl+Shift+X` → Search "UCPL"

### Syntax highlighting not working

1. Verify file language mode: Click language indicator in status bar
2. Manually set language: `Ctrl+Shift+P` → "Change Language Mode" → "UCPL"
3. Reinstall extension

### IntelliSense not appearing

1. Verify IntelliSense is enabled: `Ctrl+Shift+P` → "Preferences: Open Settings" → Search "suggest"
2. Manually trigger: Press `Ctrl+Space`
3. Check language configuration is loaded

## Related Resources

- [UCPL Language Specification](./README.LANGUAGE.md)
- [Quick Reference Card](./QUICK-REFERENCE.md)
- [UCPL Examples](../examples/)
- [Report Issues](https://github.com/dimitritholen/ultra-compact-prompt-language/issues)

## Status

**Version**: 1.0.0
**Status**: Production-ready
**License**: MIT

---

**Note**: This extension provides IDE support only. To actually execute UCPL, you need to provide the [UCPL interpreter prompt](./ucpl-interpreter-prompt.md) to your LLM.
