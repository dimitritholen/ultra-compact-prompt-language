# Manual Test Guide: Task 003 - Custom Date Range Queries

## Overview

This guide provides step-by-step manual testing procedures for the new flexible date range functionality in `get_compression_stats`.

## Prerequisites

1. MCP Server running with test data
2. MCP Inspector installed: `npm install -g @modelcontextprotocol/inspector`
3. Test compression statistics available in `~/.ucpl/compress/compression-stats.json`

## Starting the Test Environment

```bash
cd /home/dimitri/dev/ultra-compact-prompt-language/mcp-server

# Start MCP Inspector with server
npx @modelcontextprotocol/inspector node server.js
```

## Test Scenarios

### Category A: relativeDays Parameter

**Purpose**: Test simple "last N days" queries

#### A1: Last 3 Days

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "relativeDays": 3
  }
}
```

**Expected**:

- Period label: "Last 3 Days"
- Only compressions from last 3 days included
- Summary shows correct token counts

#### A2: Last 7 Days

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "relativeDays": 7
  }
}
```

**Expected**:

- Period label: "Last 7 Days"
- Compressions from last week included

#### A3: Last 30 Days

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "relativeDays": 30
  }
}
```

**Expected**:

- Period label: "Last 30 Days"
- All recent compressions + some daily aggregates included

### Category B: Custom Date Ranges (ISO Format)

**Purpose**: Test specific date range queries

#### B1: January 2025

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-31"
  }
}
```

**Expected**:

- Period label: "2025-01-01 to 2025-01-31"
- Only compressions from January included

#### B2: Specific Week

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "startDate": "2025-01-15",
    "endDate": "2025-01-22"
  }
}
```

**Expected**:

- Period label shows exact date range
- Only compressions within that week

#### B3: Open-Ended Start Date

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "startDate": "2025-01-01"
  }
}
```

**Expected**:

- Period label: "2025-01-01 to [current date]"
- All compressions from Jan 1st to now

#### B4: Open-Ended End Date

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "endDate": "2025-01-31"
  }
}
```

**Expected**:

- Period label: "1970-01-01 to 2025-01-31" (epoch to end date)
- All compressions up to Jan 31

### Category C: Relative Time Strings

**Purpose**: Test human-friendly relative time syntax

#### C1: Last Week (Relative)

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "startDate": "-7d",
    "endDate": "now"
  }
}
```

**Expected**:

- Same result as relativeDays=7
- Period label shows calculated date range

#### C2: Two Weeks Ago to One Week Ago

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "startDate": "-2w",
    "endDate": "-1w"
  }
}
```

**Expected**:

- Period label shows 14 days ago to 7 days ago
- Only compressions in that window

#### C3: Last Month (Relative)

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "startDate": "-1m",
    "endDate": "now"
  }
}
```

**Expected**:

- ~30 days of data
- Period label shows calculated dates

#### C4: Last Year (Relative)

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "startDate": "-1y",
    "endDate": "now"
  }
}
```

**Expected**:

- ~365 days of data
- Includes recent, daily, and monthly aggregates

#### C5: "today" Keyword

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "startDate": "today",
    "endDate": "now"
  }
}
```

**Expected**:

- Only compressions from midnight to now
- Similar to period="today"

### Category D: Backward Compatibility (Legacy Period)

**Purpose**: Ensure existing queries still work

#### D1: period=today

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "period": "today"
  }
}
```

**Expected**:

- Period label: "Last 24 Hours"
- Same behavior as before

#### D2: period=week

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "period": "week"
  }
}
```

**Expected**:

- Period label: "Last 7 Days"
- Same behavior as before

#### D3: period=month

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "period": "month"
  }
}
```

**Expected**:

- Period label: "Last 30 Days"
- Same behavior as before

#### D4: period=all

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "period": "all"
  }
}
```

**Expected**:

- Period label: "All Time"
- Uses summary data
- All tiers included

### Category E: Parameter Priority Order

**Purpose**: Verify correct parameter precedence

#### E1: relativeDays Takes Precedence Over period

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "relativeDays": 7,
    "period": "all"
  }
}
```

**Expected**:

- Uses relativeDays (7 days), ignores period
- Period label: "Last 7 Days"

#### E2: startDate/endDate Takes Precedence Over period

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "startDate": "-14d",
    "endDate": "now",
    "period": "all"
  }
}
```

**Expected**:

- Uses startDate/endDate, ignores period
- Period label shows calculated range

#### E3: relativeDays Takes Precedence Over startDate/endDate

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "relativeDays": 3,
    "startDate": "-14d",
    "endDate": "now"
  }
}
```

**Expected**:

- Uses relativeDays (3 days)
- Ignores startDate/endDate

### Category F: Error Handling

**Purpose**: Test validation and error messages

#### F1: relativeDays Out of Range (Too High)

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "relativeDays": 400
  }
}
```

**Expected**:

- Error response with isError=true
- Message: "relativeDays must be a number between 1 and 365"

#### F2: relativeDays Out of Range (Zero)

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "relativeDays": 0
  }
}
```

**Expected**:

- Error response
- Message: "relativeDays must be a number between 1 and 365"

#### F3: Invalid Date Format

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "startDate": "not-a-date"
  }
}
```

**Expected**:

- Error response
- Message: "Invalid date format: not-a-date. Expected ISO date..."

#### F4: startDate After endDate

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "startDate": "2025-02-01",
    "endDate": "2025-01-01"
  }
}
```

**Expected**:

- Error response
- Message: "Invalid date range: startDate...is after endDate..."

#### F5: Invalid Relative Time Format

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "startDate": "-7x"
  }
}
```

**Expected**:

- Error response
- Message: "Invalid date format..."

### Category G: Multi-Tier Filtering

**Purpose**: Verify filtering across all storage tiers

#### G1: Query Spanning Recent + Daily Tiers

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "relativeDays": 60
  }
}
```

**Expected**:

- Includes recent compressions (last 30 days)
- Includes daily aggregates (31-60 days ago)
- Token counts sum correctly

#### G2: Query Spanning All Tiers

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "relativeDays": 365
  }
}
```

**Expected**:

- Includes all recent compressions
- Includes all daily aggregates
- Includes some monthly aggregates
- Summary shows combined totals

#### G3: Query Only in Monthly Tier

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "startDate": "-2y",
    "endDate": "-1y"
  }
}
```

**Expected**:

- Only monthly aggregates included
- Recent and daily tiers empty
- Token counts from monthly tier only

### Category H: includeDetails Parameter

**Purpose**: Test detail output with date filtering

#### H1: relativeDays with Details

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "relativeDays": 7,
    "includeDetails": true,
    "limit": 5
  }
}
```

**Expected**:

- Summary shows filtered totals
- Individual compressions listed (max 5)
- All compressions within last 7 days

#### H2: Custom Range with Details

```json
{
  "name": "get_compression_stats",
  "arguments": {
    "startDate": "2025-01-01",
    "endDate": "2025-01-31",
    "includeDetails": true
  }
}
```

**Expected**:

- Summary for January
- Individual compressions from January
- Default limit of 10 applied

## Verification Checklist

For each test scenario, verify:

- [ ] No errors returned (unless expected)
- [ ] Period label is accurate
- [ ] Token counts are reasonable
- [ ] Cost savings calculated
- [ ] includeDetails shows correct records
- [ ] Response format matches outputSchema
- [ ] Multi-tier aggregation works correctly
- [ ] Backward compatibility maintained

## Success Criteria

All acceptance criteria from task specification must pass:

- [x] relativeDays parameter works: {relativeDays: 3} → last 3 days
- [x] startDate/endDate work: {startDate: '2025-01-01', endDate: '2025-01-31'}
- [x] Relative dates work: {startDate: '-7d', endDate: 'now'}
- [x] Legacy period parameter still works unchanged
- [x] Filters across all stats tiers correctly
- [x] Integration tests pass (10+ scenarios documented)

## Notes

- Some tests require actual compression data in stats file
- Create test data if needed using compress_code_context tool
- MCP Inspector provides visual feedback for tool schemas
- Check both text output and structuredContent in responses
- Verify cost savings calculation uses correct model pricing
