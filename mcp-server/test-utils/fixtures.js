/**
 * Generate test statistics with cost tracking
 * @param {Object} options - Customization options
 * @returns {Object} Stats object
 */
function generateStatsWithCost(options = {}) {
  const now = new Date();
  const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    version: '2.0',
    recent: [
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
        client: 'claude-desktop',
        pricePerMTok: 3.00,
        costSavingsUSD: 0.00225,
        currency: 'USD'
      }
    ],
    daily: {},
    monthly: {},
    summary: {
      totalCompressions: 1,
      totalOriginalTokens: 1000,
      totalCompressedTokens: 250,
      totalTokensSaved: 750
    }
  };
}

module.exports = {
  generateStatsWithCost
};
