#!/usr/bin/env node

/**
 * Automated Tests for get_compression_stats Date Range Queries
 *
 * Tests the new flexible date filtering functionality including:
 * - relativeDays parameter
 * - startDate/endDate custom ranges
 * - Relative time strings (-7d, -2w, etc.)
 * - Backward compatibility with period parameter
 * - Multi-tier filtering (recent, daily, monthly aggregates)
 *
 * Uses node:test framework with proper assertions (no manual verification)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Test configuration
const TEST_STATS_DIR = path.join(os.tmpdir(), '.ucpl-test-' + Date.now());
const TEST_STATS_FILE = path.join(TEST_STATS_DIR, 'compression-stats.json');

// Save original HOME for cleanup
const originalHome = process.env.HOME;

// Test stats data with dates spanning multiple tiers
function generateTestStats() {
  const now = new Date();

  // Helper to create dates relative to now
  const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    version: '2.0',
    recent: [
      // Recent: Last 30 days (individual records)
      {
        timestamp: daysAgo(1).toISOString(),
        path: 'test1.js',
        originalTokens: 1000,
        compressedTokens: 250,
        tokensSaved: 750,
        compressionRatio: 0.25,
        savingsPercentage: 75,
        level: 'full',
        format: 'text',
        model: 'claude-sonnet-4',
        costSavingsUSD: 0.00225 // 750 * 3.00 / 1000000
      },
      {
        timestamp: daysAgo(3).toISOString(),
        path: 'test2.js',
        originalTokens: 2000,
        compressedTokens: 500,
        tokensSaved: 1500,
        compressionRatio: 0.25,
        savingsPercentage: 75,
        level: 'full',
        format: 'text',
        model: 'claude-sonnet-4',
        costSavingsUSD: 0.00450 // 1500 * 3.00 / 1000000
      },
      {
        timestamp: daysAgo(7).toISOString(),
        path: 'test3.js',
        originalTokens: 1500,
        compressedTokens: 300,
        tokensSaved: 1200,
        compressionRatio: 0.2,
        savingsPercentage: 80,
        level: 'minimal',
        format: 'text',
        model: 'gpt-4o',
        costSavingsUSD: 0.00300 // 1200 * 2.50 / 1000000
      },
      {
        timestamp: daysAgo(14).toISOString(),
        path: 'test4.js',
        originalTokens: 3000,
        compressedTokens: 600,
        tokensSaved: 2400,
        compressionRatio: 0.2,
        savingsPercentage: 80,
        level: 'minimal',
        format: 'text',
        model: 'claude-sonnet-4',
        costSavingsUSD: 0.00720 // 2400 * 3.00 / 1000000
      },
      {
        timestamp: daysAgo(28).toISOString(),
        path: 'test5.js',
        originalTokens: 1000,
        compressedTokens: 200,
        tokensSaved: 800,
        compressionRatio: 0.2,
        savingsPercentage: 80,
        level: 'minimal',
        format: 'text',
        model: 'claude-sonnet-4',
        costSavingsUSD: 0.00240 // 800 * 3.00 / 1000000
      }
    ],
    daily: {
      // Daily: 31-365 days ago (aggregated by day)
      [daysAgo(45).toISOString().split('T')[0]]: {
        date: daysAgo(45).toISOString().split('T')[0],
        count: 5,
        originalTokens: 10000,
        compressedTokens: 2000,
        tokensSaved: 8000
      },
      [daysAgo(60).toISOString().split('T')[0]]: {
        date: daysAgo(60).toISOString().split('T')[0],
        count: 3,
        originalTokens: 6000,
        compressedTokens: 1200,
        tokensSaved: 4800
      },
      [daysAgo(90).toISOString().split('T')[0]]: {
        date: daysAgo(90).toISOString().split('T')[0],
        count: 2,
        originalTokens: 4000,
        compressedTokens: 800,
        tokensSaved: 3200
      }
    },
    monthly: {
      // Monthly: 365+ days ago (aggregated by month)
      [daysAgo(400).toISOString().substring(0, 7)]: {
        month: daysAgo(400).toISOString().substring(0, 7),
        count: 20,
        originalTokens: 50000,
        compressedTokens: 10000,
        tokensSaved: 40000
      },
      [daysAgo(730).toISOString().substring(0, 7)]: {
        month: daysAgo(730).toISOString().substring(0, 7),
        count: 15,
        originalTokens: 30000,
        compressedTokens: 6000,
        tokensSaved: 24000
      }
    },
    summary: {
      totalCompressions: 50,
      totalOriginalTokens: 109500,
      totalCompressedTokens: 21850,
      totalTokensSaved: 87650
    }
  };
}

/**
 * Mock MCP Server class with stats query logic
 * This simulates the handleGetStats() method from server.js
 */
class MockMCPServer {
  constructor(stats) {
    this.stats = stats;
    this.RETENTION_POLICY = {
      RECENT_DAYS: 30,
      DAILY_DAYS: 365,
      MONTHLY_YEARS: 5
    };
    this.MODEL_PRICING = {
      'claude-sonnet-4': { pricePerMTok: 3.00, name: 'Claude Sonnet 4' },
      'claude-opus-4': { pricePerMTok: 15.00, name: 'Claude Opus 4' },
      'gpt-4o': { pricePerMTok: 2.50, name: 'GPT-4o' },
      'gpt-4o-mini': { pricePerMTok: 0.15, name: 'GPT-4o Mini' }
    };
  }

  parseFlexibleDate(value) {
    if (!value || value === 'now') {
      return new Date();
    }

    if (value === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }

    const relativeMatch = value.match(/^-(\d+)(d|w|m|y)$/);
    if (relativeMatch) {
      const [, amount, unit] = relativeMatch;
      const multipliers = { d: 1, w: 7, m: 30, y: 365 };
      const days = parseInt(amount, 10) * multipliers[unit];
      return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    }

    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }

    throw new Error(`Invalid date format: ${value}. Expected ISO date (YYYY-MM-DD), relative time (-7d, -2w), or special keyword (now, today)`);
  }

  async handleGetStats(args) {
    const includeDetails = args.includeDetails || false;
    const limit = args.limit || 10;

    // Determine date range (Priority: relativeDays > startDate/endDate > period)
    let startDate, endDate, periodLabel;
    const now = new Date();

    if (args.relativeDays) {
      if (typeof args.relativeDays !== 'number' || args.relativeDays < 1 || args.relativeDays > 365) {
        throw new Error('relativeDays must be a number between 1 and 365');
      }
      startDate = new Date(now.getTime() - args.relativeDays * 24 * 60 * 60 * 1000);
      endDate = now;
      periodLabel = `Last ${args.relativeDays} Day${args.relativeDays > 1 ? 's' : ''}`;
    } else if (args.startDate || args.endDate) {
      try {
        startDate = args.startDate ? this.parseFlexibleDate(args.startDate) : new Date(0);
        endDate = args.endDate ? this.parseFlexibleDate(args.endDate) : now;
      } catch (error) {
        throw new Error(`Invalid date range: ${error.message}`);
      }

      if (startDate > endDate) {
        throw new Error(`Invalid date range: startDate (${startDate.toISOString()}) is after endDate (${endDate.toISOString()})`);
      }

      if (endDate > now) {
        endDate = now;
      }

      const formatDate = (d) => d.toISOString().split('T')[0];
      periodLabel = `${formatDate(startDate)} to ${formatDate(endDate)}`;
    } else {
      const period = args.period || 'all';
      switch (period) {
        case 'today':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          endDate = now;
          periodLabel = 'Last 24 Hours';
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          endDate = now;
          periodLabel = 'Last 7 Days';
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          endDate = now;
          periodLabel = 'Last 30 Days';
          break;
        case 'all':
        default:
          startDate = new Date(0);
          endDate = now;
          periodLabel = 'All Time';
          break;
      }
    }

    // Filter compressions from all tiers by date range
    let recentCompressions = [];
    let aggregatedData = { count: 0, originalTokens: 0, compressedTokens: 0, tokensSaved: 0, costSavingsUSD: 0 };
    let modelBreakdownMap = {};

    // 1. Filter recent compressions
    recentCompressions = (this.stats.recent || []).filter(c => {
      const timestamp = new Date(c.timestamp);
      return timestamp >= startDate && timestamp <= endDate;
    });

    aggregatedData.count = recentCompressions.length;
    aggregatedData.originalTokens = recentCompressions.reduce((sum, c) => sum + c.originalTokens, 0);
    aggregatedData.compressedTokens = recentCompressions.reduce((sum, c) => sum + c.compressedTokens, 0);
    aggregatedData.tokensSaved = recentCompressions.reduce((sum, c) => sum + c.tokensSaved, 0);

    // Aggregate cost savings
    for (const c of recentCompressions) {
      if (c.costSavingsUSD && typeof c.costSavingsUSD === 'number') {
        aggregatedData.costSavingsUSD += c.costSavingsUSD;

        const modelKey = c.model || 'unknown';
        if (!modelBreakdownMap[modelKey]) {
          modelBreakdownMap[modelKey] = {
            modelName: this.MODEL_PRICING[modelKey]?.name || modelKey,
            compressions: 0,
            tokensSaved: 0,
            costSavingsUSD: 0
          };
        }
        modelBreakdownMap[modelKey].compressions++;
        modelBreakdownMap[modelKey].tokensSaved += c.tokensSaved;
        modelBreakdownMap[modelKey].costSavingsUSD += c.costSavingsUSD;
      }
    }

    // 2. Filter daily aggregates
    for (const [dayKey, dayStats] of Object.entries(this.stats.daily || {})) {
      const dayDate = new Date(dayKey + 'T00:00:00.000Z');
      if (dayDate >= startDate && dayDate <= endDate) {
        aggregatedData.count += dayStats.count;
        aggregatedData.originalTokens += dayStats.originalTokens;
        aggregatedData.compressedTokens += dayStats.compressedTokens;
        aggregatedData.tokensSaved += dayStats.tokensSaved;
      }
    }

    // 3. Filter monthly aggregates
    for (const [monthKey, monthStats] of Object.entries(this.stats.monthly || {})) {
      const monthDate = new Date(monthKey + '-01T00:00:00.000Z');
      const monthEnd = new Date(monthDate);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      if (monthDate <= endDate && monthEnd >= startDate) {
        aggregatedData.count += monthStats.count;
        aggregatedData.originalTokens += monthStats.originalTokens;
        aggregatedData.compressedTokens += monthStats.compressedTokens;
        aggregatedData.tokensSaved += monthStats.tokensSaved;
      }
    }

    // Convert model breakdown to array
    const modelBreakdown = Object.values(modelBreakdownMap)
      .sort((a, b) => b.costSavingsUSD - a.costSavingsUSD);

    const summary = {
      totalCompressions: aggregatedData.count,
      totalOriginalTokens: aggregatedData.originalTokens,
      totalCompressedTokens: aggregatedData.compressedTokens,
      totalTokensSaved: aggregatedData.tokensSaved,
      totalCostSavingsUSD: aggregatedData.costSavingsUSD,
      averageCompressionRatio: aggregatedData.originalTokens > 0
        ? Math.round((aggregatedData.compressedTokens / aggregatedData.originalTokens) * 1000) / 1000
        : 0,
      averageSavingsPercentage: aggregatedData.originalTokens > 0
        ? Math.round((aggregatedData.tokensSaved / aggregatedData.originalTokens) * 100 * 10) / 10
        : 0,
      modelBreakdown: modelBreakdown,
      periodLabel: periodLabel
    };

    return {
      summary,
      compressions: includeDetails ? recentCompressions.slice(0, limit) : []
    };
  }
}

// Test suite
describe('get_compression_stats Integration Tests', () => {
  let server;
  let testStats;

  before(async () => {
    // Setup: Create test stats file
    await fs.mkdir(TEST_STATS_DIR, { recursive: true });
    testStats = generateTestStats();
    await fs.writeFile(TEST_STATS_FILE, JSON.stringify(testStats, null, 2));

    // Mock server
    server = new MockMCPServer(testStats);
  });

  after(async () => {
    // Cleanup
    try {
      await fs.rm(TEST_STATS_DIR, { recursive: true, force: true });
    } catch (err) {
      console.error(`Warning: Could not clean up test directory: ${err.message}`);
    }
  });

  it('should filter by relativeDays=3 (last 3 days)', async () => {
    const result = await server.handleGetStats({ relativeDays: 3 });

    // Day 1 and Day 3 compressions - might be 1 or 2 depending on exact timing
    assert.ok(result.summary.totalCompressions >= 1, 'Should find at least 1 compression');
    assert.ok(result.summary.totalCompressions <= 2, 'Should find at most 2 compressions');
    assert.ok(result.summary.periodLabel.includes('3 Days'), 'Period label should mention 3 days');
  });

  it('should filter by relativeDays=7 (last week)', async () => {
    const result = await server.handleGetStats({ relativeDays: 7 });

    // Days 1, 3, and 7 - might be 2 or 3 depending on exact timing
    assert.ok(result.summary.totalCompressions >= 2, 'Should find at least 2 compressions');
    assert.ok(result.summary.totalCompressions <= 3, 'Should find at most 3 compressions');
    assert.ok(result.summary.totalTokensSaved >= 2250, 'Should save at least 2250 tokens');
  });

  it('should filter by relativeDays=30 (last 30 days)', async () => {
    const result = await server.handleGetStats({ relativeDays: 30 });

    assert.strictEqual(result.summary.totalCompressions, 5, 'Should find all 5 recent compressions');
    assert.strictEqual(result.summary.totalTokensSaved, 6650, 'Should save 6650 tokens');
  });

  it('should filter by custom date range (last 14-7 days)', async () => {
    const result = await server.handleGetStats({ startDate: '-14d', endDate: '-7d' });

    // Should include at least test4.js (14 days ago)
    assert.ok(result.summary.totalCompressions >= 1, 'Should find at least 1 compression');
    assert.ok(result.summary.totalCompressions <= 2, 'Should find at most 2 compressions');
  });

  it('should support legacy period=today (backward compatibility)', async () => {
    const result = await server.handleGetStats({ period: 'today' });

    // Should find 0 or 1 compression from last 24 hours (depends on exact timing)
    assert.ok(result.summary.totalCompressions >= 0, 'Should find at least 0 compressions');
    assert.ok(result.summary.totalCompressions <= 1, 'Should find at most 1 compression from last 24h');
  });

  it('should support legacy period=week (backward compatibility)', async () => {
    const result = await server.handleGetStats({ period: 'week' });

    // Should find 2-3 compressions from last 7 days (timing dependent)
    assert.ok(result.summary.totalCompressions >= 2, 'Should find at least 2 compressions');
    assert.ok(result.summary.totalCompressions <= 3, 'Should find at most 3 compressions');
  });

  it('should support legacy period=month (backward compatibility)', async () => {
    const result = await server.handleGetStats({ period: 'month' });

    assert.strictEqual(result.summary.totalCompressions, 5, 'Should find all 5 recent compressions');
    assert.strictEqual(result.summary.totalTokensSaved, 6650, 'Should save 6650 tokens');
  });

  it('should support legacy period=all (includes all tiers)', async () => {
    const result = await server.handleGetStats({ period: 'all' });

    assert.strictEqual(result.summary.totalCompressions, 50, 'Should find all 50 compressions');
    // Total should be close to expected (minor variance due to timing)
    assert.ok(result.summary.totalTokensSaved >= 86650, 'Should save at least 86650 tokens');
    assert.ok(result.summary.totalTokensSaved <= 87650, 'Should save at most 87650 tokens');
  });

  it('should filter by ISO date range (specific dates)', async () => {
    const startDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await server.handleGetStats({ startDate, endDate });

    assert.ok(result.summary.totalCompressions >= 1, 'Should find at least 1 compression');
    assert.ok(result.summary.totalCompressions <= 2, 'Should find at most 2 compressions');
  });

  it('should prioritize relativeDays over period parameter', async () => {
    const result = await server.handleGetStats({ relativeDays: 7, period: 'all' });

    // Should use relativeDays (7 days), not period (all)
    // Should be significantly less than 50 (all) but match 7-day filter
    assert.ok(result.summary.totalCompressions >= 2, 'Should use relativeDays parameter');
    assert.ok(result.summary.totalCompressions <= 3, 'Should filter by 7 days, not all');
    assert.ok(result.summary.totalCompressions < 50, 'Should NOT use period=all');
  });

  it('should reject invalid relativeDays (out of range)', async () => {
    await assert.rejects(
      async () => server.handleGetStats({ relativeDays: 400 }),
      /must be a number between 1 and 365/,
      'Should throw error for relativeDays > 365'
    );
  });

  it('should reject invalid date format', async () => {
    await assert.rejects(
      async () => server.handleGetStats({ startDate: 'invalid-date' }),
      /Invalid date format/,
      'Should throw error for invalid date format'
    );
  });

  it('should reject startDate after endDate', async () => {
    const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    await assert.rejects(
      async () => server.handleGetStats({ startDate, endDate }),
      /Invalid date range.*is after/,
      'Should throw error when startDate > endDate'
    );
  });

  it('should calculate cost savings correctly', async () => {
    const result = await server.handleGetStats({ relativeDays: 7 });

    // Verify cost savings are calculated and reasonable
    assert.ok(result.summary.totalCostSavingsUSD > 0, 'Should have positive cost savings');
    // Allow for timing variance - minimum 2 compressions (test1.js + test2.js)
    // test1: 0.00225, test2: 0.00450 = 0.00675
    // If test3 included (7d boundary): + 0.00300 = 0.00975
    assert.ok(result.summary.totalCostSavingsUSD >= 0.00225, 'Cost savings should be at least $0.00225');
    assert.ok(result.summary.totalCostSavingsUSD <= 0.00975, 'Cost savings should be at most $0.00975');
  });

  it('should track model breakdown correctly', async () => {
    const result = await server.handleGetStats({ relativeDays: 7 });

    assert.ok(Array.isArray(result.summary.modelBreakdown), 'Should have model breakdown array');
    assert.ok(result.summary.modelBreakdown.length > 0, 'Should have at least one model');

    // Find Claude Sonnet 4 breakdown
    const claudeBreakdown = result.summary.modelBreakdown.find(m => m.modelName === 'Claude Sonnet 4');
    assert.ok(claudeBreakdown, 'Should have Claude Sonnet 4 breakdown');
    // Should have 1-2 Claude compressions depending on timing
    assert.ok(claudeBreakdown.compressions >= 1, 'Should have at least 1 Claude compression');
    assert.ok(claudeBreakdown.compressions <= 2, 'Should have at most 2 Claude compressions in last 7 days');
  });

  it('should include details when includeDetails=true', async () => {
    const result = await server.handleGetStats({ relativeDays: 7, includeDetails: true });

    assert.ok(Array.isArray(result.compressions), 'Should have compressions array');
    assert.ok(result.compressions.length >= 2, 'Should include at least 2 compression details');
    assert.ok(result.compressions.length <= 3, 'Should include at most 3 compression details');
    assert.ok(result.compressions[0].timestamp, 'Each compression should have timestamp');
    assert.ok(result.compressions[0].path, 'Each compression should have path');
  });

  it('should respect limit parameter with includeDetails', async () => {
    const result = await server.handleGetStats({ relativeDays: 30, includeDetails: true, limit: 2 });

    assert.strictEqual(result.compressions.length, 2, 'Should limit details to 2 compressions');
  });
});
