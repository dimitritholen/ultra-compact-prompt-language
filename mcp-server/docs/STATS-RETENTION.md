# Multi-tier Statistics Retention System

## Problem

The MCP server tracked compression statistics in a flat array that grew indefinitely, eventually leading to massive file sizes.

## Solution

Implemented a multi-tier time-based aggregation system that maintains historical data while keeping file size bounded.

## Architecture

### Storage Tiers

```javascript
{
  version: "2.0",
  recent: [],      // Individual records (last 30 days)
  daily: {},       // Daily aggregates (31-395 days old)
  monthly: {},     // Monthly aggregates (395 days - 5 years)
  summary: {}      // All-time totals
}
```

### Retention Policy (Aggressive: 30/365/5y)

| Tier    | Retention | Detail Level                          | Max Records |
| ------- | --------- | ------------------------------------- | ----------- |
| Recent  | 30 days   | Full detail (individual compressions) | ~2,100\*    |
| Daily   | 365 days  | Aggregated by day                     | 335         |
| Monthly | 5 years   | Aggregated by month                   | 60          |

\*Assumes ~70 compressions/day average

**Total maximum records: ~2,500** (vs infinite growth in old system)

## Features

### 1. Automatic Migration

Old format (v1.0) automatically migrates to new multi-tier format on first load:

```javascript
// Old format
{
  compressions: [...],  // Flat array of all compressions
  summary: {...}
}

// Automatically migrates to →

// New format
{
  version: "2.0",
  recent: [...],        // Recent compressions
  daily: {...},         // Aggregated older data
  monthly: {...},       // Aggregated very old data
  summary: {...}
}
```

### 2. Auto-Aggregation on Save

Every time stats are saved, old data is automatically aggregated:

1. **Recent → Daily**: Compressions older than 30 days move from `recent` to `daily` aggregates
2. **Daily → Monthly**: Daily aggregates older than 365 days move to `monthly` aggregates
3. **Pruning**: Monthly aggregates older than 5 years are deleted

### 3. Smart Stats Retrieval

The `get_compression_stats` tool intelligently queries across all tiers:

- **Today**: Only recent compressions
- **Week**: Only recent compressions
- **Month**: Recent compressions + relevant daily aggregates
- **All Time**: Uses pre-computed summary totals

### 4. Storage Breakdown

The stats response now includes a storage breakdown showing how data is distributed:

```
Storage Breakdown:
- Recent records (30 days): 145
- Daily aggregates (365 days): 72
- Monthly aggregates (5 years): 18
```

## Implementation Details

### Key Functions

#### `aggregateStats(stats)`

- Called automatically before every save
- Moves old data between tiers
- Enforces retention policy
- Returns aggregated stats object

#### `migrateStatsFormat(oldStats)`

- Converts old flat array format to new multi-tier format
- Called automatically when old format detected
- Preserves all historical data during migration

#### `handleGetStats(args)`

- Updated to query across all tiers based on time period
- Intelligently combines recent records with aggregates
- Shows storage breakdown

### File Size Benefits

Example with heavy usage (70 compressions/day):

| Timeframe | Old Format | New Format | Savings |
| --------- | ---------- | ---------- | ------- |
| 30 days   | ~420 KB    | ~420 KB    | 0%      |
| 90 days   | ~1.2 MB    | ~450 KB    | 62%     |
| 1 year    | ~4.8 MB    | ~520 KB    | 89%     |
| 2 years   | ~9.6 MB    | ~560 KB    | 94%     |
| 5 years   | ~24 MB     | ~600 KB    | 97%     |

## Configuration

Retention policy is configurable via `RETENTION_POLICY` constants in `server.js`:

```javascript
const RETENTION_POLICY = {
  RECENT_DAYS: 30, // Keep detailed records for last 30 days
  DAILY_DAYS: 365, // Keep daily aggregates for 365 days
  MONTHLY_YEARS: 5, // Keep monthly aggregates for 5 years
};
```

### Alternative Policies

**Conservative (7/90/forever)**:

- Recent: 7 days
- Daily: 90 days
- Monthly: Forever
- Max records: ~600

**Moderate (14/180/2y)**:

- Recent: 14 days
- Daily: 180 days
- Monthly: 2 years
- Max records: ~1,000

## Testing

Run the test suite to verify retention behavior:

```bash
node mcp-server/test-stats-retention.js
```

Tests cover:

1. Migration from old format
2. Auto-aggregation on save
3. Retention policy enforcement
4. File size growth bounds

## Backward Compatibility

- Old stats files are automatically migrated on first load
- No data is lost during migration
- All existing functionality continues to work
- Stats files with old format are seamlessly upgraded

## Migration Path

When you first run the updated MCP server:

1. Old `compression-stats.json` is detected
2. Automatic migration runs
3. Data is distributed across tiers based on age
4. File is saved in new format
5. Console logs confirm migration success

Example migration output:

```
[INFO] Migrating stats to new multi-tier format...
[INFO] Migration complete: 145 recent, 72 daily, 18 monthly
```

## Benefits Summary

✅ **Historical data preserved** - Nothing is lost
✅ **Bounded file size** - Maximum ~2,500 records regardless of usage
✅ **Automatic management** - No manual intervention needed
✅ **Backward compatible** - Seamless migration from old format
✅ **Configurable** - Adjust retention policy to your needs
✅ **Transparent** - Storage breakdown shows data distribution
