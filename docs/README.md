# GitHub Actions Workflows

This directory contains automated workflows for the UCPL repository.

## Workflows

### `publish-extension.yml`

Automatically publishes the VS Code extension to the marketplace and creates GitHub releases.

**Triggers:**

- Push to `main` branch with changes in `vscode-extension/` (excluding markdown files)
- Manual dispatch via GitHub Actions UI (allows version bump selection)

**What it does:**

1. Determines version bump type from conventional commits (feat → minor, fix → patch, breaking → major)
2. Bumps version in `package.json`
3. Compiles TypeScript and packages the extension
4. Commits version bump back to the repository
5. Creates a git tag (`vscode-extension-vX.X.X`)
6. Creates a GitHub release with the `.vsix` file
7. Publishes to VS Code Marketplace (requires `VSCE_PAT` secret)

**Required Secrets:**

- `VSCE_PAT`: Personal Access Token for VS Code Marketplace (set in repository settings)

**Required Repository Settings:**
To ensure the workflow can push commits and tags:

1. Go to Settings → Actions → General
2. Under "Workflow permissions", ensure:
   - ✓ "Read and write permissions" is selected
   - ✓ "Allow GitHub Actions to create and approve pull requests" is checked (if needed)

## Commit Conventions

See [COMMIT_CONVENTION.md](../.github/COMMIT_CONVENTION.md) for the conventional commit format used to determine version bumps.
