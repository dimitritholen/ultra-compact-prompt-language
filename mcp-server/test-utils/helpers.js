const fs = require('fs').promises;

/**
 * Check if a file exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Poll for a condition with exponential backoff
 * @param {Function} condition - Async function that returns truthy when condition met
 * @param {Object} options - {maxWaitMs: 5000, initialDelay: 100, maxDelay: 1000}
 * @returns {Promise<any>} Result from condition function
 */
async function pollForCondition(condition, options = {}) {
  const { maxWaitMs = 5000, initialDelay = 100, maxDelay = 1000 } = options;
  const startTime = Date.now();
  let delay = initialDelay;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const result = await condition();
      if (result) {
        return result;
      }
    } catch (error) {
      // Continue polling
    }

    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, maxDelay);
  }

  throw new Error(`Condition not met within ${maxWaitMs}ms`);
}

/**
 * Clean up test files safely
 * @param {string[]} filePaths - Array of file paths to remove
 */
async function cleanupFiles(...filePaths) {
  for (const filePath of filePaths) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`Failed to cleanup ${filePath}:`, error.message);
      }
    }
  }
}

module.exports = {
  fileExists,
  pollForCondition,
  cleanupFiles
};
