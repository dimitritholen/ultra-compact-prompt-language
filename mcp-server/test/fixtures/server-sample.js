#!/usr/bin/env node

/**
 * MCP Server for ucpl-compress
 *
 * Provides code context compression as an MCP tool for Claude Desktop,
 * Claude Code, Codex, and other MCP-compatible clients.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { encodingForModel } = require('js-tiktoken');

// Path to ucpl-compress script (bundled with package)
const COMPRESS_SCRIPT = path.join(__dirname, 'scripts', 'ucpl-compress');

// Path to statistics storage file (cross-platform user home directory)
const STATS_DIR = path.join(os.homedir(), '.ucpl', 'compress');
const STATS_FILE = path.join(STATS_DIR, 'compression-stats.json');

// Token counting model (using gpt-4o as approximation for Claude)
const TOKEN_MODEL = 'gpt-4o';

// Retention policy (aggressive: 30/365/5y)
const RETENTION_POLICY = {
  RECENT_DAYS: 30,      // Keep detailed records for last 30 days
  DAILY_DAYS: 365,      // Keep daily aggregates for 365 days
  MONTHLY_YEARS: 5      // Keep monthly aggregates for 5 years
};

// LLM Model Pricing (USD per million input tokens)
// Prices as of 2025-11-06
const MODEL_PRICING = {
  'claude-sonnet-4': { pricePerMTok: 3.00, name: 'Claude Sonnet 4' },
  'claude-opus-4': { pricePerMTok: 15.00, name: 'Claude Opus 4' },
  'gpt-4o': { pricePerMTok: 2.50, name: 'GPT-4o' },
  'gpt-4o-mini': { pricePerMTok: 0.15, name: 'GPT-4o Mini' },
  'gemini-2.0-flash': { pricePerMTok: 0.10, name: 'Gemini 2.0 Flash' },
  'o1': { pricePerMTok: 15.00, name: 'OpenAI o1' },
  'o1-mini': { pricePerMTok: 3.00, name: 'OpenAI o1-mini' }
};

// Default model if detection fails
const DEFAULT_MODEL = 'claude-sonnet-4';

// Path to optional config file for model override
const CONFIG_FILE = path.join(os.homedir(), '.ucpl', 'compress', 'config.json');

// Cache for LLM client detection (one-time per server lifecycle)
let cachedLLMClient = null;

/**
 * Detect LLM client and model from environment variables (cached per server lifecycle)
 * @returns {Promise<{client: string, model: string}>} Detected client and model
 */
async function detectLLMClient() {
  // Return cached result if available
  if (cachedLLMClient) {
    return cachedLLMClient;
  }

  try {
    // Try config file first (highest priority)
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(configData);

      // Validate config schema
      if (typeof config !== 'object' || config === null) {
        throw new Error('Config must be a valid JSON object');
      }

      if (config.model && MODEL_PRICING[config.model]) {
        console.error(`[INFO] Using model from config file: ${config.model}`);
        cachedLLMClient = { client: 'config-override', model: config.model };
        return cachedLLMClient;
      } else if (config.model) {
        console.error(`[WARN] Unknown model in config: ${config.model}, falling back to env detection`);
      }
    } catch (err) {
      // Config file doesn't exist or is invalid - continue with env detection
      if (err.code !== 'ENOENT') {
        console.error(`[WARN] Config file error: ${err.message}`);
      }
    }

    // Check for Claude Desktop (CLAUDE_DESKTOP_VERSION environment variable)
    if (process.env.CLAUDE_DESKTOP_VERSION) {
      console.error(`[INFO] Detected Claude Desktop (version: ${process.env.CLAUDE_DESKTOP_VERSION})`);
      // Claude Desktop typically uses Sonnet as default
      cachedLLMClient = { client: 'claude-desktop', model: 'claude-sonnet-4' };
      return cachedLLMClient;
    }

    // Check for Claude Code / VSCode (VSCODE_PID or CLINE_VERSION)
    if (process.env.VSCODE_PID || process.env.CLINE_VERSION) {
      const version = process.env.CLINE_VERSION || 'unknown';
      console.error(`[INFO] Detected Claude Code/VSCode (version: ${version})`);
      cachedLLMClient = { client: 'claude-code', model: 'claude-sonnet-4' };
      return cachedLLMClient;
    }

    // Check for other common environment variables
    if (process.env.ANTHROPIC_MODEL) {
      const model = process.env.ANTHROPIC_MODEL;
      if (MODEL_PRICING[model]) {
        console.error(`[INFO] Using ANTHROPIC_MODEL env var: ${model}`);
        cachedLLMClient = { client: 'anthropic-sdk', model };
        return cachedLLMClient;
      }
    }

    if (process.env.OPENAI_MODEL) {
      const model = process.env.OPENAI_MODEL;
      if (MODEL_PRICING[model]) {
        console.error(`[INFO] Using OPENAI_MODEL env var: ${model}`);
        cachedLLMClient = { client: 'openai-sdk', model };
        return cachedLLMClient;
      }
    }

    // Default fallback (conservative choice)
    console.error(`[INFO] No client detected, defaulting to ${DEFAULT_MODEL}`);
    cachedLLMClient = { client: 'unknown', model: DEFAULT_MODEL };
    return cachedLLMClient;
  } catch (error) {
    console.error(`[WARN] LLM detection failed: ${error.message}, using default ${DEFAULT_MODEL}`);
    cachedLLMClient = { client: 'error', model: DEFAULT_MODEL };
    return cachedLLMClient;
  }
}

/**
 * Calculate cost savings based on token reduction and detected model pricing
 * @param {number} tokensSaved - Number of tokens saved by compression
 * @param {string|null} model - Model to use for pricing (null = auto-detect)
 * @returns {Promise<{costSavingsUSD: number, model: string, client: string, modelName: string, pricePerMTok: number}>}
 */
async function calculateCostSavings(tokensSaved, model = null) {
  try {
    // Validate input
    if (typeof tokensSaved !== 'number' || isNaN(tokensSaved) || tokensSaved < 0) {
      throw new Error(`Invalid tokensSaved: ${tokensSaved} (must be non-negative number)`);
    }

    // Cap at reasonable maximum to prevent precision issues
    if (tokensSaved > 1_000_000_000) {
      console.error(`[WARN] Token count capped at 1 billion (was: ${tokensSaved})`);
      tokensSaved = 1_000_000_000;
    }

    // Auto-detect model if not provided
    let client = 'unknown';
    if (!model) {
      const detection = await detectLLMClient();
      model = detection.model;
      client = detection.client;
    }

    // Get pricing for detected/specified model (with fallback)
    const pricing = MODEL_PRICING[model] || MODEL_PRICING[DEFAULT_MODEL];
    if (!MODEL_PRICING[model]) {
      console.error(`[WARN] Unknown model '${model}', using default ${DEFAULT_MODEL}`);
    }
    const pricePerMTok = pricing.pricePerMTok;

    // Calculate cost savings: (tokens saved / 1 million) * price per million tokens
    const costSavingsUSD = (tokensSaved / 1_000_000) * pricePerMTok;

    // Round to 2 decimal places (cents)
    const costSavingsRounded = Math.round(costSavingsUSD * 100) / 100;

    return {
      costSavingsUSD: costSavingsRounded,
      model: model,
      client: client,
      modelName: pricing.name,
      pricePerMTok: pricePerMTok
    };
  } catch (error) {
    console.error(`[ERROR] Cost calculation failed: ${error.message}`);
    // Return zero cost on error
    return {
      costSavingsUSD: 0,
      model: DEFAULT_MODEL,
      client: 'unknown',
      modelName: MODEL_PRICING[DEFAULT_MODEL].name,
      pricePerMTok: MODEL_PRICING[DEFAULT_MODEL].pricePerMTok
    };
  }
}

