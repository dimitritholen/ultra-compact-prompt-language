/**
 * Test script for multi-tier statistics retention
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

// Mock the constants in server.js
const RETENTION_POLICY = {
  RECENT_DAYS: 30,
  DAILY_DAYS: 365,
  MONTHLY_YEARS: 5
};

// Copy functions from server.js for testing
function aggregateStats(stats) {
  const now = new Date();
  const recentCutoff = new Date(now.getTime() - RETENTION_POLICY.RECENT_DAYS * 24 * 60 * 60 * 1000);
  const dailyCutoff = new Date(now.getTime() - RETENTION_POLICY.DAILY_DAYS * 24 * 60 * 60 * 1000);
  const monthlyCutoff = new Date(now.getTime() - RETENTION_POLICY.MONTHLY_YEARS * 365 * 24 * 60 * 60 * 1000);

  const newRecent = [];
  const newDaily = { ...stats.daily };
  const newMonthly = { ...stats.monthly };

  // Process recent compressions
  for (const compression of stats.recent || []) {
    const timestamp = new Date(compression.timestamp);

    if (timestamp >= recentCutoff) {
      newRecent.push(compression);
    } else if (timestamp >= dailyCutoff) {
      const dayKey = timestamp.toISOString().split('T')[0];
      if (!newDaily[dayKey]) {
        newDaily[dayKey] = {
          date: dayKey,
          count: 0,
          originalTokens: 0,
          compressedTokens: 0,
          tokensSaved: 0
        };
      }
      newDaily[dayKey].count++;
      newDaily[dayKey].originalTokens += compression.originalTokens;
      newDaily[dayKey].compressedTokens += compression.compressedTokens;
      newDaily[dayKey].tokensSaved += compression.tokensSaved;
    } else {
      const monthKey = timestamp.toISOString().substring(0, 7);
      if (!newMonthly[monthKey]) {
        newMonthly[monthKey] = {
          month: monthKey,
          count: 0,
          originalTokens: 0,
          compressedTokens: 0,
          tokensSaved: 0
        };
      }
      newMonthly[monthKey].count++;
      newMonthly[monthKey].originalTokens += compression.originalTokens;
      newMonthly[monthKey].compressedTokens += compression.compressedTokens;
      newMonthly[monthKey].tokensSaved += compression.tokensSaved;
    }
  }

  // Move old daily aggregates to monthly
  const oldDailyKeys = [];
  for (const [dayKey, dayStats] of Object.entries(newDaily)) {
    const dayDate = new Date(dayKey);
    if (dayDate < dailyCutoff) {
      oldDailyKeys.push(dayKey);
      const monthKey = dayKey.substring(0, 7);
      if (!newMonthly[monthKey]) {
        newMonthly[monthKey] = {
          month: monthKey,
          count: 0,
          originalTokens: 0,
          compressedTokens: 0,
          tokensSaved: 0
        };
      }
      newMonthly[monthKey].count += dayStats.count;
      newMonthly[monthKey].originalTokens += dayStats.originalTokens;
      newMonthly[monthKey].compressedTokens += dayStats.compressedTokens;
      newMonthly[monthKey].tokensSaved += dayStats.tokensSaved;
    }
  }

  for (const key of oldDailyKeys) {
    delete newDaily[key];
  }

  // Prune monthly aggregates older than retention policy
  const oldMonthlyKeys = [];
  for (const [monthKey] of Object.entries(newMonthly)) {
    const monthDate = new Date(monthKey + '-01');
    if (monthDate < monthlyCutoff) {
      oldMonthlyKeys.push(monthKey);
    }
  }

  for (const key of oldMonthlyKeys) {
    delete newMonthly[key];
  }

  return {
    ...stats,
    recent: newRecent,
    daily: newDaily,
    monthly: newMonthly
  };
}

function migrateStatsFormat(oldStats) {
  const now = new Date();
  const recentCutoff = new Date(now.getTime() - RETENTION_POLICY.RECENT_DAYS * 24 * 60 * 60 * 1000);
  const dailyCutoff = new Date(now.getTime() - RETENTION_POLICY.DAILY_DAYS * 24 * 60 * 60 * 1000);

  const newStats = {
    version: '2.0',
    recent: [],
    daily: {},
    monthly: {},
    summary: oldStats.summary || {
      totalCompressions: 0,
      totalOriginalTokens: 0,
      totalCompressedTokens: 0,
      totalTokensSaved: 0
    }
  };

  for (const compression of oldStats.compressions || []) {
    const timestamp = new Date(compression.timestamp);

    if (timestamp >= recentCutoff) {
      newStats.recent.push(compression);
    } else if (timestamp >= dailyCutoff) {
      const dayKey = timestamp.toISOString().split('T')[0];
      if (!newStats.daily[dayKey]) {
        newStats.daily[dayKey] = {
          date: dayKey,
          count: 0,
          originalTokens: 0,
          compressedTokens: 0,
          tokensSaved: 0
        };
      }
      newStats.daily[dayKey].count++;
      newStats.daily[dayKey].originalTokens += compression.originalTokens;
      newStats.daily[dayKey].compressedTokens += compression.compressedTokens;
      newStats.daily[dayKey].tokensSaved += compression.tokensSaved;
    } else {
      const monthKey = timestamp.toISOString().substring(0, 7);
      if (!newStats.monthly[monthKey]) {
        newStats.monthly[monthKey] = {
          month: monthKey,
          count: 0,
          originalTokens: 0,
          compressedTokens: 0,
          tokensSaved: 0
        };
      }
      newStats.monthly[monthKey].count++;
      newStats.monthly[monthKey].originalTokens += compression.originalTokens;
      newStats.monthly[monthKey].compressedTokens += compression.compressedTokens;
      newStats.monthly[monthKey].tokensSaved += compression.tokensSaved;
    }
  }

  return newStats;
}

// Test utilities
function createMockCompression(daysAgo, filePath = 'test.js') {
  const timestamp = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    timestamp: timestamp.toISOString(),
    path: filePath,
    originalTokens: 10000,
    compressedTokens: 2500,
    tokensSaved: 7500,
    compressionRatio: 0.25,
    savingsPercentage: 75.0,
    level: 'full',
    format: 'text'
  };
}

describe('Multi-tier Statistics Retention', () => {
  describe('Migration from old format to new format', () => {
    test('should migrate compressions to correct tiers', (t) => {
      const oldStats = {
        compressions: [
          createMockCompression(1, 'recent1.js'),    // Recent (1 day ago)
          createMockCompression(15, 'recent2.js'),   // Recent (15 days ago)
          createMockCompression(50, 'old1.js'),      // Daily (50 days ago)
          createMockCompression(200, 'old2.js'),     // Daily (200 days ago)
          createMockCompression(400, 'veryold1.js')  // Monthly (400 days ago)
        ],
        summary: {
          totalCompressions: 5,
          totalOriginalTokens: 50000,
          totalCompressedTokens: 12500,
          totalTokensSaved: 37500
        }
      };

      const newStats = migrateStatsFormat(oldStats);

      t.diagnostic(`Recent records: ${newStats.recent.length} (expected: 2)`);
      t.diagnostic(`Daily aggregates: ${Object.keys(newStats.daily).length} (expected: 2)`);
      t.diagnostic(`Monthly aggregates: ${Object.keys(newStats.monthly).length} (expected: 1)`);

      assert.strictEqual(newStats.recent.length, 2, 'Should have 2 recent records');
      assert.strictEqual(Object.keys(newStats.daily).length, 2, 'Should have 2 daily aggregates');
      assert.strictEqual(Object.keys(newStats.monthly).length, 1, 'Should have 1 monthly aggregate');
      assert.strictEqual(newStats.summary.totalCompressions, 5, 'Summary should be preserved');
    });
  });

  describe('Auto-aggregation on save', () => {
    test('should move old records to appropriate tiers', (t) => {
      const stats = {
        version: '2.0',
        recent: [
          createMockCompression(1, 'recent1.js'),    // Keep in recent
          createMockCompression(15, 'recent2.js'),   // Keep in recent
          createMockCompression(45, 'old1.js'),      // Move to daily
          createMockCompression(400, 'veryold1.js')  // Move to monthly
        ],
        daily: {},
        monthly: {},
        summary: {
          totalCompressions: 4,
          totalOriginalTokens: 40000,
          totalCompressedTokens: 10000,
          totalTokensSaved: 30000
        }
      };

      const aggregated = aggregateStats(stats);

      t.diagnostic(`Recent after aggregation: ${aggregated.recent.length} (expected: 2)`);
      t.diagnostic(`Daily after aggregation: ${Object.keys(aggregated.daily).length} (expected: 1)`);
      t.diagnostic(`Monthly after aggregation: ${Object.keys(aggregated.monthly).length} (expected: 1)`);

      assert.strictEqual(aggregated.recent.length, 2, 'Should keep 2 recent records');
      assert.strictEqual(Object.keys(aggregated.daily).length, 1, 'Should have 1 daily aggregate');
      assert.strictEqual(Object.keys(aggregated.monthly).length, 1, 'Should have 1 monthly aggregate');
    });
  });

  describe('Retention policy enforcement', () => {
    test('should prune old data according to policy', (t) => {
      const stats = {
        version: '2.0',
        recent: [
          createMockCompression(1, 'recent1.js'),
          createMockCompression(500, 'veryold1.js')  // Should be moved to monthly
        ],
        daily: {
          '2021-06-01': {  // ~4.4 years old - should be moved to monthly (within 5y retention)
            date: '2021-06-01',
            count: 10,
            originalTokens: 100000,
            compressedTokens: 25000,
            tokensSaved: 75000
          }
        },
        monthly: {
          '2018-01': {  // ~7 years old - older than 5 years - should be pruned
            month: '2018-01',
            count: 50,
            originalTokens: 500000,
            compressedTokens: 125000,
            tokensSaved: 375000
          }
        },
        summary: {
          totalCompressions: 62,
          totalOriginalTokens: 620000,
          totalCompressedTokens: 155000,
          totalTokensSaved: 465000
        }
      };

      const aggregated = aggregateStats(stats);

      t.diagnostic('Aggregated structure:');
      t.diagnostic(`- Recent count: ${aggregated.recent.length}`);
      t.diagnostic(`- Daily keys: ${Object.keys(aggregated.daily).join(', ')}`);
      t.diagnostic(`- Monthly keys: ${Object.keys(aggregated.monthly).join(', ')}`);

      // Check that 2018-01 is pruned (older than 5 years)
      const has2018 = '2018-01' in aggregated.monthly;
      assert.strictEqual(has2018, false, '2018-01 should be pruned (older than 5 years)');

      // Check that 2021-06 is in monthly (moved from daily, within 5y retention)
      const has2021 = '2021-06' in aggregated.monthly;
      assert.strictEqual(has2021, true, '2021-06 should be in monthly (within 5y retention)');
    });
  });

  describe('File size growth bounds', () => {
    test('should maintain bounded size with retention policy', (t) => {
      // Simulate 1000 compressions per day for 30 days
      const recentCompressions = [];
      for (let day = 0; day < 30; day++) {
        for (let i = 0; i < 1000; i++) {
          recentCompressions.push(createMockCompression(day, `file-${day}-${i}.js`));
        }
      }

      const stats = {
        version: '2.0',
        recent: recentCompressions,
        daily: {},
        monthly: {},
        summary: {
          totalCompressions: 30000,
          totalOriginalTokens: 300000000,
          totalCompressedTokens: 75000000,
          totalTokensSaved: 225000000
        }
      };

      // Calculate uncompressed size
      const uncompressedSize = JSON.stringify(stats).length;
      t.diagnostic(`Uncompressed stats size: ${Math.round(uncompressedSize / 1024)} KB`);
      t.diagnostic(`Recent records: ${stats.recent.length}`);

      // After aggregation, old records should be pruned
      const aggregated = aggregateStats(stats);
      const aggregatedSize = JSON.stringify(aggregated).length;
      t.diagnostic(`After aggregation: ${Math.round(aggregatedSize / 1024)} KB`);
      t.diagnostic(`Recent records after aggregation: ${aggregated.recent.length}`);
      t.diagnostic(`Daily aggregates: ${Object.keys(aggregated.daily).length}`);

      // With retention policy, size should be bounded
      // Max: ~30k recent records + 365 daily + 60 monthly = ~30.5k records
      const maxExpectedRecords = 30500;
      const totalRecords = aggregated.recent.length +
                          Object.keys(aggregated.daily).length +
                          Object.keys(aggregated.monthly).length;

      t.diagnostic(`Total records after aggregation: ${totalRecords} (max: ${maxExpectedRecords})`);

      assert.ok(totalRecords <= maxExpectedRecords, 'Total records should be within bounds');
    });
  });
});
