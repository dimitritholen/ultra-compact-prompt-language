# Publishing to npm via GitHub Actions

This repository is configured with automated publishing to npm using GitHub Actions.

## Setup (One-Time)

### 1. Create npm Access Token

1. Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Click "Generate New Token" → "Classic Token"
3. Select **Automation** token type (required for CI/CD)
4. Copy the token (you won't see it again!)

### 2. Add Token to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `NPM_TOKEN`
5. Value: Paste your npm token
6. Click **Add secret**

## Publishing a New Version

### Automated Publishing (Recommended)

1. **Update version in package.json**:
   ```bash
   npm version patch  # 1.2.0 → 1.2.1
   npm version minor  # 1.2.0 → 1.3.0
   npm version major  # 1.2.0 → 2.0.0
   ```

2. **Push the tag**:
   ```bash
   git push origin main --tags
   ```

3. **GitHub Actions will automatically**:
   - ✅ Run tests
   - ✅ Verify package contents
   - ✅ Publish to npm with provenance
   - ✅ Create a GitHub Release

### Manual Publishing (Fallback)

If you need to publish manually:

```bash
npm login
npm test
npm publish --access public
```

## Workflow Files

### `.github/workflows/publish-mcp-server.yml`
- **Triggers**: On version tags (`mcp-server-v*.*.*`)
- **Actions**:
  1. Runs tests
  2. Publishes to npm
  3. Creates GitHub release

### `.github/workflows/test-mcp-server.yml`
- **Triggers**: On push/PR to main/develop (only when mcp-server/ changes)
- **Actions**:
  1. Tests on multiple OS (Ubuntu, macOS, Windows)
  2. Tests on multiple Node versions (18, 20, 22)
  3. Verifies package installation

## Versioning Strategy

Follow [Semantic Versioning](https://semver.org/):

- **PATCH** (1.2.X): Bug fixes, no breaking changes
- **MINOR** (1.X.0): New features, backward compatible
- **MAJOR** (X.0.0): Breaking changes

## Example: Publishing v1.2.1

```bash
# 1. Make your changes and commit
git add .
git commit -m "fix: resolve token counting issue"

# 2. Bump version in package.json
cd mcp-server
npm version patch -m "chore: release v%s"

# 3. Create mcp-server-specific tag
git tag mcp-server-v1.2.1

# 4. Push changes and tag
git push origin main --tags

# 5. Watch the GitHub Action run
# Visit: https://github.com/dimitritholen/ultra-compact-prompt-language/actions

# 6. Verify on npm
# Visit: https://www.npmjs.com/package/ucpl-compress-mcp
```

## Troubleshooting

### "npm ERR! code ENEEDAUTH"
- Your npm token is missing or invalid
- Re-create the NPM_TOKEN secret in GitHub

### "npm ERR! 403 Forbidden"
- Token doesn't have publish permissions
- Create a new **Automation** token (not Publish token)

### Tests failing in CI
- Run tests locally first: `npm test`
- Check the Actions tab for detailed logs

### Package not updating on npm
- Verify the tag was pushed: `git tag -l`
- Check the workflow ran: GitHub Actions tab
- Ensure version was bumped in package.json

## CI/CD Status Badges

Add to your README.md:

```markdown
[![Tests](https://github.com/dimitritholen/ultra-compact-prompt-language/actions/workflows/test.yml/badge.svg)](https://github.com/dimitritholen/ultra-compact-prompt-language/actions/workflows/test.yml)
[![npm version](https://badge.fury.io/js/ucpl-compress-mcp.svg)](https://www.npmjs.com/package/ucpl-compress-mcp)
```

## Security Notes

- ✅ npm provenance enabled (verifiable builds)
- ✅ Automation token (least privilege)
- ✅ Token stored in GitHub secrets (encrypted)
- ✅ No commit access needed (read-only checkout)

## Manual Workflow Trigger

You can also trigger publishing manually from GitHub:

1. Go to **Actions** tab
2. Select **Publish to npm**
3. Click **Run workflow**
4. Select branch/tag
5. Click **Run workflow**
