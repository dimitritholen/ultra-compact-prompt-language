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
        model: 'gpt-4o',
        client: 'openai-sdk',
        pricePerMTok: 2.50,
        costSavingsUSD: 0.00375,
        currency: 'USD'
      }
    ],
    daily: {},
    monthly: {},
    summary: {
      totalCompressions: 2,
      totalOriginalTokens: 3000,
      totalCompressedTokens: 750,
      totalTokensSaved: 2250
    }
  };
}

module.exports = {
  generateStatsWithCost
};
