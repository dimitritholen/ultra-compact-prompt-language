/**
 * Test suite for LLM client detection and cost calculation
 *
 * Tests:
 * 1. detectLLMClient() with various environment variables
 * 2. Config file override
 * 3. calculateCostSavings() accuracy
 * 4. Edge cases and fallbacks
 *
 * Migrated to node:test format.
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

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

describe('LLM Client Detection', () => {
  beforeEach(() => {
    clearEnvVars();
  });

  afterEach(() => {
    clearEnvVars();
  });

  test('Default detection (no env vars)', async () => {
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'unknown');
    assert.strictEqual(result.model, 'claude-sonnet-4');
  });

  test('Claude Desktop detection', async () => {
    process.env.CLAUDE_DESKTOP_VERSION = '1.0.0';
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'claude-desktop');
    assert.strictEqual(result.model, 'claude-sonnet-4');
  });

  test('Claude Code detection (VSCODE_PID)', async () => {
    process.env.VSCODE_PID = '12345';
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'claude-code');
    assert.strictEqual(result.model, 'claude-sonnet-4');
  });

  test('Claude Code detection (CLINE_VERSION)', async () => {
    process.env.CLINE_VERSION = '2.0.0';
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'claude-code');
    assert.strictEqual(result.model, 'claude-sonnet-4');
  });

  test('ANTHROPIC_MODEL env var', async () => {
    process.env.ANTHROPIC_MODEL = 'claude-opus-4';
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'anthropic-sdk');
    assert.strictEqual(result.model, 'claude-opus-4');
  });

  test('OPENAI_MODEL env var', async () => {
    process.env.OPENAI_MODEL = 'gpt-4o';
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'openai-sdk');
    assert.strictEqual(result.model, 'gpt-4o');
  });

  test('Config file override', async () => {
    process.env.CLAUDE_DESKTOP_VERSION = '1.0.0'; // This should be overridden by config
    await fs.writeFile(TEST_CONFIG_FILE, JSON.stringify({ model: 'gpt-4o' }));

    const result = await detectLLMClient(TEST_CONFIG_FILE);
    assert.strictEqual(result.client, 'config-override');
    assert.strictEqual(result.model, 'gpt-4o');

    await fs.unlink(TEST_CONFIG_FILE);
  });
});

describe('Cost Calculation', () => {
  describe('Specific Models', () => {
    test('Claude Sonnet 4', async () => {
      const tokensSaved = 1_000_000; // 1 million tokens
      const result = await calculateCostSavings(tokensSaved, 'claude-sonnet-4');
      assert.strictEqual(result.costSavingsUSD, 3.00);
      assert.strictEqual(result.model, 'claude-sonnet-4');
      assert.strictEqual(result.pricePerMTok, 3.00);
    });

    test('Claude Opus 4', async () => {
      const tokensSaved = 500_000; // 500k tokens
      const result = await calculateCostSavings(tokensSaved, 'claude-opus-4');
      assert.strictEqual(result.costSavingsUSD, 7.50);
      assert.strictEqual(result.model, 'claude-opus-4');
      assert.strictEqual(result.pricePerMTok, 15.00);
    });

    test('GPT-4o', async () => {
      const tokensSaved = 2_000_000; // 2 million tokens
      const result = await calculateCostSavings(tokensSaved, 'gpt-4o');
      assert.strictEqual(result.costSavingsUSD, 5.00);
      assert.strictEqual(result.model, 'gpt-4o');
      assert.strictEqual(result.pricePerMTok, 2.50);
    });
  });

  describe('Edge Cases', () => {
    test('Small amounts (rounding)', async () => {
      const tokensSaved = 12_345; // Small amount
      const result = await calculateCostSavings(tokensSaved, 'claude-sonnet-4');
      assert.strictEqual(result.costSavingsUSD, 0.04); // (12345 / 1M) * 3.00 = 0.037035, rounds to 0.04
    });

    test('Zero tokens', async () => {
      const tokensSaved = 0;
      const result = await calculateCostSavings(tokensSaved, 'claude-sonnet-4');
      assert.strictEqual(result.costSavingsUSD, 0.00);
    });

    test('Auto-detect model', async () => {
      clearEnvVars();
      process.env.ANTHROPIC_MODEL = 'claude-opus-4';
      const tokensSaved = 1_000_000;
      const result = await calculateCostSavings(tokensSaved, null); // null = auto-detect
      assert.strictEqual(result.model, 'claude-opus-4');
      assert.strictEqual(result.costSavingsUSD, 15.00);
      clearEnvVars();
    });

    test('Invalid model fallback', async () => {
      const tokensSaved = 1_000_000;
      const result = await calculateCostSavings(tokensSaved, 'invalid-model');
      // Function uses default pricing when model not found, but keeps the model name
      assert.strictEqual(result.model, 'invalid-model');
      assert.strictEqual(result.costSavingsUSD, 3.00); // Uses default pricing
    });
  });
});
