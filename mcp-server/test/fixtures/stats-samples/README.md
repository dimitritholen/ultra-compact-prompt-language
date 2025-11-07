# Test Fixtures - Production Stats Samples

## Overview

These fixtures contain anonymized production statistics samples for realistic testing. They replace hardcoded mock data in test files with patterns observed in actual usage.

## Fixture Files

### `cost-reporting.json`

**Purpose**: Testing cost aggregation and reporting functionality
**Scenarios**:

- Multiple LLM models (Claude Sonnet 4, GPT-4o, Claude Opus 4, Gemini 2.0 Flash)
- Various compression levels (full, signatures, minimal)
- Different output formats (text, summary)
- Realistic token counts (2,450 - 15,680 original tokens)
- Accurate cost calculations based on 2025-11-06 pricing
- Multiple clients (claude-desktop, claude-code, cursor, windsurf, unknown)

**Total Cost Savings**: $0.18133 USD across 5 compressions

### `retention-recent.json`

**Purpose**: Testing recent compression tracking (last 30 days)
**Scenarios**:

- All records within RECENT_DAYS threshold (30 days)
- Multiple programming languages (Rust, JavaScript, Python, TypeScript)
- Different models and clients
- Timestamps spread across October-November 2025

**Total**: 4 recent compressions

### `retention-mixed.json`

**Purpose**: Testing multi-tier aggregation (recent → daily → monthly)
**Scenarios**:

- **Recent tier**: 2 compressions (last 30 days)
- **Daily tier**: 2 compressions (31-365 days ago)
- **Monthly tier**: 3 compressions (>365 days ago, up to 5 years)
- Time range: May 2023 - November 2025
- Tests retention policy enforcement

**Total**: 7 compressions across all tiers

### `retention-old-format.json`

**Purpose**: Testing migration from legacy stats format (v1.0 → v2.0)
**Scenarios**:

- Old `compressions` array format (pre-aggregation)
- Records spanning multiple retention tiers
- No `version`, `daily`, or `monthly` fields (legacy structure)
- Tests `migrateStatsFormat()` function

**Total**: 5 compressions requiring migration

## Data Generation Process

### Source

Fixtures are based on actual production usage patterns from `~/.ucpl/compress/compression-stats.json` with the following modifications:

### Anonymization

1. **File paths**: Real paths replaced with generic patterns
   - `/home/user/projects/...` → `/projects/...`
   - Remove user-specific identifiers
   - Preserve file extensions and structure semantics

2. **Sensitive data**: No API keys, credentials, or personal information

### Realistic Patterns

1. **Token counts**: Based on actual compression results
   - Original: 2,450 - 15,680 tokens (typical code files)
   - Compressed: 150 - 1,800 tokens (70-99% reduction)
   - Compression ratios: 0.06 - 0.16 (realistic ranges)

2. **Cost calculations**: Accurate as of 2025-11-06
   - Claude Sonnet 4: $3.00/MTok
   - Claude Opus 4: $15.00/MTok
   - GPT-4o: $2.50/MTok
   - Gemini 2.0 Flash: $0.10/MTok

3. **Timestamps**: Realistic distributions
   - Recent: Last 1-30 days
   - Daily: 31-365 days ago
   - Monthly: 1-5 years ago

4. **Compression levels**:
   - `full`: 70-80% reduction (most common)
   - `signatures`: 80-90% reduction
   - `minimal`: 85-95% reduction

## Usage in Tests

### Loading Fixtures

```javascript
const fs = require("fs").promises;
const path = require("path");

async function loadFixture(filename) {
  const fixturePath = path.join(
    __dirname,
    "test/fixtures/stats-samples",
    filename,
  );
  const data = await fs.readFile(fixturePath, "utf-8");
  return JSON.parse(data);
}

// Example usage
const costData = await loadFixture("cost-reporting.json");
const recentData = await loadFixture("retention-recent.json");
```

### Test Coverage

- ✅ `test-cost-reporting.js`: Uses `cost-reporting.json`
- ✅ `test-stats-retention.js`: Uses `retention-*.json` files

## Maintenance

### When to Update Fixtures

1. **Schema changes**: Update all fixtures when stats format changes
2. **Pricing updates**: Update `pricePerMTok` when model pricing changes
3. **New models**: Add new model examples when supported models expand
4. **Edge cases**: Add new fixtures when bugs reveal missing scenarios

### Validation

All fixtures should:

- Match the current stats schema version
- Have accurate cost calculations (`tokensSaved * pricePerMTok / 1,000,000`)
- Use realistic compression ratios (0.06 - 0.20 for production code)
- Include proper ISO 8601 timestamps
- Have anonymized paths with no sensitive information

## Privacy Guarantee

These fixtures contain:

- ✅ Generic file paths
- ✅ Anonymized project structures
- ✅ Realistic token counts
- ✅ Actual model pricing
- ✅ Representative time distributions

These fixtures DO NOT contain:

- ❌ Real file paths with user identifiers
- ❌ Actual code or file contents
- ❌ API keys or credentials
- ❌ Personal information
- ❌ Company-specific data

## Version History

- **v1.0** (2025-11-06): Initial fixtures created from production samples
  - 4 fixture files covering cost reporting and retention scenarios
  - Based on actual compression patterns from November 2025
  - Anonymized paths and realistic data distributions
