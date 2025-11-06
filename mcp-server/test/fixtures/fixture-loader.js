/**
 * Fixture loader utility for test files
 *
 * Provides helpers to load production stats samples from fixtures directory
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Load a fixture file from the stats-samples directory
 *
 * @param {string} filename - Name of the fixture file (e.g., 'cost-reporting.json')
 * @returns {Promise<Object>} Parsed JSON fixture data
 * @throws {Error} If fixture file cannot be read or parsed
 */
async function loadFixture(filename) {
  const fixturePath = path.join(__dirname, 'stats-samples', filename);
  try {
    const data = await fs.readFile(fixturePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    throw new Error(`Failed to load fixture ${filename}: ${error.message}`);
  }
}

/**
 * Create a deep copy of fixture data to prevent mutations
 *
 * @param {Object} fixtureData - Original fixture data
 * @returns {Object} Deep copy of the fixture data
 */
function cloneFixture(fixtureData) {
  return JSON.parse(JSON.stringify(fixtureData));
}

module.exports = {
  loadFixture,
  cloneFixture
};
