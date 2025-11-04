# Getting Started with UCPL VS Code Extension Development

Quick guide to get the extension up and running.

## Prerequisites

- Node.js 20+ and npm
- VS Code
- TypeScript knowledge (helpful)

## Setup

1. **Navigate to the extension folder**

```bash
cd vscode-extension/
```

2. **Install dependencies**

```bash
npm install
```

This will install:
- `vscode` types for extension API
- TypeScript compiler
- Testing frameworks

3. **Compile TypeScript**

```bash
npm run compile
```

Or watch for changes:

```bash
npm run watch
```

## Run the Extension

### Method 1: Press F5

1. Open `vscode-extension/` folder in VS Code
2. Press `F5` (or Run → Start Debugging)
3. A new "Extension Development Host" window opens
4. Create a test file: `test.ucpl`
5. Start typing UCPL syntax

### Method 2: Command Palette

1. Open Command Palette: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type: "Debug: Start Debugging"
3. Select "Run Extension"

## Testing the Extension

Try these in your test `.ucpl` file:

### 1. Syntax Completion

Type `@` and see directive suggestions:
```ucpl
@role:
@task:
@scope:
```

### 2. Value Completion

Type `@role:` and see role suggestions:
```ucpl
@role:dev
@role:audit
```

### 3. Hover Information

Hover over `@role` to see documentation

### 4. Tool Invocations

Type `@@` to see tool completions:
```ucpl
@@search:web
@@think:deep
@@memory:save
```

## Project Structure

```
vscode-extension/
├── src/
│   └── extension.ts          # Main extension code (START HERE)
├── syntaxes/
│   └── ucpl.tmGrammar.json   # Syntax highlighting rules (TODO)
├── snippets/
│   └── ucpl.code-snippets.json  # Code snippets (TODO)
├── .vscode/
│   ├── launch.json           # Debug configuration
│   └── tasks.json            # Build tasks
├── package.json              # Extension manifest
├── language-configuration.json  # Language config (brackets, comments, etc.)
└── tsconfig.json             # TypeScript config
```

## Next Steps

### Phase 1: Complete Basic Features (Current)

✅ Basic completion provider (directives, roles, tasks)
✅ Hover provider (documentation tooltips)
✅ Language configuration (brackets, comments)

### Phase 2: Add Syntax Highlighting

Create `syntaxes/ucpl.tmGrammar.json` based on [DEVELOPMENT.md](./DEVELOPMENT.md) Section 3.

### Phase 3: Add Snippets

Create `snippets/ucpl.code-snippets.json` for common patterns:
- Basic task
- Workflow
- Macro definition

### Phase 4: Advanced Features

- Go to Definition (@use → @def)
- Find References
- Validation/Diagnostics
- YAML header validation

See [DEVELOPMENT.md](./DEVELOPMENT.md) for complete implementation guide.

## Common Issues

### "Cannot find module 'vscode'"

**Fix**: Run `npm install`

### "Extension not activating"

**Fix**: Check `package.json` → `activationEvents` should be empty (auto-populated in VS Code 1.74+)

### "Syntax highlighting not working"

**Fix**: Create `syntaxes/ucpl.tmGrammar.json` first (see Phase 2)

### "Changes not showing"

**Fix**:
1. Stop debug session
2. Run `npm run compile`
3. Press F5 again

## Development Workflow

1. **Make changes** to `src/extension.ts`
2. **Compile**: `npm run compile` (or use watch mode)
3. **Test**: Reload Extension Development Host window
   - Command Palette → "Developer: Reload Window"
   - Or restart debug session (Ctrl+Shift+F5)

## Debugging

### Set Breakpoints

1. Open `src/extension.ts`
2. Click left margin to set breakpoint (red dot)
3. Press F5
4. Trigger the feature (e.g., type `@` for completion)
5. Debugger pauses at breakpoint

### View Logs

- **Debug Console**: Bottom panel in VS Code
- **Extension Host**: All console.log() output appears here

## Publishing (Later)

Once ready for public release:

1. Create publisher account: [VS Code Marketplace](https://marketplace.visualstudio.com/manage)
2. Install vsce: `npm install -g @vscode/vsce`
3. Package: `vsce package`
4. Publish: `vsce publish`

See [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)

## Resources

- [DEVELOPMENT.md](./DEVELOPMENT.md) - Complete implementation reference
- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Samples](https://github.com/microsoft/vscode-extension-samples)

## Getting Help

- Check [DEVELOPMENT.md](./DEVELOPMENT.md) Section 13 for official docs
- Review [VS Code Extension Guide](https://code.visualstudio.com/api/get-started/your-first-extension)
- Search [VS Code Extension Issues](https://github.com/microsoft/vscode/issues)

---

**Ready to start?** Open `src/extension.ts` and explore the code!
