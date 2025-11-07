# Commit Message Convention

This project uses **Conventional Commits** for automated semantic versioning.

## Quick Reference

| Commit Prefix                  | Version Bump          | Example                                  |
| ------------------------------ | --------------------- | ---------------------------------------- |
| `fix:`                         | Patch (0.1.0 → 0.1.1) | `fix: correct hover tooltip positioning` |
| `feat:`                        | Minor (0.1.0 → 0.2.0) | `feat: add code folding support`         |
| `feat!:` or `BREAKING CHANGE:` | Major (0.1.0 → 1.0.0) | `feat!: change directive syntax`         |
| `docs:`                        | No bump               | `docs: update installation guide`        |
| `chore:`                       | No bump               | `chore: update dependencies`             |

## Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

Choose one:

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only
- **style**: Formatting, missing semicolons, etc.
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding or updating tests
- **build**: Build system or external dependencies
- **ci**: CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files
- **revert**: Reverts a previous commit

### Scope (Optional)

The scope should be the name of the affected component:

- `syntax` - Syntax highlighting
- `intellisense` - Autocomplete features
- `snippets` - Code snippets
- `hover` - Hover documentation
- `definition` - Go to definition
- `extension` - Extension logic

### Subject

- Use imperative, present tense: "add" not "added" or "adds"
- Don't capitalize first letter
- No period (.) at the end
- Keep under 50 characters

### Body (Optional)

- Explain **what** and **why** (not how)
- Use imperative, present tense
- Wrap at 72 characters

### Footer (Optional)

- Reference issues: `Closes #123` or `Fixes #456`
- Breaking changes: `BREAKING CHANGE: description`

## Examples

### Bug Fix (Patch: 0.1.0 → 0.1.1)

```
fix(syntax): correct string literal highlighting

String literals with escaped quotes were not properly highlighted.
This fix updates the TextMate grammar to handle escape sequences.

Fixes #42
```

### New Feature (Minor: 0.1.0 → 0.2.0)

```
feat(snippets): add loop and conditional snippets

Add new snippets for common UCPL patterns:
- ucpl-loop: for loop structures
- ucpl-conditional: for if/else statements

These snippets improve developer productivity when writing UCPL files.
```

### Breaking Change (Major: 0.1.0 → 1.0.0)

```
feat(syntax)!: update directive syntax to use @ prefix

BREAKING CHANGE: All directives now require @ prefix.
Old syntax like `role:developer` is no longer supported.
Use `@role:developer` instead.

Migration guide:
- Find: `^(role|task|scope):`
- Replace: `@$1:`
```

Or with footer:

```
feat(syntax): redesign macro definition syntax

Change macro syntax for better clarity and consistency
with other directive formats.

BREAKING CHANGE: Macro definition syntax changed from
`@def name:` to `@macro name:`. Update all existing macros.
```

### Documentation Only (No Bump)

```
docs: add troubleshooting section to README

Add common issues and solutions based on user feedback.
```

### Chore (No Bump)

```
chore: update TypeScript to 5.3.3

Update TypeScript and related type definitions to latest versions.
```

## Multiple Changes in One Commit

If you have multiple changes, prefer multiple commits:

```bash
git commit -m "feat(syntax): add support for nested macros"
git commit -m "fix(hover): resolve tooltip positioning issue"
git commit -m "docs: update macro usage examples"
git push
```

The workflow will analyze all commits and use the highest version bump.

## Skip CI

To push without triggering the publishing workflow:

```
docs: update README [skip ci]
```

or

```
chore: update dependencies

[skip ci]
```

## Validation

Before committing, ask yourself:

- [ ] Does my commit message follow the format?
- [ ] Is the type correct?
- [ ] Is the subject clear and concise?
- [ ] If breaking change, did I add `!` or `BREAKING CHANGE:`?

## Tools

Consider installing a commit message linter:

```bash
npm install -g commitizen
npm install -g @commitlint/cli @commitlint/config-conventional
```

## More Information

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Angular Commit Guidelines](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)
- [Semantic Versioning](https://semver.org/)
