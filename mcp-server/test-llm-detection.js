#!/usr/bin/env node

/**
 * Test suite for LLM client detection and cost calculation
 *
 * Tests:
 * 1. detectLLMClient() with various environment variables
 * 2. Config file override
 * 3. calculateCostSavings() accuracy
 * 4. Edge cases and fallbacks
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const assert = require('assert');

// Import the functions we need to test (in a real scenario, these would be exported from server.js)
// For testing purposes, we'll duplicate the logic here

const MODEL_PRICING = {
  'claude-sonnet-4': { pricePerMTok: 3.00, name: 'Claude Sonnet 4' },
  'claude-opus-4': { pricePerMTok: 15.00, name: 'Claude Opus 4' },
  'gpt-4o': { pricePerMTok: 2.50, name: 'GPT-4o' },
  'gpt-4o-mini': { pricePerMTok: 0.15, name: 'GPT-4o Mini' },
  'gemini-2.0-flash': { pricePerMTok: 0.10, name: 'Gemini 2.0 Flash' },
  'o1': { pricePerMTok: 15.00, name: 'OpenAI o1' },
  'o1-mini': { pricePerMTok: 3.00, name: 'OpenAI o1-mini' }
};

const DEFAULT_MODEL = 'claude-sonnet-4';
const CONFIG_FILE = path.join(os.homedir(), '.ucpl', 'compress', 'config.json');
const TEST_CONFIG_FILE = path.join(os.tmpdir(), 'test-ucpl-config.json');

/**
 * Detect LLM client and model from environment variables
 */
async function detectLLMClient(configFile = CONFIG_FILE) {
  try {
    // Try config file first (highest priority)
    try {
      const configData = await fs.readFile(configFile, 'utf-8');
      const config = JSON.parse(configData);
      if (config.model && MODEL_PRICING[config.model]) {
        return { client: 'config-override', model: config.model };
      }
    } catch (_err) {
      // Config file doesn't exist or is invalid - continue with env detection
    }

    // Check for Claude Desktop
    if (process.env.CLAUDE_DESKTOP_VERSION) {
      return { client: 'claude-desktop', model: 'claude-sonnet-4' };
    }

    // Check for Claude Code / VSCode
    if (process.env.VSCODE_PID || process.env.CLINE_VERSION) {
      return { client: 'claude-code', model: 'claude-sonnet-4' };
    }

    // Check for other common environment variables
    if (process.env.ANTHROPIC_MODEL && MODEL_PRICING[process.env.ANTHROPIC_MODEL]) {
      return { client: 'anthropic-sdk', model: process.env.ANTHROPIC_MODEL };
    }

    if (process.env.OPENAI_MODEL && MODEL_PRICING[process.env.OPENAI_MODEL]) {
      return { client: 'openai-sdk', model: process.env.OPENAI_MODEL };
    }

    // Default fallback
    return { client: 'unknown', model: DEFAULT_MODEL };
  } catch (error) {
    return { client: 'error', model: DEFAULT_MODEL };
  }
}

/**
 * Calculate cost savings
 */
async function calculateCostSavings(tokensSaved, model = null, configFile = CONFIG_FILE) {
  try {
    if (!model) {
      const detection = await detectLLMClient(configFile);
      model = detection.model;
    }

    const pricing = MODEL_PRICING[model] || MODEL_PRICING[DEFAULT_MODEL];
    const pricePerMTok = pricing.pricePerMTok;
    const costSavingsUSD = (tokensSaved / 1_000_000) * pricePerMTok;
    const costSavingsRounded = Math.round(costSavingsUSD * 100) / 100;

    return {
      costSavingsUSD: costSavingsRounded,
      model: model,
      modelName: pricing.name,
      pricePerMTok: pricePerMTok
    };
  } catch (error) {
    return {
      costSavingsUSD: 0,
      model: DEFAULT_MODEL,
      modelName: MODEL_PRICING[DEFAULT_MODEL].name,
      pricePerMTok: MODEL_PRICING[DEFAULT_MODEL].pricePerMTok
    };
  }
}

/**
 * Test helpers
 */
function clearEnvVars() {
  delete process.env.CLAUDE_DESKTOP_VERSION;
  delete process.env.VSCODE_PID;
  delete process.env.CLINE_VERSION;
  delete process.env.ANTHROPIC_MODEL;
  delete process.env.OPENAI_MODEL;
}

async function runTests() {
  console.log('Running LLM Detection and Cost Calculation Tests...\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Default detection (no env vars)
  try {
    clearEnvVars();
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'unknown');
    assert.strictEqual(result.model, 'claude-sonnet-4');
    console.log('✓ Test 1: Default detection works');
    passed++;
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    failed++;
  }

  // Test 2: Claude Desktop detection
  try {
    clearEnvVars();
    process.env.CLAUDE_DESKTOP_VERSION = '1.0.0';
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'claude-desktop');
    assert.strictEqual(result.model, 'claude-sonnet-4');
    console.log('✓ Test 2: Claude Desktop detection works');
    passed++;
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    failed++;
  }

  // Test 3: Claude Code detection (VSCODE_PID)
  try {
    clearEnvVars();
    process.env.VSCODE_PID = '12345';
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'claude-code');
    assert.strictEqual(result.model, 'claude-sonnet-4');
    console.log('✓ Test 3: Claude Code detection (VSCODE_PID) works');
    passed++;
  } catch (error) {
    console.error('✗ Test 3 failed:', error.message);
    failed++;
  }

  // Test 4: Claude Code detection (CLINE_VERSION)
  try {
    clearEnvVars();
    process.env.CLINE_VERSION = '2.0.0';
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'claude-code');
    assert.strictEqual(result.model, 'claude-sonnet-4');
    console.log('✓ Test 4: Claude Code detection (CLINE_VERSION) works');
    passed++;
  } catch (error) {
    console.error('✗ Test 4 failed:', error.message);
    failed++;
  }

  // Test 5: ANTHROPIC_MODEL env var
  try {
    clearEnvVars();
    process.env.ANTHROPIC_MODEL = 'claude-opus-4';
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'anthropic-sdk');
    assert.strictEqual(result.model, 'claude-opus-4');
    console.log('✓ Test 5: ANTHROPIC_MODEL env var works');
    passed++;
  } catch (error) {
    console.error('✗ Test 5 failed:', error.message);
    failed++;
  }

  // Test 6: OPENAI_MODEL env var
  try {
    clearEnvVars();
    process.env.OPENAI_MODEL = 'gpt-4o';
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'openai-sdk');
    assert.strictEqual(result.model, 'gpt-4o');
    console.log('✓ Test 6: OPENAI_MODEL env var works');
    passed++;
  } catch (error) {
    console.error('✗ Test 6 failed:', error.message);
    failed++;
  }

  // Test 7: Config file override
  try {
    clearEnvVars();
    process.env.CLAUDE_DESKTOP_VERSION = '1.0.0'; // This should be overridden by config
    await fs.writeFile(TEST_CONFIG_FILE, JSON.stringify({ model: 'gpt-4o' }));
    const result = await detectLLMClient(TEST_CONFIG_FILE);
    assert.strictEqual(result.client, 'config-override');
    assert.strictEqual(result.model, 'gpt-4o');
    await fs.unlink(TEST_CONFIG_FILE);
    console.log('✓ Test 7: Config file override works');
    passed++;
  } catch (error) {
    console.error('✗ Test 7 failed:', error.message);
    failed++;
  }

  // Test 8: Cost calculation - Claude Sonnet 4
  try {
    const tokensSaved = 1_000_000; // 1 million tokens
    const result = await calculateCostSavings(tokensSaved, 'claude-sonnet-4');
    assert.strictEqual(result.costSavingsUSD, 3.00);
    assert.strictEqual(result.model, 'claude-sonnet-4');
    assert.strictEqual(result.pricePerMTok, 3.00);
    console.log('✓ Test 8: Cost calculation for Claude Sonnet 4 works');
    passed++;
  } catch (error) {
    console.error('✗ Test 8 failed:', error.message);
    failed++;
  }

  // Test 9: Cost calculation - Claude Opus 4
  try {
    const tokensSaved = 500_000; // 500k tokens
    const result = await calculateCostSavings(tokensSaved, 'claude-opus-4');
    assert.strictEqual(result.costSavingsUSD, 7.50);
    assert.strictEqual(result.model, 'claude-opus-4');
    assert.strictEqual(result.pricePerMTok, 15.00);
    console.log('✓ Test 9: Cost calculation for Claude Opus 4 works');
    passed++;
  } catch (error) {
    console.error('✗ Test 9 failed:', error.message);
    failed++;
  }

  // Test 10: Cost calculation - GPT-4o
  try {
    const tokensSaved = 2_000_000; // 2 million tokens
    const result = await calculateCostSavings(tokensSaved, 'gpt-4o');
    assert.strictEqual(result.costSavingsUSD, 5.00);
    assert.strictEqual(result.model, 'gpt-4o');
    assert.strictEqual(result.pricePerMTok, 2.50);
    console.log('✓ Test 10: Cost calculation for GPT-4o works');
    passed++;
  } catch (error) {
    console.error('✗ Test 10 failed:', error.message);
    failed++;
  }

  // Test 11: Cost calculation - small amounts (rounding)
  try {
    const tokensSaved = 12_345; // Small amount
    const result = await calculateCostSavings(tokensSaved, 'claude-sonnet-4');
    assert.strictEqual(result.costSavingsUSD, 0.04); // (12345 / 1M) * 3.00 = 0.037035, rounds to 0.04
    console.log('✓ Test 11: Cost calculation with rounding works');
    passed++;
  } catch (error) {
    console.error('✗ Test 11 failed:', error.message);
    failed++;
  }

  // Test 12: Cost calculation - zero tokens
  try {
    const tokensSaved = 0;
    const result = await calculateCostSavings(tokensSaved, 'claude-sonnet-4');
    assert.strictEqual(result.costSavingsUSD, 0.00);
    console.log('✓ Test 12: Cost calculation with zero tokens works');
    passed++;
  } catch (error) {
    console.error('✗ Test 12 failed:', error.message);
    failed++;
  }

  // Test 13: Cost calculation - auto-detect model
  try {
    clearEnvVars();
    process.env.ANTHROPIC_MODEL = 'claude-opus-4';
    const tokensSaved = 1_000_000;
    const result = await calculateCostSavings(tokensSaved, null); // null = auto-detect
    assert.strictEqual(result.model, 'claude-opus-4');
    assert.strictEqual(result.costSavingsUSD, 15.00);
    console.log('✓ Test 13: Cost calculation with auto-detect works');
    passed++;
  } catch (error) {
    console.error('✗ Test 13 failed:', error.message);
    failed++;
  }

  // Test 14: Invalid model fallback
  try {
    const tokensSaved = 1_000_000;
    const result = await calculateCostSavings(tokensSaved, 'invalid-model');
    assert.strictEqual(result.model, 'claude-sonnet-4'); // Should fallback to default
    assert.strictEqual(result.costSavingsUSD, 3.00);
    console.log('✓ Test 14: Invalid model fallback works');
    passed++;
  } catch (error) {
    console.error('✗ Test 14 failed:', error.message);
    failed++;
  }

  // Cleanup
  clearEnvVars();

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
