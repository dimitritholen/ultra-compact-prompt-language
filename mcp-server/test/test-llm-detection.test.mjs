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
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Import production functions and constants from server.js
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, '../server.js');

// Helper to get fresh imports (clears cache)
function getServerModule() {
  delete require.cache[SERVER_PATH];
  return require('./server.js');
}

const {
  MODEL_PRICING
} = require('./server.js');

const DEFAULT_MODEL = 'claude-sonnet-4';
const CONFIG_FILE = path.join(os.homedir(), '.ucpl', 'compress', 'config.json');

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
  beforeEach(async () => {
    clearEnvVars();
    // Remove production config file to ensure clean state
    try {
      await fs.unlink(CONFIG_FILE);
    } catch (err) {
      // Ignore if doesn't exist
    }
  });

  afterEach(() => {
    clearEnvVars();
  });

  test('Default detection (no env vars)', async () => {
    const { detectLLMClient } = getServerModule();
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'unknown');
    assert.strictEqual(result.model, 'claude-sonnet-4');
  });

  test('Claude Desktop detection', async () => {
    process.env.CLAUDE_DESKTOP_VERSION = '1.0.0';
    const { detectLLMClient } = getServerModule();
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'claude-desktop');
    assert.strictEqual(result.model, 'claude-sonnet-4');
  });

  test('Claude Code detection (VSCODE_PID)', async () => {
    process.env.VSCODE_PID = '12345';
    const { detectLLMClient } = getServerModule();
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'claude-code');
    assert.strictEqual(result.model, 'claude-sonnet-4');
  });

  test('Claude Code detection (CLINE_VERSION)', async () => {
    process.env.CLINE_VERSION = '2.0.0';
    const { detectLLMClient } = getServerModule();
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'claude-code');
    assert.strictEqual(result.model, 'claude-sonnet-4');
  });

  test('ANTHROPIC_MODEL env var', async () => {
    process.env.ANTHROPIC_MODEL = 'claude-opus-4';
    const { detectLLMClient } = getServerModule();
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'anthropic-sdk');
    assert.strictEqual(result.model, 'claude-opus-4');
  });

  test('OPENAI_MODEL env var', async () => {
    process.env.OPENAI_MODEL = 'gpt-4o';
    const { detectLLMClient } = getServerModule();
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'openai-sdk');
    assert.strictEqual(result.model, 'gpt-4o');
  });

  test('Config file override', async () => {
    process.env.CLAUDE_DESKTOP_VERSION = '1.0.0'; // This should be overridden by config
    // Write to production config file location
    await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify({ model: 'gpt-4o' }));

    const { detectLLMClient } = getServerModule();
    const result = await detectLLMClient();
    assert.strictEqual(result.client, 'config-override');
    assert.strictEqual(result.model, 'gpt-4o');

    await fs.unlink(CONFIG_FILE);
  });
});

describe('Cost Calculation', () => {
  describe('Specific Models', () => {
    test('Claude Sonnet 4', async () => {
      const { calculateCostSavings } = getServerModule();
      const tokensSaved = 1_000_000; // 1 million tokens
      const result = await calculateCostSavings(tokensSaved, 'claude-sonnet-4');
      assert.strictEqual(result.costSavingsUSD, 3.00);
      assert.strictEqual(result.model, 'claude-sonnet-4');
      assert.strictEqual(result.pricePerMTok, 3.00);
    });

    test('Claude Opus 4', async () => {
      const { calculateCostSavings } = getServerModule();
      const tokensSaved = 500_000; // 500k tokens
      const result = await calculateCostSavings(tokensSaved, 'claude-opus-4');
      assert.strictEqual(result.costSavingsUSD, 7.50);
      assert.strictEqual(result.model, 'claude-opus-4');
      assert.strictEqual(result.pricePerMTok, 15.00);
    });

    test('GPT-4o', async () => {
      const { calculateCostSavings } = getServerModule();
      const tokensSaved = 2_000_000; // 2 million tokens
      const result = await calculateCostSavings(tokensSaved, 'gpt-4o');
      assert.strictEqual(result.costSavingsUSD, 5.00);
      assert.strictEqual(result.model, 'gpt-4o');
      assert.strictEqual(result.pricePerMTok, 2.50);
    });
  });

  describe('Edge Cases', () => {
    test('Small amounts (rounding)', async () => {
      const { calculateCostSavings } = getServerModule();
      const tokensSaved = 12_345; // Small amount
      const result = await calculateCostSavings(tokensSaved, 'claude-sonnet-4');
      assert.strictEqual(result.costSavingsUSD, 0.04); // (12345 / 1M) * 3.00 = 0.037035, rounds to 0.04
    });

    test('Zero tokens', async () => {
      const { calculateCostSavings } = getServerModule();
      const tokensSaved = 0;
      const result = await calculateCostSavings(tokensSaved, 'claude-sonnet-4');
      assert.strictEqual(result.costSavingsUSD, 0.00);
    });

    test('Auto-detect model', async () => {
      clearEnvVars();
      process.env.ANTHROPIC_MODEL = 'claude-opus-4';
      const { calculateCostSavings } = getServerModule();
      const tokensSaved = 1_000_000;
      const result = await calculateCostSavings(tokensSaved, null); // null = auto-detect
      assert.strictEqual(result.model, 'claude-opus-4');
      assert.strictEqual(result.costSavingsUSD, 15.00);
      clearEnvVars();
    });

    test('Invalid model fallback', async () => {
      const { calculateCostSavings } = getServerModule();
      const tokensSaved = 1_000_000;
      const result = await calculateCostSavings(tokensSaved, 'invalid-model');
      // Function uses default pricing when model not found, but keeps the model name
      assert.strictEqual(result.model, 'invalid-model');
      assert.strictEqual(result.costSavingsUSD, 3.00); // Uses default pricing
    });
  });
});

describe('Config File Error Handling', () => {
  const TEST_CONFIG_DIR = path.join(os.tmpdir(), `test-llm-config-${Date.now()}`);
  const TEST_CONFIG_FILE = path.join(TEST_CONFIG_DIR, 'config.json');

  beforeEach(async () => {
    await fs.mkdir(TEST_CONFIG_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_CONFIG_DIR, { recursive: true, force: true });
  });

  test('should handle malformed JSON gracefully', async () => {
    await fs.writeFile(TEST_CONFIG_FILE, '{invalid json content');

    const { detectLLMClient } = getServerModule();
    const result = await detectLLMClient(TEST_CONFIG_FILE);

    // Should fallback to environment detection
    assert.strictEqual(result.client, 'unknown');
    assert.strictEqual(result.model, 'claude-sonnet-4');
  });

  test('should handle file permission errors', async () => {
    await fs.writeFile(TEST_CONFIG_FILE, '{"model": "gpt-4o"}');
    await fs.chmod(TEST_CONFIG_FILE, 0o000); // Remove all permissions

    const { detectLLMClient } = getServerModule();
    const result = await detectLLMClient(TEST_CONFIG_FILE);

    // Should fallback gracefully
    assert.ok(result.client);
    assert.ok(result.model);

    // Cleanup
    await fs.chmod(TEST_CONFIG_FILE, 0o644);
  });

  test('should handle non-object JSON', async () => {
    await fs.writeFile(TEST_CONFIG_FILE, '"just a string"');

    const { detectLLMClient } = getServerModule();
    const result = await detectLLMClient(TEST_CONFIG_FILE);

    // Should fallback to defaults
    assert.strictEqual(result.client, 'unknown');
  });

  test('should handle null/undefined values', async () => {
    await fs.writeFile(TEST_CONFIG_FILE, 'null');

    const { detectLLMClient } = getServerModule();
    const result = await detectLLMClient(TEST_CONFIG_FILE);

    assert.ok(result.client);
    assert.ok(result.model);
  });
});
