# Test Date Helpers - Usage Guide

## Purpose

This module provides dynamic date generation utilities to **eliminate hardcoded year values** from test files. Tests using these helpers will remain valid regardless of execution year.

## Problem Solved

**Before** (hardcoded dates that become stale):
```javascript
const result = parseFlexibleDate('2025-01-01');
assert.strictEqual(result.getFullYear(), 2025); // Fails in 2026!
```

**After** (dynamic dates that never expire):
```javascript
const { startOfCurrentYear } = require('./test-date-helpers');
const testDate = startOfCurrentYear();
const result = parseFlexibleDate(testDate.toISOString().split('T')[0]);
assert.strictEqual(result.getFullYear(), testDate.getFullYear()); // ✅ Always works
```

## API Reference

### Basic Helpers

#### `now()`
Returns the current date and time.

```javascript
const currentTime = now();
// Example: 2025-11-06T19:45:30.123Z
```

#### `today()`
Returns today at midnight (00:00:00.000 local time).

```javascript
const midnight = today();
// Example: 2025-11-06T00:00:00.000
```

### Relative Date Helpers

#### `daysAgo(days)` / `daysFromNow(days)`
Get a date N days in the past or future.

```javascript
const lastWeek = daysAgo(7);
const nextWeek = daysFromNow(7);
```

#### `weeksAgo(weeks)` / `weeksFromNow(weeks)`
Get a date N weeks in the past or future.

```javascript
const twoWeeksAgo = weeksAgo(2);
const threeWeeksFromNow = weeksFromNow(3);
```

#### `monthsAgo(months)` / `monthsFromNow(months)`
Get a date approximately N months in the past or future (uses 30-day months).

```javascript
const lastMonth = monthsAgo(1);
const nextQuarter = monthsFromNow(3);
```

#### `yearsAgo(years)` / `yearsFromNow(years)`
Get a date approximately N years in the past or future (uses 365-day years).

```javascript
const lastYear = yearsAgo(1);
const in5Years = yearsFromNow(5);
```

### Special Date Helpers

#### `startOfCurrentYear()`
Returns January 1st of the current year at 00:00:00.000 UTC.

```javascript
const jan1 = startOfCurrentYear();
// 2025-01-01T00:00:00.000Z
```

**Use case**: Testing ISO date parsing with year boundaries.

#### `endOfCurrentYear()`
Returns December 31st of the current year at 23:59:59.999.

```javascript
const dec31 = endOfCurrentYear();
// 2025-12-31T23:59:59.999
```

#### `startOfCurrentMonth()`
Returns the 1st day of the current month at 00:00:00.000 local time.

```javascript
const firstDayOfMonth = startOfCurrentMonth();
```

### Advanced Helpers

#### `dateWithOffset(options)`
Create a specific date relative to now using year/month/day offsets.

**Options:**
- `years` (number): Years to add (negative for past)
- `months` (number): Months to add (negative for past)
- `days` (number): Days to add (negative for past)
- `startOfDay` (boolean): Set time to 00:00:00.000 if true

```javascript
// Same day last year
const lastYearToday = dateWithOffset({ years: -1 });

// First day of next month
const nextMonth = dateWithOffset({ months: 1, days: 1, startOfDay: true });

// 15 days from now at current time
const in15Days = dateWithOffset({ days: 15 });
```

### Formatting Helpers

#### `toISODate(date)`
Format a Date as ISO date string (YYYY-MM-DD).

```javascript
const dateStr = toISODate(now());
// "2025-11-06"
```

#### `toISOMonth(date)`
Format a Date as ISO month string (YYYY-MM).

```javascript
const monthStr = toISOMonth(now());
// "2025-11"
```

## Usage Patterns

### Pattern 1: Testing Date Parsing

```javascript
const { startOfCurrentYear } = require('./test-date-helpers');

// Generate dynamic test date
const testDate = startOfCurrentYear();
const testDateStr = testDate.toISOString().split('T')[0];

// Parse and validate
const result = parseFlexibleDate(testDateStr);
assert.strictEqual(result.getUTCFullYear(), testDate.getFullYear());
```

### Pattern 2: Creating Test Data with Timestamps

```javascript
const { daysAgo, toISODate } = require('./test-date-helpers');

const testStats = {
  recent: [
    {
      timestamp: daysAgo(1).toISOString(),
      path: 'test1.js',
      tokensSaved: 750
    },
    {
      timestamp: daysAgo(7).toISOString(),
      path: 'test2.js',
      tokensSaved: 1500
    }
  ]
};
```

### Pattern 3: Date Range Testing

```javascript
const { daysAgo } = require('./test-date-helpers');

// Test filtering records from last 7 days
const startDate = daysAgo(7);
const endDate = now();
const filtered = filterByDateRange(records, startDate, endDate);
```

### Pattern 4: Using Getter Properties for Dynamic Values

For test objects that are defined once but executed later:

```javascript
const tests = [
  {
    name: 'Test ISO date parsing',
    get input() {
      // Evaluated when accessed, not when defined
      return startOfCurrentYear().toISOString().split('T')[0];
    },
    validate: (result) => {
      const expected = startOfCurrentYear();
      return result.getUTCFullYear() === expected.getFullYear();
    }
  }
];
```

## Migration Guide

### Step 1: Import Helpers

```javascript
const { daysAgo, startOfCurrentYear, dateWithOffset } = require('./test-date-helpers');
```

### Step 2: Replace Hardcoded Dates

**Before:**
```javascript
const stats = {
  timestamp: '2025-01-01T00:00:00.000Z',
  // ...
};
```

**After:**
```javascript
const stats = {
  timestamp: startOfCurrentYear().toISOString(),
  // ...
};
```

### Step 3: Update Assertions

**Before:**
```javascript
assert.strictEqual(result.getFullYear(), 2025);
```

**After:**
```javascript
const currentYear = new Date().getFullYear();
assert.strictEqual(result.getFullYear(), currentYear);
```

## Best Practices

1. **Use UTC for year boundaries**: When testing January 1st or December 31st, use `getUTCFullYear()`, `getUTCMonth()`, etc. to avoid timezone issues.

2. **Use getter properties for dynamic test data**: When defining test arrays that execute later, use `get property()` syntax to ensure dates are generated at test execution time.

3. **Document date generation logic**: Add comments explaining why specific offsets are used.

   ```javascript
   // Generate record from 7 days ago for weekly stats test
   const weeklyRecord = { timestamp: daysAgo(7).toISOString() };
   ```

4. **Avoid timezone-dependent comparisons**: Prefer UTC methods when comparing dates from ISO strings.

   ```javascript
   // ✅ Good - uses UTC
   assert.strictEqual(parsed.getUTCFullYear(), expected.getFullYear());

   // ❌ Bad - timezone-dependent
   assert.strictEqual(parsed.getFullYear(), 2025);
   ```

## Timezone Considerations

- `startOfCurrentYear()` returns UTC midnight to avoid timezone boundary issues
- `today()` returns local midnight
- All relative helpers (`daysAgo`, etc.) preserve the current time component
- When parsing ISO date strings (e.g., "2025-01-01"), JavaScript treats them as UTC midnight

## Testing the Helpers

All helper functions are tested through the test files that use them. To verify:

```bash
node test-date-parsing.js
node test-integration.js
```

Expected: All tests pass regardless of execution year.

## Maintenance

- **No annual updates needed**: All dates are generated dynamically
- **No hardcoded year values**: Grep for `202[0-9]` should only find protocol versions
- **Self-documenting**: Function names clearly indicate their purpose

## Related Files

- `/mcp-server/test-date-helpers.js` - Implementation
- `/mcp-server/test-integration.js` - Usage example
- `/mcp-server/test-date-parsing.js` - Usage example
- `/mcp-server/test-stats-query.js` - Documentation updated to use YYYY placeholders
