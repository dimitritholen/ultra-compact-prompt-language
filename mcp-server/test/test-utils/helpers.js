const fs = require('fs').promises;

/**
 * Check if a file exists using fs.access()
 *
 * This is a safe, non-throwing way to check file existence without
 * requiring read permissions.
 *
 * @param {string} filePath - Absolute or relative path to check
 * @returns {Promise<boolean>} True if file exists, false otherwise
 * @example
 * // Check if stats file exists
 * const exists = await fileExists('/path/to/file.json');
 * if (exists) {
 *   // File exists, proceed with reading
 * }
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
 *
 * Repeatedly calls the condition function until it returns a truthy value
 * or the maximum wait time is exceeded. Uses exponential backoff to reduce
 * CPU usage while waiting.
 *
 * @param {Function} condition - Async function that returns truthy value when condition is met
 * @param {Object} [options] - Polling configuration options
 * @param {number} [options.maxWaitMs=5000] - Maximum time to wait in milliseconds
 * @param {number} [options.initialDelay=100] - Initial delay between polls in milliseconds
 * @param {number} [options.maxDelay=1000] - Maximum delay between polls in milliseconds
 * @returns {Promise<any>} The truthy result from the condition function
 * @throws {Error} When condition is not met within maxWaitMs
 * @example
 * // Wait for a file to exist
 * await pollForCondition(
 *   async () => await fileExists('/path/to/file.json'),
 *   { maxWaitMs: 10000, initialDelay: 200 }
 * );
 *
 * @example
 * // Wait for stats to update with specific record count
 * const stats = await pollForCondition(
 *   async () => {
 *     const data = await fs.readFile(statsFile, 'utf-8');
 *     const parsed = JSON.parse(data);
 *     return parsed.recent.length >= 3 ? parsed : null;
 *   },
 *   { maxWaitMs: 5000 }
 * );
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
      // Continue polling - errors are expected while waiting
    }

    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, maxDelay);
  }

  throw new Error(`Condition not met within ${maxWaitMs}ms`);
}

/**
 * Clean up test files safely without throwing errors
 *
 * Attempts to delete multiple files, ignoring ENOENT errors (file not found)
 * but warning about other errors. Safe to call in afterEach hooks.
 *
 * @param {...string} filePaths - Variable number of file paths to remove
 * @returns {Promise<void>}
 * @example
 * // Clean up test files in afterEach hook
 * afterEach(async () => {
 *   await cleanupFiles(
 *     '/tmp/test-stats.json',
 *     '/tmp/test-stats.json.backup',
 *     '/tmp/test-marker.txt'
 *   );
 * });
 *
 * @example
 * // Clean up array of files
 * const files = [file1, file2, file3];
 * await cleanupFiles(...files);
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
