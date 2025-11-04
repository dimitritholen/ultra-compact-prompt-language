# Publishing the UCPL VS Code Extension

This document explains how the automated publishing workflow works and how to set it up.

## Overview

The extension uses GitHub Actions to automatically:
1. **Version** the extension using semantic versioning
2. **Build** the .vsix package
3. **Release** on GitHub with the .vsix file
4. **Publish** to the VS Code Marketplace

## Setup

### 1. Configure GitHub Secrets

Add the following secret to your GitHub repository:

**VSCE_PAT** (Personal Access Token for VS Code Marketplace)

To create this token:

1. Go to https://dev.azure.com/
2. Sign in with your Microsoft account
3. Click your profile icon → **Personal access tokens**
4. Click **"+ New Token"**
5. Configure:
   - **Name**: `GitHub Actions Publishing`
   - **Organization**: **All accessible organizations**
   - **Expiration**: 1 year (or your preference)
   - **Scopes**: Click "Show all scopes" → Marketplace
     - ✅ **Acquire**
     - ✅ **Manage**
6. Click **Create** and copy the token
7. Go to your GitHub repo → Settings → Secrets and variables → Actions
8. Click **"New repository secret"**
9. Name: `VSCE_PAT`
10. Value: Paste your token
11. Click **Add secret**

### 2. Ensure Publisher Exists

Make sure you've created your publisher on the VS Code Marketplace:

1. Visit https://marketplace.visualstudio.com/manage
2. Sign in and create publisher with ID: `dimitritholen`

Or via CLI:
```bash
npx @vscode/vsce create-publisher dimitritholen
```

## How It Works

### Automatic Triggering

The workflow triggers on:
- **Push to main branch** with changes in `vscode-extension/` directory
- **Manual trigger** via GitHub Actions UI (with custom version bump)

### Semantic Versioning

The workflow uses **Conventional Commits** to determine version bumps:

| Commit Message | Version Bump | Example |
|----------------|--------------|---------|
| `fix: ...` | **patch** | 0.1.0 → 0.1.1 |
| `feat: ...` | **minor** | 0.1.0 → 0.2.0 |
| `feat!: ...` or `BREAKING CHANGE:` | **major** | 0.1.0 → 1.0.0 |

### Commit Message Format

Use this format for your commits:

```
<type>: <description>

[optional body]

[optional footer]
```

**Types:**
- `feat:` - New feature (minor bump)
- `fix:` - Bug fix (patch bump)
- `docs:` - Documentation only
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

**Breaking Changes:**
- Add `!` after type: `feat!: remove old API`
- Or add footer: `BREAKING CHANGE: description`

### Examples

**Patch Release (0.1.0 → 0.1.1):**
```bash
git commit -m "fix: correct syntax highlighting for variables"
git push
```

**Minor Release (0.1.0 → 0.2.0):**
```bash
git commit -m "feat: add support for nested workflows"
git push
```

**Major Release (0.1.0 → 1.0.0):**
```bash
git commit -m "feat!: redesign macro syntax for better clarity

BREAKING CHANGE: Macro syntax has changed from @def to @macro"
git push
```

## Manual Publishing

You can also manually trigger a release:

1. Go to your GitHub repo
2. Click **Actions** tab
3. Select **"Publish VS Code Extension"** workflow
4. Click **"Run workflow"**
5. Select version bump type (patch/minor/major)
6. Click **"Run workflow"**

## What Happens During Publishing

1. **Checkout code** - Gets the latest code
2. **Setup Node.js** - Installs Node.js 20
3. **Install dependencies** - Runs `npm ci`
4. **Determine version bump** - Analyzes commits or uses manual input
5. **Bump version** - Updates package.json and package-lock.json
6. **Compile TypeScript** - Runs `npm run compile`
7. **Package extension** - Creates .vsix file
8. **Commit version bump** - Commits new version back to repo
9. **Create Git tag** - Tags the release (e.g., `v0.2.0`)
10. **Create GitHub Release** - Creates release with .vsix attachment
11. **Publish to Marketplace** - Uploads to VS Code Marketplace

## Workflow File Location

`.github/workflows/publish-extension.yml`

## Troubleshooting

### "Access Denied" Error

- Verify `VSCE_PAT` secret is set correctly
- Ensure PAT has both "Acquire" and "Manage" scopes
- Check that PAT hasn't expired

### Version Not Bumping

- Check commit messages follow conventional commits format
- Ensure changes are in `vscode-extension/` directory
- Check that `[skip ci]` is not in commit message

### Release Not Created

- Verify `GITHUB_TOKEN` has write permissions
- Check Actions permissions: Settings → Actions → General → Workflow permissions → Read and write permissions

### Publishing Fails

- Ensure publisher `dimitritholen` exists on marketplace
- Verify you're logged in: `npx @vscode/vsce login dimitritholen`
- Check that package.json has correct publisher name

## Testing Locally

Before pushing, you can test locally:

```bash
cd vscode-extension

# Install dependencies
npm install

# Compile
npm run compile

# Package
npx @vscode/vsce package

# Verify the .vsix file
ls -lh *.vsix

# Test install locally
code --install-extension ucpl-language-*.vsix
```

## Skipping CI

If you want to push without triggering the workflow, add `[skip ci]` to your commit message:

```bash
git commit -m "docs: update readme [skip ci]"
```

## Monitoring

- View workflow runs: GitHub repo → **Actions** tab
- View releases: GitHub repo → **Releases** section
- View marketplace: https://marketplace.visualstudio.com/items?itemName=dimitritholen.ucpl-language

## Resources

- [VS Code Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [vsce CLI Documentation](https://github.com/microsoft/vscode-vsce)
