/**
 * Generate test statistics fixture with cost tracking data
 *
 * Creates a complete statistics object with realistic compression records
 * including cost tracking fields (model, pricePerMTok, costSavingsUSD).
 * Useful for testing cost calculation and display features.
 *
 * @param {Object} [options] - Customization options (currently unused, reserved for future extensions)
 * @param {number} [options.recordCount] - Number of compression records to generate (default: 2)
 * @param {string[]} [options.models] - Array of model names to use (cycles through them)
 * @returns {Object} Complete statistics object with version, recent, daily, monthly, and summary
 * @returns {string} return.version - Statistics file format version (always '2.0')
 * @returns {Array} return.recent - Array of recent compression records with cost data
 * @returns {Object} return.daily - Daily aggregation object (empty in fixture)
 * @returns {Object} return.monthly - Monthly aggregation object (empty in fixture)
 * @returns {Object} return.summary - Summary totals for all compressions
 * @example
 * // Generate default stats fixture
 * const stats = generateStatsWithCost();
 * assert.strictEqual(stats.recent.length, 2);
 * assert.ok(stats.recent[0].costSavingsUSD);
 *
 * @example
 * // Use in test setup
 * beforeEach(async () => {
 *   const testStats = generateStatsWithCost();
 *   await fs.writeFile(statsFile, JSON.stringify(testStats, null, 2));
 * });
 */
function generateStatsWithCost(options = {}) {
  const now = new Date();
  const daysAgo = (days) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    version: "2.0",
    recent: [
      {
        timestamp: daysAgo(1).toISOString(),
        path: "test1.js",
        originalTokens: 1000,
        compressedTokens: 250,
        tokensSaved: 750,
        compressionRatio: 0.25,
        savingsPercentage: 75,
        level: "full",
        format: "text",
        model: "claude-sonnet-4",
        client: "claude-desktop",
        pricePerMTok: 3.0,
        costSavingsUSD: 0.00225,
        currency: "USD",
      },
      {
        timestamp: daysAgo(3).toISOString(),
        path: "test2.js",
        originalTokens: 2000,
        compressedTokens: 500,
        tokensSaved: 1500,
        compressionRatio: 0.25,
        savingsPercentage: 75,
        level: "full",
        format: "text",
        model: "gpt-4o",
        client: "openai-sdk",
        pricePerMTok: 2.5,
        costSavingsUSD: 0.00375,
        currency: "USD",
      },
    ],
    daily: {},
    monthly: {},
    summary: {
      totalCompressions: 2,
      totalOriginalTokens: 3000,
      totalCompressedTokens: 750,
      totalTokensSaved: 2250,
    },
  };
}

module.exports = {
  generateStatsWithCost,
};
