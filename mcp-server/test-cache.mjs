/**
 * Test Cache Module
 *
 * Provides a resettable cache for test isolation.
 * Encapsulates LLM client caching with automatic lifecycle management.
 *
 * @module test-cache
 */

/**
 * Cache state
 */
let cachedLLMClient = null;
let llmDetectionCallCount = 0;

/**
 * Get the cached LLM client
 *
 * @returns {Object|null} The cached LLM client or null if not cached
 */
export function getCachedLLMClient() {
  return cachedLLMClient;
}

/**
 * Set the cached LLM client
 *
 * @param {Object|null} client - The LLM client to cache
 */
export function setCachedLLMClient(client) {
  cachedLLMClient = client;
}

/**
 * Get the LLM detection call count
 *
 * @returns {number} The number of times LLM detection was called
 */
export function getLLMDetectionCallCount() {
  return llmDetectionCallCount;
}

/**
 * Increment the LLM detection call count
 *
 * @returns {number} The new call count
 */
export function incrementLLMDetectionCallCount() {
  return ++llmDetectionCallCount;
}

/**
 * Reset all cache state
 *
 * This method is idempotent and safe to call multiple times.
 * Should be called between tests to ensure test isolation.
 *
 * @returns {void}
 */
export function resetCache() {
  cachedLLMClient = null;
  llmDetectionCallCount = 0;
}

/**
 * Cache API for external use
 */
export default {
  getCachedLLMClient,
  setCachedLLMClient,
  getLLMDetectionCallCount,
  incrementLLMDetectionCallCount,
  resetCache
};
