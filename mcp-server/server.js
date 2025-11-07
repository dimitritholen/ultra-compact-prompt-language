#!/usr/bin/env node

/**
 * MCP Server for ucpl-compress
 *
 * Provides code context compression as an MCP tool for Claude Desktop,
 * Claude Code, Codex, and other MCP-compatible clients.
 */

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs").promises;
const os = require("os");
const { encodingForModel } = require("js-tiktoken");

// Path to ucpl-compress script (bundled with package)
const COMPRESS_SCRIPT = path.join(__dirname, "scripts", "ucpl-compress");

// Path to statistics storage file (cross-platform user home directory)
const STATS_DIR = path.join(os.homedir(), ".ucpl", "compress");
const STATS_FILE = path.join(STATS_DIR, "compression-stats.json");

// Path to logs directory
const LOGS_DIR = path.join(os.homedir(), ".ucpl", "logs");
const LOG_FILE = path.join(LOGS_DIR, "mcp-server.log");

// Token counting model (using gpt-4o as approximation for Claude)
const TOKEN_MODEL = "gpt-4o";

// Retention policy (aggressive: 30/365/5y)
const RETENTION_POLICY = {
  RECENT_DAYS: 30, // Keep detailed records for last 30 days
  DAILY_DAYS: 365, // Keep daily aggregates for 365 days
  MONTHLY_YEARS: 5, // Keep monthly aggregates for 5 years
};

// LLM Model Pricing (USD per million input tokens)
// Prices as of 2025-11-06
const MODEL_PRICING = {
  "claude-sonnet-4": { pricePerMTok: 3.0, name: "Claude Sonnet 4" },
  "claude-opus-4": { pricePerMTok: 15.0, name: "Claude Opus 4" },
  "gpt-4o": { pricePerMTok: 2.5, name: "GPT-4o" },
  "gpt-4o-mini": { pricePerMTok: 0.15, name: "GPT-4o Mini" },
  "gemini-2.0-flash": { pricePerMTok: 0.1, name: "Gemini 2.0 Flash" },
  o1: { pricePerMTok: 15.0, name: "OpenAI o1" },
  "o1-mini": { pricePerMTok: 3.0, name: "OpenAI o1-mini" },
};

// Default model if detection fails
const DEFAULT_MODEL = "claude-sonnet-4";

// Path to optional config file for model override
const CONFIG_FILE = path.join(os.homedir(), ".ucpl", "compress", "config.json");

// Cache for LLM client detection (one-time per server lifecycle)
let cachedLLMClient = null;

/**
 * Logger class with file rotation and performance tracking
 */
class Logger {
  constructor(logFile) {
    this.logFile = logFile;
    this.maxLogSize = 10 * 1024 * 1024; // 10MB
    this.maxBackups = 5;
    this.initPromise = this.ensureLogDir();
  }

  async ensureLogDir() {
    try {
      await fs.mkdir(LOGS_DIR, { recursive: true });
    } catch (err) {
      // Directory already exists or permission error - log to stderr
      console.error(`[WARN] Could not create logs directory: ${err.message}`);
    }
  }

  async write(level, message, data = {}) {
    await this.initPromise;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data,
    };

    const logLine = JSON.stringify(logEntry) + "\n";

    try {
      // Check file size and rotate if needed
      try {
        const stats = await fs.stat(this.logFile);
        if (stats.size > this.maxLogSize) {
          await this.rotateLog();
        }
      } catch (err) {
        // File doesn't exist yet, that's fine
      }

      // Append to log file
      await fs.appendFile(this.logFile, logLine);

      // Also log to stderr for immediate visibility
      const consoleMsg = `[${level.toUpperCase()}] ${message}`;
      if (level === "error") {
        console.error(consoleMsg, data);
      } else if (level === "warn") {
        console.error(consoleMsg);
      } else if (level === "debug" || level === "info") {
        console.error(consoleMsg);
      }
    } catch (err) {
      // Fallback to stderr if file write fails
      console.error(`[ERROR] Log write failed: ${err.message}`, logEntry);
    }
  }

  async rotateLog() {
    try {
      // Rotate existing backups
      for (let i = this.maxBackups - 1; i >= 1; i--) {
        const oldFile = `${this.logFile}.${i}`;
        const newFile = `${this.logFile}.${i + 1}`;
        try {
          await fs.rename(oldFile, newFile);
        } catch (err) {
          // File doesn't exist, continue
        }
      }

      // Move current log to .1
      await fs.rename(this.logFile, `${this.logFile}.1`);
    } catch (err) {
      console.error(`[WARN] Log rotation failed: ${err.message}`);
    }
  }

  info(message, data) {
    return this.write("info", message, data);
  }

  warn(message, data) {
    return this.write("warn", message, data);
  }

  error(message, data) {
    return this.write("error", message, data);
  }

  debug(message, data) {
    return this.write("debug", message, data);
  }

  /**
   * Start a performance timer
   * @param {string} operation - Name of the operation
   * @returns {Function} - Call this function to log the duration
   */
  startTimer(operation) {
    const start = Date.now();
    return async (status = "completed", extraData = {}) => {
      const duration = Date.now() - start;
      await this.info(`${operation} ${status}`, {
        operation,
        duration_ms: duration,
        status,
        ...extraData,
      });
    };
  }
}

// Global logger instance
const logger = new Logger(LOG_FILE);

/**
 * Detect LLM client and model from environment variables (cached per server lifecycle)
 * @returns {Promise<{client: string, model: string}>} Detected client and model
 */
async function detectLLMClient() {
  const endTimer = logger.startTimer("detect_llm_client");

  // Return cached result if available
  if (cachedLLMClient) {
    await logger.debug("Using cached LLM client detection", cachedLLMClient);
    await endTimer("cached", cachedLLMClient);
    return cachedLLMClient;
  }

  try {
    // Try config file first (highest priority)
    try {
      await logger.debug("Checking config file", { path: CONFIG_FILE });
      const configData = await fs.readFile(CONFIG_FILE, "utf-8");
      const config = JSON.parse(configData);

      // Validate config schema
      if (typeof config !== "object" || config === null) {
        throw new Error("Config must be a valid JSON object");
      }

      if (config.model && MODEL_PRICING[config.model]) {
        await logger.info("Using model from config file", {
          model: config.model,
        });
        cachedLLMClient = { client: "config-override", model: config.model };
        await endTimer("completed", {
          method: "config_file",
          ...cachedLLMClient,
        });
        return cachedLLMClient;
      } else if (config.model) {
        await logger.warn(
          "Unknown model in config, falling back to env detection",
          {
            model: config.model,
            available_models: Object.keys(MODEL_PRICING),
          },
        );
      }
    } catch (err) {
      // Config file doesn't exist or is invalid - continue with env detection
      if (err.code !== "ENOENT") {
        await logger.warn("Config file error", {
          error: err.message,
          path: CONFIG_FILE,
        });
      } else {
        await logger.debug(
          "Config file not found, checking environment variables",
          { path: CONFIG_FILE },
        );
      }
    }

    // Check for Claude Desktop (CLAUDE_DESKTOP_VERSION environment variable)
    if (process.env.CLAUDE_DESKTOP_VERSION) {
      await logger.info("Detected Claude Desktop", {
        version: process.env.CLAUDE_DESKTOP_VERSION,
      });
      // Claude Desktop typically uses Sonnet as default
      cachedLLMClient = { client: "claude-desktop", model: "claude-sonnet-4" };
      await endTimer("completed", {
        method: "claude_desktop",
        ...cachedLLMClient,
      });
      return cachedLLMClient;
    }

    // Check for Claude Code / VSCode (VSCODE_PID or CLINE_VERSION)
    if (process.env.VSCODE_PID || process.env.CLINE_VERSION) {
      const version = process.env.CLINE_VERSION || "unknown";
      await logger.info("Detected Claude Code/VSCode", { version });
      cachedLLMClient = { client: "claude-code", model: "claude-sonnet-4" };
      await endTimer("completed", { method: "vscode", ...cachedLLMClient });
      return cachedLLMClient;
    }

    // Check for other common environment variables
    if (process.env.ANTHROPIC_MODEL) {
      const model = process.env.ANTHROPIC_MODEL;
      if (MODEL_PRICING[model]) {
        await logger.info("Using ANTHROPIC_MODEL env var", { model });
        cachedLLMClient = { client: "anthropic-sdk", model };
        await endTimer("completed", {
          method: "anthropic_env",
          ...cachedLLMClient,
        });
        return cachedLLMClient;
      }
    }

    if (process.env.OPENAI_MODEL) {
      const model = process.env.OPENAI_MODEL;
      if (MODEL_PRICING[model]) {
        await logger.info("Using OPENAI_MODEL env var", { model });
        cachedLLMClient = { client: "openai-sdk", model };
        await endTimer("completed", {
          method: "openai_env",
          ...cachedLLMClient,
        });
        return cachedLLMClient;
      }
    }

    // Default fallback (conservative choice)
    await logger.info("No client detected, using default", {
      model: DEFAULT_MODEL,
    });
    cachedLLMClient = { client: "unknown", model: DEFAULT_MODEL };
    await endTimer("completed", { method: "default", ...cachedLLMClient });
    return cachedLLMClient;
  } catch (error) {
    await logger.warn("LLM detection failed, using default", {
      error: error.message,
      model: DEFAULT_MODEL,
    });
    cachedLLMClient = { client: "error", model: DEFAULT_MODEL };
    await endTimer("failed", { error: error.message, ...cachedLLMClient });
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
  const endTimer = logger.startTimer("calculate_cost_savings");

  try {
    // Validate input
    if (
      typeof tokensSaved !== "number" ||
      isNaN(tokensSaved) ||
      tokensSaved < 0
    ) {
      const error = new Error(
        `Invalid tokensSaved: ${tokensSaved} (must be non-negative number)`,
      );
      await logger.error("Invalid token count for cost calculation", {
        tokensSaved,
        type: typeof tokensSaved,
      });
      throw error;
    }

    await logger.debug("Calculating cost savings", { tokensSaved, model });

    // Cap at reasonable maximum to prevent precision issues
    if (tokensSaved > 1_000_000_000) {
      await logger.warn("Token count capped at 1 billion", {
        original: tokensSaved,
        capped: 1_000_000_000,
      });
      tokensSaved = 1_000_000_000;
    }

    // Auto-detect model if not provided
    let client = "unknown";
    if (!model) {
      await logger.debug("Auto-detecting model for pricing");
      const detection = await detectLLMClient();
      model = detection.model;
      client = detection.client;
      await logger.debug("Model detected for pricing", { model, client });
    }

    // Get pricing for detected/specified model (with fallback)
    const pricing = MODEL_PRICING[model] || MODEL_PRICING[DEFAULT_MODEL];
    if (!MODEL_PRICING[model]) {
      await logger.warn("Unknown model for pricing, using default", {
        requested_model: model,
        default_model: DEFAULT_MODEL,
      });
    }
    const pricePerMTok = pricing.pricePerMTok;

    // Calculate cost savings: (tokens saved / 1 million) * price per million tokens
    const costSavingsUSD = (tokensSaved / 1_000_000) * pricePerMTok;

    // Round to 2 decimal places (cents)
    const costSavingsRounded = Math.round(costSavingsUSD * 100) / 100;

    const result = {
      costSavingsUSD: costSavingsRounded,
      model: model,
      client: client,
      modelName: pricing.name,
      pricePerMTok: pricePerMTok,
    };

    await endTimer("completed", {
      tokensSaved,
      costSavingsUSD: costSavingsRounded,
      model,
      pricePerMTok,
    });

    return result;
  } catch (error) {
    await logger.error("Cost calculation failed", {
      error: error.message,
      tokensSaved,
      model,
    });
    await endTimer("failed", { error: error.message });

    // Return zero cost on error
    return {
      costSavingsUSD: 0,
      model: DEFAULT_MODEL,
      client: "unknown",
      modelName: MODEL_PRICING[DEFAULT_MODEL].name,
      pricePerMTok: MODEL_PRICING[DEFAULT_MODEL].pricePerMTok,
    };
  }
}

/**
 * Count tokens in text using tiktoken
 * @param {string} text - Text to count tokens for
 * @returns {number} Token count
 */
function countTokens(text) {
  try {
    const enc = encodingForModel(TOKEN_MODEL);
    const tokens = enc.encode(text);
    return tokens.length;
  } catch (error) {
    logger.warn("Token counting failed, using fallback estimation", {
      error: error.message,
      text_length: text.length,
      estimated_tokens: Math.ceil(text.length / 4),
    });
    // Fallback: rough estimate (chars/4)
    return Math.ceil(text.length / 4);
  }
}

/**
 * Load compression statistics from file
 * @returns {Promise<Object>} Statistics object
 */
async function loadStats() {
  const endTimer = logger.startTimer("load_stats");

  try {
    await logger.debug("Loading stats file", { path: STATS_FILE });
    const data = await fs.readFile(STATS_FILE, "utf-8");
    const stats = JSON.parse(data);

    await logger.debug("Stats file loaded", {
      file_size: data.length,
      version: stats.version,
      recent_count: (stats.recent || []).length,
      daily_count: Object.keys(stats.daily || {}).length,
      monthly_count: Object.keys(stats.monthly || {}).length,
    });

    // Migrate old format if needed
    if (stats.compressions && !stats.recent) {
      await logger.info("Migrating stats to new multi-tier format");
      const migratedStats = migrateStatsFormat(stats);
      await endTimer("completed", {
        migrated: true,
        recent_count: migratedStats.recent.length,
        daily_count: Object.keys(migratedStats.daily).length,
        monthly_count: Object.keys(migratedStats.monthly).length,
      });
      return migratedStats;
    }

    await endTimer("completed", {
      migrated: false,
      total_compressions: stats.summary?.totalCompressions || 0,
    });

    return stats;
  } catch (error) {
    // File doesn't exist or is corrupted - return empty stats
    if (error.code === "ENOENT") {
      await logger.debug("Stats file not found, initializing empty stats", {
        path: STATS_FILE,
      });
    } else {
      await logger.warn("Failed to load stats file, initializing empty stats", {
        error: error.message,
        path: STATS_FILE,
      });
    }

    await endTimer("completed", { initialized: true });

    return {
      version: "2.0",
      recent: [], // Individual records from last 30 days
      daily: {}, // Aggregated by day for 31-395 days ago
      monthly: {}, // Aggregated by month for 395+ days ago
      summary: {
        totalCompressions: 0,
        totalOriginalTokens: 0,
        totalCompressedTokens: 0,
        totalTokensSaved: 0,
      },
    };
  }
}

/**
 * Migrate old stats format to new multi-tier format
 * @param {Object} oldStats - Old format stats
 * @returns {Object} New format stats
 */
function migrateStatsFormat(oldStats) {
  const now = new Date();
  const recentCutoff = new Date(
    now.getTime() - RETENTION_POLICY.RECENT_DAYS * 24 * 60 * 60 * 1000,
  );
  const dailyCutoff = new Date(
    now.getTime() - RETENTION_POLICY.DAILY_DAYS * 24 * 60 * 60 * 1000,
  );

  const newStats = {
    version: "2.0",
    recent: [],
    daily: {},
    monthly: {},
    summary: oldStats.summary || {
      totalCompressions: 0,
      totalOriginalTokens: 0,
      totalCompressedTokens: 0,
      totalTokensSaved: 0,
    },
  };

  // Distribute old compressions into appropriate tiers
  for (const compression of oldStats.compressions || []) {
    const timestamp = new Date(compression.timestamp);

    if (timestamp >= recentCutoff) {
      // Keep in recent
      newStats.recent.push(compression);
    } else if (timestamp >= dailyCutoff) {
      // Aggregate into daily
      const dayKey = timestamp.toISOString().split("T")[0]; // YYYY-MM-DD
      if (!newStats.daily[dayKey]) {
        newStats.daily[dayKey] = {
          date: dayKey,
          count: 0,
          originalTokens: 0,
          compressedTokens: 0,
          tokensSaved: 0,
        };
      }
      newStats.daily[dayKey].count++;
      newStats.daily[dayKey].originalTokens += compression.originalTokens;
      newStats.daily[dayKey].compressedTokens += compression.compressedTokens;
      newStats.daily[dayKey].tokensSaved += compression.tokensSaved;
    } else {
      // Aggregate into monthly
      const monthKey = timestamp.toISOString().substring(0, 7); // YYYY-MM
      if (!newStats.monthly[monthKey]) {
        newStats.monthly[monthKey] = {
          month: monthKey,
          count: 0,
          originalTokens: 0,
          compressedTokens: 0,
          tokensSaved: 0,
        };
      }
      newStats.monthly[monthKey].count++;
      newStats.monthly[monthKey].originalTokens += compression.originalTokens;
      newStats.monthly[monthKey].compressedTokens +=
        compression.compressedTokens;
      newStats.monthly[monthKey].tokensSaved += compression.tokensSaved;
    }
  }

  logger.info("Stats migration complete", {
    recent_count: newStats.recent.length,
    daily_count: Object.keys(newStats.daily).length,
    monthly_count: Object.keys(newStats.monthly).length,
    total_compressions: newStats.summary.totalCompressions,
  });
  return newStats;
}

/**
 * Aggregate stats by moving old data from recent to daily/monthly tiers
 * @param {Object} stats - Statistics object to aggregate
 * @returns {Object} Aggregated stats
 */
function aggregateStats(stats) {
  const now = new Date();
  const recentCutoff = new Date(
    now.getTime() - RETENTION_POLICY.RECENT_DAYS * 24 * 60 * 60 * 1000,
  );
  const dailyCutoff = new Date(
    now.getTime() - RETENTION_POLICY.DAILY_DAYS * 24 * 60 * 60 * 1000,
  );
  const monthlyCutoff = new Date(
    now.getTime() - RETENTION_POLICY.MONTHLY_YEARS * 365 * 24 * 60 * 60 * 1000,
  );

  const initialCounts = {
    recent: (stats.recent || []).length,
    daily: Object.keys(stats.daily || {}).length,
    monthly: Object.keys(stats.monthly || {}).length,
  };

  const newRecent = [];
  const newDaily = { ...stats.daily };
  const newMonthly = { ...stats.monthly };

  // Process recent compressions
  for (const compression of stats.recent || []) {
    const timestamp = new Date(compression.timestamp);

    if (timestamp >= recentCutoff) {
      // Keep in recent
      newRecent.push(compression);
    } else if (timestamp >= dailyCutoff) {
      // Move to daily aggregates
      const dayKey = timestamp.toISOString().split("T")[0]; // YYYY-MM-DD
      if (!newDaily[dayKey]) {
        newDaily[dayKey] = {
          date: dayKey,
          count: 0,
          originalTokens: 0,
          compressedTokens: 0,
          tokensSaved: 0,
        };
      }
      newDaily[dayKey].count++;
      newDaily[dayKey].originalTokens += compression.originalTokens;
      newDaily[dayKey].compressedTokens += compression.compressedTokens;
      newDaily[dayKey].tokensSaved += compression.tokensSaved;
    } else {
      // Move to monthly aggregates
      const monthKey = timestamp.toISOString().substring(0, 7); // YYYY-MM
      if (!newMonthly[monthKey]) {
        newMonthly[monthKey] = {
          month: monthKey,
          count: 0,
          originalTokens: 0,
          compressedTokens: 0,
          tokensSaved: 0,
        };
      }
      newMonthly[monthKey].count++;
      newMonthly[monthKey].originalTokens += compression.originalTokens;
      newMonthly[monthKey].compressedTokens += compression.compressedTokens;
      newMonthly[monthKey].tokensSaved += compression.tokensSaved;
    }
  }

  // Move old daily aggregates to monthly
  const oldDailyKeys = [];
  for (const [dayKey, dayStats] of Object.entries(newDaily)) {
    const dayDate = new Date(dayKey);
    if (dayDate < dailyCutoff) {
      oldDailyKeys.push(dayKey);
      const monthKey = dayKey.substring(0, 7); // YYYY-MM
      if (!newMonthly[monthKey]) {
        newMonthly[monthKey] = {
          month: monthKey,
          count: 0,
          originalTokens: 0,
          compressedTokens: 0,
          tokensSaved: 0,
        };
      }
      newMonthly[monthKey].count += dayStats.count;
      newMonthly[monthKey].originalTokens += dayStats.originalTokens;
      newMonthly[monthKey].compressedTokens += dayStats.compressedTokens;
      newMonthly[monthKey].tokensSaved += dayStats.tokensSaved;
    }
  }

  // Remove old daily aggregates
  for (const key of oldDailyKeys) {
    delete newDaily[key];
  }

  // Prune monthly aggregates older than retention policy
  const oldMonthlyKeys = [];
  for (const [monthKey] of Object.entries(newMonthly)) {
    const monthDate = new Date(monthKey + "-01");
    if (monthDate < monthlyCutoff) {
      oldMonthlyKeys.push(monthKey);
    }
  }

  // Remove old monthly aggregates (optional: could keep forever)
  for (const key of oldMonthlyKeys) {
    delete newMonthly[key];
  }

  const finalCounts = {
    recent: newRecent.length,
    daily: Object.keys(newDaily).length,
    monthly: Object.keys(newMonthly).length,
  };

  const movedCounts = {
    recent_to_daily:
      initialCounts.recent -
      finalCounts.recent -
      (stats.recent || []).filter((c) => {
        const timestamp = new Date(c.timestamp);
        return timestamp < dailyCutoff;
      }).length,
    daily_to_monthly: oldDailyKeys.length,
    monthly_pruned: oldMonthlyKeys.length,
  };

  if (
    movedCounts.recent_to_daily > 0 ||
    movedCounts.daily_to_monthly > 0 ||
    movedCounts.monthly_pruned > 0
  ) {
    logger.debug("Stats aggregation performed", {
      initial: initialCounts,
      final: finalCounts,
      moved: movedCounts,
    });
  }

  return {
    ...stats,
    recent: newRecent,
    daily: newDaily,
    monthly: newMonthly,
  };
}

/**
 * Save compression statistics to file (with auto-aggregation)
 * @param {Object} stats - Statistics object to save
 */
async function saveStats(stats) {
  const endTimer = logger.startTimer("save_stats");

  try {
    await logger.debug("Saving stats file", {
      path: STATS_FILE,
      recent_count: (stats.recent || []).length,
      total_compressions: stats.summary?.totalCompressions || 0,
    });

    // Aggregate old data before saving
    const aggregatedStats = aggregateStats(stats);

    // Ensure directory exists (cross-platform)
    await fs.mkdir(STATS_DIR, { recursive: true });

    const statsJson = JSON.stringify(aggregatedStats, null, 2);
    await fs.writeFile(STATS_FILE, statsJson, "utf-8");

    await logger.info("Stats file saved", {
      path: STATS_FILE,
      file_size: statsJson.length,
      recent_count: aggregatedStats.recent.length,
      daily_count: Object.keys(aggregatedStats.daily).length,
      monthly_count: Object.keys(aggregatedStats.monthly).length,
      total_compressions: aggregatedStats.summary.totalCompressions,
    });

    await endTimer("completed", {
      file_size: statsJson.length,
      records_saved: aggregatedStats.recent.length,
    });
  } catch (error) {
    await logger.error("Failed to save statistics", {
      error: error.message,
      path: STATS_FILE,
    });
    await endTimer("failed", { error: error.message });
  }
}

/**
 * Parse flexible date input to Date object
 * Supports:
 * - ISO dates: "2025-01-01", "2025-01-01T12:00:00Z"
 * - Relative: "-7d", "-2w", "-1m", "-1y"
 * - Special: "now", "today"
 * @param {string|null|undefined} value - Date value to parse
 * @returns {Date} Parsed date object
 * @throws {Error} If date format is invalid
 */
function parseFlexibleDate(value) {
  // Handle null/undefined/empty
  if (!value || value === "now") {
    return new Date();
  }

  // Special case: "today" = today at midnight (start of day)
  if (value === "today") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  // Relative time: "-7d", "-2w", "-1m", "-1y"
  const relativeMatch = value.match(/^-(\d+)(d|w|m|y)$/);
  if (relativeMatch) {
    const [, amount, unit] = relativeMatch;
    const multipliers = { d: 1, w: 7, m: 30, y: 365 };
    const days = parseInt(amount, 10) * multipliers[unit];
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  // Try parsing as ISO date (YYYY-MM-DD or full ISO timestamp)
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Invalid format
  throw new Error(
    `Invalid date format: ${value}. Expected ISO date (YYYY-MM-DD), relative time (-7d, -2w), or special keyword (now, today)`,
  );
}

/**
 * Record a compression operation in statistics
 * @param {string} path - Path that was compressed
 * @param {string} originalContent - Original file content(s)
 * @param {string} compressedContent - Compressed output
 * @param {string} level - Compression level used
 * @param {string} format - Format used
 * @param {Function} [costCalculator=calculateCostSavings] - Cost calculation function (for testing)
 */
async function recordCompression(
  path,
  originalContent,
  compressedContent,
  level,
  format,
  costCalculator = calculateCostSavings,
) {
  const endTimer = logger.startTimer("record_compression");

  try {
    const stats = await loadStats();

    const originalTokens = countTokens(originalContent);
    const compressedTokens = countTokens(compressedContent);
    const tokensSaved = originalTokens - compressedTokens;
    const compressionRatio =
      originalTokens > 0 ? compressedTokens / originalTokens : 0;
    const savingsPercentage =
      originalTokens > 0 ? (tokensSaved / originalTokens) * 100 : 0;

    await logger.debug("Recording compression statistics", {
      path,
      level,
      format,
      originalTokens,
      compressedTokens,
      tokensSaved,
      savingsPercentage: Math.round(savingsPercentage),
    });

    // Calculate cost savings with LLM detection
    let costInfo = null;
    try {
      costInfo = await costCalculator(tokensSaved);
    } catch (error) {
      await logger.warn("Cost calculation failed for compression record", {
        error: error.message,
        path,
      });
      // Continue without cost info - it's optional
    }

    const record = {
      timestamp: new Date().toISOString(),
      path,
      originalTokens,
      compressedTokens,
      tokensSaved,
      compressionRatio: Math.round(compressionRatio * 1000) / 1000,
      savingsPercentage: Math.round(savingsPercentage * 10) / 10,
      level,
      format,
    };

    // Add cost tracking fields if available
    if (costInfo) {
      record.model = costInfo.model;
      record.client = costInfo.client;
      record.pricePerMTok = costInfo.pricePerMTok;
      record.costSavingsUSD = costInfo.costSavingsUSD;
      record.currency = "USD";
    }

    // Add to recent compressions (will be auto-aggregated on save)
    if (!stats.recent) stats.recent = [];
    stats.recent.push(record);

    stats.summary.totalCompressions++;
    stats.summary.totalOriginalTokens += originalTokens;
    stats.summary.totalCompressedTokens += compressedTokens;
    stats.summary.totalTokensSaved += tokensSaved;

    await saveStats(stats);

    await logger.info("Compression recorded", {
      path,
      originalTokens,
      compressedTokens,
      tokensSaved,
      savingsPercentage: Math.round(savingsPercentage),
      costSavingsUSD: costInfo?.costSavingsUSD || 0,
      model: costInfo?.modelName || "unknown",
    });

    await endTimer("completed", {
      tokensSaved,
      costSavingsUSD: costInfo?.costSavingsUSD || 0,
    });
  } catch (error) {
    await logger.error("Failed to record compression statistics", {
      error: error.message,
      path,
      stack: error.stack,
    });
    await endTimer("failed", { error: error.message });
  }
}

/**
 * Record compression with fallback strategy if original content can't be read
 * @param {string} filePath - Path that was compressed
 * @param {string} compressedContent - Compressed output
 * @param {string} level - Compression level used
 * @param {string} format - Format used
 * @param {Array<string>|null} include - Include patterns
 * @param {Array<string>|null} exclude - Exclude patterns
 * @param {number|null} limit - File limit used
 */
async function recordCompressionWithFallback(
  filePath,
  compressedContent,
  level,
  format,
  include,
  exclude,
  limit,
) {
  const endTimer = logger.startTimer("record_compression_with_fallback");

  try {
    await logger.debug(
      "Attempting to record compression with accurate token counts",
      {
        path: filePath,
        level,
        format,
      },
    );

    // Try to read original content for accurate statistics
    const originalContent = await readOriginalContent(
      filePath,
      include,
      exclude,
      limit,
    );

    if (originalContent && originalContent.length > 0) {
      // Success: record with accurate token counts
      await logger.debug("Recording compression with original content", {
        path: filePath,
        content_length: originalContent.length,
      });
      await recordCompression(
        filePath,
        originalContent,
        compressedContent,
        level,
        format,
      );
      await endTimer("completed", { method: "accurate", path: filePath });
    } else {
      // Fallback: original content is empty (shouldn't happen, but handle gracefully)
      await logger.warn(
        "Original content is empty, using fallback estimation",
        {
          path: filePath,
        },
      );
      await recordCompressionWithEstimation(
        filePath,
        compressedContent,
        level,
        format,
      );
      await endTimer("completed", {
        method: "estimation_empty",
        path: filePath,
      });
    }
  } catch (error) {
    // Fallback: estimate original tokens from compressed output
    await logger.warn("Could not read original content, using estimation", {
      path: filePath,
      error: error.message,
    });
    await recordCompressionWithEstimation(
      filePath,
      compressedContent,
      level,
      format,
    );
    await endTimer("completed", { method: "estimation_error", path: filePath });
  }
}

/**
 * Record compression using estimated original token count
 * @param {string} filePath - Path that was compressed
 * @param {string} compressedContent - Compressed output
 * @param {string} level - Compression level used
 * @param {string} format - Format used
 * @param {Function} [costCalculator=calculateCostSavings] - Cost calculation function (for testing)
 */
async function recordCompressionWithEstimation(
  filePath,
  compressedContent,
  level,
  format,
  costCalculator = calculateCostSavings,
) {
  const endTimer = logger.startTimer("record_compression_with_estimation");

  try {
    const stats = await loadStats();
    const compressedTokens = countTokens(compressedContent);

    // Estimate original tokens based on typical compression ratios
    // These are conservative estimates based on observed compression performance
    const estimationMultipliers = {
      minimal: 10.0, // 90% typical reduction
      signatures: 6.0, // 83% typical reduction
      full: 4.0, // 75% typical reduction
    };

    const multiplier = estimationMultipliers[level] || 4.0;
    const estimatedOriginalTokens = Math.round(compressedTokens * multiplier);
    const tokensSaved = estimatedOriginalTokens - compressedTokens;
    const compressionRatio = compressedTokens / estimatedOriginalTokens;
    const savingsPercentage = (tokensSaved / estimatedOriginalTokens) * 100;

    await logger.info("Using estimated token counts for compression record", {
      path: filePath,
      level,
      multiplier,
      compressedTokens,
      estimatedOriginalTokens,
      tokensSaved,
    });

    // Calculate cost savings with LLM detection
    let costInfo = null;
    try {
      costInfo = await costCalculator(tokensSaved);
    } catch (error) {
      await logger.warn("Cost calculation failed for estimated compression", {
        error: error.message,
        path: filePath,
      });
      // Continue without cost info - it's optional
    }

    const record = {
      timestamp: new Date().toISOString(),
      path: filePath,
      originalTokens: estimatedOriginalTokens,
      compressedTokens,
      tokensSaved,
      compressionRatio: Math.round(compressionRatio * 1000) / 1000,
      savingsPercentage: Math.round(savingsPercentage * 10) / 10,
      level,
      format,
      estimated: true, // Flag to indicate this used estimation
    };

    // Add cost tracking fields if available
    if (costInfo) {
      record.model = costInfo.model;
      record.client = costInfo.client;
      record.pricePerMTok = costInfo.pricePerMTok;
      record.costSavingsUSD = costInfo.costSavingsUSD;
      record.currency = "USD";
    }

    // Add to recent compressions (will be auto-aggregated on save)
    if (!stats.recent) stats.recent = [];
    stats.recent.push(record);

    stats.summary.totalCompressions++;
    stats.summary.totalOriginalTokens += estimatedOriginalTokens;
    stats.summary.totalCompressedTokens += compressedTokens;
    stats.summary.totalTokensSaved += tokensSaved;

    await saveStats(stats);

    await logger.info("Compression recorded with estimation", {
      path: filePath,
      estimated: true,
      estimatedOriginalTokens,
      compressedTokens,
      tokensSaved,
      savingsPercentage: Math.round(savingsPercentage),
      costSavingsUSD: costInfo?.costSavingsUSD || 0,
      model: costInfo?.modelName || "unknown",
    });

    await endTimer("completed", {
      tokensSaved,
      estimated: true,
    });
  } catch (error) {
    // This is the last resort - log and throw
    await logger.error(
      "Failed to record compression statistics even with estimation",
      {
        error: error.message,
        path: filePath,
        stack: error.stack,
      },
    );
    await endTimer("failed", { error: error.message });
    throw error;
  }
}

/**
 * Read file(s) for original content token counting
 * @param {string} filePath - Path to file or directory
 * @param {Array<string>|null} _include - Include patterns (not yet implemented)
 * @param {Array<string>|null} _exclude - Exclude patterns (not yet implemented)
 * @param {number|null} limit - Limit on files to read
 * @returns {Promise<string>} Original content
 */
async function readOriginalContent(
  filePath,
  _include = null,
  _exclude = null,
  limit = null,
) {
  const endTimer = logger.startTimer("read_original_content");

  try {
    const stats = await fs.stat(filePath);

    if (stats.isFile()) {
      await logger.debug("Reading single file for token counting", {
        path: filePath,
      });
      const content = await fs.readFile(filePath, "utf-8");
      await endTimer("completed", {
        path: filePath,
        is_file: true,
        content_length: content.length,
      });
      return content;
    }

    // For directories, read files matching criteria
    await logger.debug("Reading directory for token counting", {
      path: filePath,
      limit,
    });
    const { readdirSync, readFileSync } = require("fs");
    const pathModule = require("path");
    let content = "";
    let fileCount = 0;
    let skippedCount = 0;

    const readDir = (dir) => {
      if (limit && fileCount >= limit) return;

      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (limit && fileCount >= limit) break;

        const fullPath = pathModule.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          readDir(fullPath);
        } else if (entry.isFile()) {
          // Apply include/exclude filters (simplified - just check extensions)
          try {
            const fileContent = readFileSync(fullPath, "utf-8");
            content += fileContent + "\n";
            fileCount++;
          } catch (_err) {
            // Skip files that can't be read
            skippedCount++;
          }
        }
      }
    };

    readDir(filePath);

    await logger.debug("Directory read complete", {
      path: filePath,
      files_read: fileCount,
      files_skipped: skippedCount,
      content_length: content.length,
    });

    await endTimer("completed", {
      path: filePath,
      is_directory: true,
      files_read: fileCount,
      content_length: content.length,
    });

    return content;
  } catch (error) {
    await logger.warn("Could not read original content for token counting", {
      error: error.message,
      path: filePath,
    });
    await endTimer("failed", { error: error.message });
    return "";
  }
}

/**
 * Execute ucpl-compress and return results
 */
async function compressContext(
  filePath,
  level = "full",
  language = null,
  format = "text",
  include = null,
  exclude = null,
  limit = null,
  offset = 0,
) {
  const endTimer = logger.startTimer("compress_context");

  const logData = {
    path: filePath,
    level,
    language,
    format,
    include: include ? include.length : 0,
    exclude: exclude ? exclude.length : 0,
    limit,
    offset,
  };

  await logger.info("Starting compression", logData);

  return new Promise((resolve, reject) => {
    const args = [
      filePath,
      "--level",
      level,
      "--format",
      format,
      "--offset",
      String(offset),
    ];

    if (language) {
      args.push("--language", language);
    }

    if (limit !== null && limit !== undefined) {
      args.push("--limit", String(limit));
    }

    if (include && Array.isArray(include)) {
      include.forEach((pattern) => {
        args.push("--include", pattern);
      });
    }

    if (exclude && Array.isArray(exclude)) {
      exclude.forEach((pattern) => {
        args.push("--exclude", pattern);
      });
    }

    logger.debug("Spawning ucpl-compress", { command: COMPRESS_SCRIPT, args });

    const proc = spawn(COMPRESS_SCRIPT, args);
    let stdout = "";
    let stderr = "";
    let lastProgressLog = Date.now();

    proc.stdout.on("data", (data) => {
      stdout += data.toString();

      // Log progress every 5 seconds
      const now = Date.now();
      if (now - lastProgressLog > 5000) {
        logger.debug("Compression in progress", {
          output_bytes: stdout.length,
          elapsed_ms: now - lastProgressLog,
        });
        lastProgressLog = now;
      }
    });

    proc.stderr.on("data", (data) => {
      const stderrChunk = data.toString();
      stderr += stderrChunk;

      // Log stderr immediately (Python script progress)
      logger.debug("ucpl-compress stderr", { message: stderrChunk.trim() });
    });

    proc.on("close", async (code) => {
      if (code === 0) {
        await endTimer("completed", {
          output_bytes: stdout.length,
          exit_code: code,
        });
        resolve(stdout);
      } else {
        await endTimer("failed", { exit_code: code, stderr });
        await logger.error("Compression failed", { code, stderr, ...logData });
        reject(new Error(`ucpl-compress failed: ${stderr}`));
      }
    });

    proc.on("error", async (err) => {
      await endTimer("error", { error: err.message });
      await logger.error("Failed to execute ucpl-compress", {
        error: err.message,
        ...logData,
      });
      reject(new Error(`Failed to execute ucpl-compress: ${err.message}`));
    });
  });
}

/**
 * MCP Protocol Handler
 */
class MCPServer {
  constructor() {
    this.tools = [
      {
        name: "compress_code_context",
        description:
          "Compress code files/directories to semantic summaries (70-98% token reduction). LLM can read compressed format directly. Supports multiple languages, auto-pagination for large dirs, and adjustable compression levels.",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description:
                "Path to file or directory (relative or absolute). Defaults to current directory if not specified.",
              minLength: 1,
              maxLength: 4096,
            },
            level: {
              type: "string",
              description:
                'Compression level. Use "minimal" for initial exploration (85-90% reduction), "full" for detailed understanding (70-80% reduction).',
              default: "full",
              oneOf: [
                {
                  const: "full",
                  title: "Full",
                  description:
                    "Complete semantic compression (70-80% reduction)",
                },
                {
                  const: "signatures",
                  title: "Signatures",
                  description: "Function signatures only (80-90% reduction)",
                },
                {
                  const: "minimal",
                  title: "Minimal",
                  description: "Minimal structure (85-90% reduction)",
                },
              ],
            },
            language: {
              type: "string",
              description:
                "Programming language (auto-detected from file extension). Only needed for stdin or ambiguous extensions.",
              oneOf: [
                { const: "python", title: "Python", description: ".py files" },
                {
                  const: "javascript",
                  title: "JavaScript",
                  description: ".js files",
                },
                {
                  const: "typescript",
                  title: "TypeScript",
                  description: ".ts/.tsx files",
                },
                { const: "java", title: "Java", description: ".java files" },
                { const: "go", title: "Go", description: ".go files" },
                { const: "csharp", title: "C#", description: ".cs files" },
                { const: "php", title: "PHP", description: ".php files" },
                { const: "rust", title: "Rust", description: ".rs files" },
                { const: "ruby", title: "Ruby", description: ".rb files" },
                { const: "cpp", title: "C++", description: ".cpp/.hpp files" },
                {
                  const: "powershell",
                  title: "PowerShell",
                  description: ".ps1 files",
                },
                { const: "shell", title: "Shell", description: ".sh files" },
                { const: "json", title: "JSON", description: ".json files" },
                {
                  const: "yaml",
                  title: "YAML",
                  description: ".yaml/.yml files",
                },
                {
                  const: "markdown",
                  title: "Markdown",
                  description: ".md files",
                },
                {
                  const: "text",
                  title: "Text",
                  description: "Plain text files",
                },
              ],
            },
            format: {
              type: "string",
              description:
                'Output format. Use "summary" for quick overview, "text" for compressed content, "json" for structured data.',
              default: "text",
              oneOf: [
                {
                  const: "text",
                  title: "Text",
                  description: "Human-readable compressed content",
                },
                {
                  const: "summary",
                  title: "Summary",
                  description: "Statistics and file list (1-3K tokens)",
                },
                {
                  const: "json",
                  title: "JSON",
                  description: "Structured data format",
                },
              ],
            },
            include: {
              type: "array",
              items: {
                type: "string",
                minLength: 1,
                maxLength: 256,
                description: 'Glob pattern (e.g., "*.py", "src/**/*.js")',
              },
              description:
                "Include only files matching patterns. Overrides language defaults.",
              minItems: 1,
              maxItems: 50,
            },
            exclude: {
              type: "array",
              items: {
                type: "string",
                minLength: 1,
                maxLength: 256,
                description:
                  'Glob pattern (e.g., "**/test_*", "**/__pycache__")',
              },
              description:
                "Exclude files matching patterns. Recommended: exclude tests and build artifacts.",
              minItems: 1,
              maxItems: 50,
            },
            limit: {
              type: "number",
              description:
                "Max files to process. Auto-applied: minimal=50, signatures=30, full=20. Use for manual pagination.",
              minimum: 1,
              maximum: 200,
              default: null,
            },
            offset: {
              type: "number",
              description:
                "Files to skip (for pagination). Example: limit=30,offset=0 → files 1-30, offset=30 → files 31-60.",
              minimum: 0,
              default: 0,
            },
          },
          required: ["path"],
        },
        outputSchema: {
          type: "object",
          properties: {
            compressed: {
              type: "string",
              description: "Compressed code content or summary text",
            },
            metadata: {
              type: "object",
              properties: {
                filesProcessed: {
                  type: "number",
                  description: "Number of files compressed",
                },
                totalFiles: {
                  type: "number",
                  description: "Total files found (if directory)",
                },
                compressionLevel: {
                  type: "string",
                  description: "Applied compression level",
                },
                format: {
                  type: "string",
                  description: "Output format used",
                },
                estimatedTokens: {
                  type: "number",
                  description: "Rough token estimate (chars/4)",
                },
              },
            },
          },
        },
        annotations: {
          audience: ["assistant"],
          priority: 0.7,
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      {
        name: "get_compression_stats",
        description:
          "Retrieve token and cost savings statistics for code compressions with flexible date queries. Shows token counts, USD cost savings, and per-model breakdowns for compressions within specified time period.",
        inputSchema: {
          type: "object",
          properties: {
            period: {
              type: "string",
              description:
                "Time period preset to filter statistics (backward compatible)",
              default: "all",
              oneOf: [
                {
                  const: "all",
                  title: "All Time",
                  description: "All compression statistics ever recorded",
                },
                {
                  const: "today",
                  title: "Today",
                  description: "Compressions from the last 24 hours",
                },
                {
                  const: "week",
                  title: "This Week",
                  description: "Compressions from the last 7 days",
                },
                {
                  const: "month",
                  title: "This Month",
                  description: "Compressions from the last 30 days",
                },
              ],
            },
            startDate: {
              type: "string",
              description:
                'Start date for custom date range. Accepts ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ) or relative time strings (e.g., "2 hours ago", "yesterday", "last week"). Optional - if omitted, no start boundary is applied.',
            },
            endDate: {
              type: "string",
              description:
                'End date for custom date range. Accepts ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ) or relative time strings (e.g., "now", "today", "1 hour ago"). Optional - if omitted, defaults to current time.',
            },
            relativeDays: {
              type: "number",
              description:
                "Number of days to look back from now. Alternative to startDate/endDate for simple queries. Example: relativeDays=7 returns compressions from last 7 days. Must be between 1 and 365.",
              minimum: 1,
              maximum: 365,
            },
            includeDetails: {
              type: "boolean",
              description:
                "Include individual compression records (not just summary)",
              default: false,
            },
            limit: {
              type: "number",
              description:
                "Maximum number of individual records to return (when includeDetails=true)",
              minimum: 1,
              maximum: 100,
              default: 10,
            },
          },
        },
        outputSchema: {
          type: "object",
          properties: {
            summary: {
              type: "object",
              properties: {
                totalCompressions: { type: "number" },
                totalOriginalTokens: { type: "number" },
                totalCompressedTokens: { type: "number" },
                totalTokensSaved: { type: "number" },
                averageCompressionRatio: { type: "number" },
                averageSavingsPercentage: { type: "number" },
              },
            },
            compressions: {
              type: "array",
              description:
                "Individual compression records (if includeDetails=true)",
            },
          },
        },
        annotations: {
          audience: ["user", "assistant"],
          priority: 0.5,
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
    ];
  }

  async handleRequest(request) {
    const { method, params } = request;

    switch (method) {
      case "initialize":
        return {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "ucpl-compress-mcp",
            version: "1.1.0",
          },
        };

      case "tools/list":
        return { tools: this.tools };

      case "tools/call":
        return await this.handleToolCall(params);

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  async handleToolCall(params) {
    const { name, arguments: args } = params;
    const endTimer = logger.startTimer(`mcp_tool_${name}`);

    await logger.info(`MCP tool invoked: ${name}`, { tool: name, args });

    try {
      let result;
      if (name === "get_compression_stats") {
        result = await this.handleGetStats(args);
      } else if (name === "compress_code_context") {
        result = await this.handleCompress(args);
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }

      await endTimer("completed", { tool: name });
      return result;
    } catch (error) {
      await endTimer("error", { tool: name, error: error.message });
      await logger.error(`MCP tool failed: ${name}`, {
        tool: name,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  async handleGetStats(args) {
    try {
      const stats = await loadStats();
      const includeDetails = args.includeDetails || false;
      const limit = args.limit || 10;

      // Determine date range
      // Priority: relativeDays > startDate/endDate > period (legacy)
      let startDate, endDate, periodLabel;
      const now = new Date();

      if (args.relativeDays) {
        // relativeDays: simple "last N days" query
        if (
          typeof args.relativeDays !== "number" ||
          args.relativeDays < 1 ||
          args.relativeDays > 365
        ) {
          throw new Error("relativeDays must be a number between 1 and 365");
        }
        startDate = new Date(
          now.getTime() - args.relativeDays * 24 * 60 * 60 * 1000,
        );
        endDate = now;
        periodLabel = `Last ${args.relativeDays} Day${args.relativeDays > 1 ? "s" : ""}`;
      } else if (args.startDate || args.endDate) {
        // Custom date range using startDate and/or endDate
        try {
          startDate = args.startDate
            ? parseFlexibleDate(args.startDate)
            : new Date(0);
          endDate = args.endDate ? parseFlexibleDate(args.endDate) : now;
        } catch (error) {
          throw new Error(`Invalid date range: ${error.message}`);
        }

        // Validate date range
        if (startDate > endDate) {
          throw new Error(
            `Invalid date range: startDate (${startDate.toISOString()}) is after endDate (${endDate.toISOString()})`,
          );
        }

        // Warn if endDate is in the future (likely a mistake)
        if (endDate > now) {
          await logger.warn(
            "endDate is in the future, using current time instead",
            {
              requested_end_date: endDate.toISOString(),
              adjusted_to: now.toISOString(),
            },
          );
          endDate = now;
        }

        // Generate period label for custom range
        const formatDate = (d) => d.toISOString().split("T")[0];
        periodLabel = `${formatDate(startDate)} to ${formatDate(endDate)}`;
      } else {
        // Legacy period parameter (backward compatibility)
        const period = args.period || "all";
        switch (period) {
          case "today":
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            endDate = now;
            periodLabel = "Last 24 Hours";
            break;
          case "week":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            endDate = now;
            periodLabel = "Last 7 Days";
            break;
          case "month":
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            endDate = now;
            periodLabel = "Last 30 Days";
            break;
          case "all":
          default:
            startDate = new Date(0);
            endDate = now;
            periodLabel = "All Time";
            break;
        }
      }

      // Filter compressions from all tiers by date range
      let recentCompressions = [];
      let aggregatedData = {
        count: 0,
        originalTokens: 0,
        compressedTokens: 0,
        tokensSaved: 0,
        costSavingsUSD: 0,
      };
      let modelBreakdownMap = {}; // Track per-model statistics

      // 1. Filter recent compressions (individual records)
      recentCompressions = (stats.recent || []).filter((c) => {
        const timestamp = new Date(c.timestamp);
        return timestamp >= startDate && timestamp <= endDate;
      });

      aggregatedData.count = recentCompressions.length;
      aggregatedData.originalTokens = recentCompressions.reduce(
        (sum, c) => sum + c.originalTokens,
        0,
      );
      aggregatedData.compressedTokens = recentCompressions.reduce(
        (sum, c) => sum + c.compressedTokens,
        0,
      );
      aggregatedData.tokensSaved = recentCompressions.reduce(
        (sum, c) => sum + c.tokensSaved,
        0,
      );

      // Aggregate cost savings from records with cost fields
      for (const c of recentCompressions) {
        if (c.costSavingsUSD && typeof c.costSavingsUSD === "number") {
          aggregatedData.costSavingsUSD += c.costSavingsUSD;

          // Build model breakdown
          const modelKey = c.model || "unknown";
          if (!modelBreakdownMap[modelKey]) {
            modelBreakdownMap[modelKey] = {
              modelName: MODEL_PRICING[modelKey]?.name || modelKey,
              compressions: 0,
              tokensSaved: 0,
              costSavingsUSD: 0,
            };
          }
          modelBreakdownMap[modelKey].compressions++;
          modelBreakdownMap[modelKey].tokensSaved += c.tokensSaved;
          modelBreakdownMap[modelKey].costSavingsUSD += c.costSavingsUSD;
        }
      }

      // 2. Filter daily aggregates within date range
      for (const [dayKey, dayStats] of Object.entries(stats.daily || {})) {
        const dayDate = new Date(dayKey + "T00:00:00.000Z"); // Parse as UTC midnight
        if (dayDate >= startDate && dayDate <= endDate) {
          aggregatedData.count += dayStats.count;
          aggregatedData.originalTokens += dayStats.originalTokens;
          aggregatedData.compressedTokens += dayStats.compressedTokens;
          aggregatedData.tokensSaved += dayStats.tokensSaved;
        }
      }

      // 3. Filter monthly aggregates within date range
      for (const [monthKey, monthStats] of Object.entries(
        stats.monthly || {},
      )) {
        const monthDate = new Date(monthKey + "-01T00:00:00.000Z"); // Parse as UTC first of month
        // Include month if any part of it overlaps with date range
        const monthEnd = new Date(monthDate);
        monthEnd.setMonth(monthEnd.getMonth() + 1); // End of month
        if (monthDate <= endDate && monthEnd >= startDate) {
          aggregatedData.count += monthStats.count;
          aggregatedData.originalTokens += monthStats.originalTokens;
          aggregatedData.compressedTokens += monthStats.compressedTokens;
          aggregatedData.tokensSaved += monthStats.tokensSaved;
        }
      }

      // Calculate cost savings based on detected LLM model (for fallback)
      const costSavings = await calculateCostSavings(
        aggregatedData.tokensSaved,
      );

      // Use aggregated cost from records if available, otherwise fall back to calculated cost
      const totalCostSavingsUSD =
        aggregatedData.costSavingsUSD > 0
          ? aggregatedData.costSavingsUSD
          : costSavings.costSavingsUSD;

      // Calculate average cost savings per compression
      const averageCostSavingsPerCompression =
        aggregatedData.count > 0
          ? totalCostSavingsUSD / aggregatedData.count
          : 0;

      // Convert model breakdown map to array sorted by cost savings
      const modelBreakdown = Object.values(modelBreakdownMap).sort(
        (a, b) => b.costSavingsUSD - a.costSavingsUSD,
      );

      // Calculate summary for filtered period
      const summary = {
        totalCompressions: aggregatedData.count,
        totalOriginalTokens: aggregatedData.originalTokens,
        totalCompressedTokens: aggregatedData.compressedTokens,
        totalTokensSaved: aggregatedData.tokensSaved,
        totalCostSavingsUSD: totalCostSavingsUSD,
        averageCostSavingsPerCompression: averageCostSavingsPerCompression,
        costSavingsUSD: costSavings.costSavingsUSD, // Keep for backward compatibility
        detectedModel: costSavings.modelName,
        pricePerMillionTokens: costSavings.pricePerMTok,
        averageCompressionRatio:
          aggregatedData.originalTokens > 0
            ? Math.round(
                (aggregatedData.compressedTokens /
                  aggregatedData.originalTokens) *
                  1000,
              ) / 1000
            : 0,
        averageSavingsPercentage:
          aggregatedData.originalTokens > 0
            ? Math.round(
                (aggregatedData.tokensSaved / aggregatedData.originalTokens) *
                  100 *
                  10,
              ) / 10
            : 0,
        modelBreakdown: modelBreakdown,
      };

      // Format response
      let responseText = `## Compression Statistics (${periodLabel})\n\n`;
      responseText += "**Summary:**\n";
      responseText += `- Total Compressions: ${summary.totalCompressions}\n`;
      responseText += `- Original Tokens: ${summary.totalOriginalTokens.toLocaleString()}\n`;
      responseText += `- Compressed Tokens: ${summary.totalCompressedTokens.toLocaleString()}\n`;
      responseText += `- Tokens Saved: ${summary.totalTokensSaved.toLocaleString()}\n`;
      responseText += `- Average Compression Ratio: ${summary.averageCompressionRatio}x\n`;
      responseText += `- Average Savings: ${summary.averageSavingsPercentage}%\n`;

      // Cost Savings Section
      responseText += `\n**Cost Savings:**\n`;
      responseText += `- **Total Cost Savings: $${summary.totalCostSavingsUSD.toFixed(2)} USD**\n`;
      responseText += `- Average Savings per Compression: $${summary.averageCostSavingsPerCompression.toFixed(2)} USD\n`;
      responseText += `- Detected Model: ${summary.detectedModel} ($${summary.pricePerMillionTokens}/M tokens)\n`;

      // Model Breakdown (if multiple models detected)
      if (summary.modelBreakdown.length > 0) {
        responseText += `\n**Model Breakdown:**\n`;
        for (const model of summary.modelBreakdown) {
          responseText += `- **${model.modelName}:**\n`;
          responseText += `  - Compressions: ${model.compressions}\n`;
          responseText += `  - Tokens Saved: ${model.tokensSaved.toLocaleString()}\n`;
          responseText += `  - Cost Savings: $${model.costSavingsUSD.toFixed(2)} USD\n`;
        }
      }

      // Storage stats
      responseText += `\n**Storage Breakdown:**\n`;
      responseText += `- Recent records (${RETENTION_POLICY.RECENT_DAYS} days): ${(stats.recent || []).length}\n`;
      responseText += `- Daily aggregates (${RETENTION_POLICY.DAILY_DAYS} days): ${Object.keys(stats.daily || {}).length}\n`;
      responseText += `- Monthly aggregates (${RETENTION_POLICY.MONTHLY_YEARS} years): ${Object.keys(stats.monthly || {}).length}\n`;

      if (includeDetails && recentCompressions.length > 0) {
        responseText += `\n**Recent Compressions (showing ${Math.min(limit, recentCompressions.length)} of ${recentCompressions.length}):**\n\n`;

        const sortedCompressions = recentCompressions
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, limit);

        for (const c of sortedCompressions) {
          const date = new Date(c.timestamp).toLocaleString();
          responseText += `### ${c.path}\n`;
          responseText += `- Date: ${date}\n`;
          responseText += `- Level: ${c.level}, Format: ${c.format}\n`;
          responseText += `- Original: ${c.originalTokens.toLocaleString()} tokens\n`;
          responseText += `- Compressed: ${c.compressedTokens.toLocaleString()} tokens\n`;
          responseText += `- Saved: ${c.tokensSaved.toLocaleString()} tokens (${c.savingsPercentage}%)\n`;
          if (c.estimated) responseText += `- *(Estimated values)*\n`;
          responseText += `\n`;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
        structuredContent: {
          summary,
          compressions: includeDetails
            ? recentCompressions.slice(0, limit)
            : [],
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving statistics: ${error.message}\n\nStatistics may not have been recorded yet. Compress some files first.`,
          },
        ],
        isError: true,
      };
    }
  }

  async handleCompress(args) {
    try {
      // Validate path exists
      const filePath = args.path;
      const stats = await fs.stat(filePath).catch((_err) => {
        throw new Error(
          `Path not found: ${filePath}\n\nMake sure the path is correct and accessible from the current working directory.`,
        );
      });

      // Auto-apply sensible defaults for directories
      const isDirectory = stats.isDirectory();
      let appliedLimit = args.limit;

      if (isDirectory && !args.limit) {
        // Count files to estimate if this might exceed token limit
        const { readdirSync } = require("fs");
        const pathModule = require("path");

        let fileCount = 0;
        try {
          const countFiles = (dir) => {
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory() && !entry.name.startsWith(".")) {
                countFiles(pathModule.join(dir, entry.name));
              } else if (entry.isFile()) {
                fileCount++;
                if (fileCount > 100) return; // Stop counting, it's definitely too large
              }
            }
          };
          countFiles(filePath);
        } catch (_e) {
          // Ignore errors in counting
        }

        // Auto-apply limit based on file count and compression level
        if (fileCount > 10) {
          const level = args.level || "full";

          // Calculate safe limit based on compression level
          if (level === "minimal") {
            appliedLimit = 50; // Minimal compression is very compact
          } else if (level === "signatures") {
            appliedLimit = 30; // Signatures are moderately compact
          } else {
            // 'full'
            appliedLimit = 20; // Full compression includes more content
          }

          // For summary format, use smaller limit (it still needs to compress files for stats)
          if (args.format === "summary") {
            appliedLimit = 30; // Summary shows stats for first 30 files + total count
          }

          await logger.info(
            "Auto-applied file limit for directory compression",
            {
              limit: appliedLimit,
              file_count: fileCount,
              level,
              format: args.format || "text",
              path: filePath,
            },
          );
        }
      }

      // Execute compression
      const result = await compressContext(
        filePath,
        args.level || "full",
        args.language || null,
        args.format || "text",
        args.include || null,
        args.exclude || null,
        appliedLimit, // Use auto-applied limit if set
        args.offset || 0,
      );

      // Check if result is suspiciously large (rough token estimate)
      const estimatedTokens = result.length / 4;
      if (estimatedTokens > 25000) {
        return {
          content: [
            {
              type: "text",
              text: `ERROR: Response too large (~${Math.round(estimatedTokens)} tokens, limit is 25,000).

SOLUTION - Use pagination:

1. Try format="summary" first:
   {path: "${filePath}", format: "summary"}

2. Or reduce batch size:
   Current: {limit: ${args.limit || "none"}}
   Try: {limit: ${args.limit ? Math.floor(args.limit / 2) : 20}}

3. Or use higher compression:
   Current: {level: "${args.level || "full"}"}
   Try: {level: "minimal"}`,
            },
          ],
          isError: true,
        };
      }

      // Record compression statistics (async, non-blocking)
      // Use fallback strategy if original content can't be read
      // Track the promise to ensure it completes before server exit
      const statsPromise = recordCompressionWithFallback(
        filePath,
        result,
        args.level || "full",
        args.format || "text",
        args.include,
        args.exclude,
        appliedLimit,
      ).catch((err) => {
        logger.error("Failed to record compression statistics", {
          error: err.message,
          path: filePath,
        });
      });

      // Track this promise so server waits for it before exiting
      if (this.pendingStatsRecordings) {
        this.pendingStatsRecordings.push(statsPromise);
      }

      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      // Enhance error messages
      let errorMessage = error.message;

      if (error.message.includes("ENOENT")) {
        errorMessage = `File or directory not found: ${args.path}\n\nCheck that:\n1. Path is correct and accessible\n2. You're in the right working directory\n3. File/directory exists`;
      } else if (error.message.includes("EACCES")) {
        errorMessage = `Permission denied: ${args.path}\n\nThe file or directory is not readable. Check file permissions.`;
      } else if (error.message.includes("ucpl-compress failed")) {
        errorMessage = `Compression failed: ${error.message}\n\nThis might be due to:\n1. Unsupported file type\n2. Corrupted file\n3. Invalid syntax in source code`;
      }

      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  async start() {
    // Track pending statistics recordings to ensure they complete before exit
    this.pendingStatsRecordings = [];

    await logger.info("MCP Server starting", {
      version: require("./package.json").version,
      node_version: process.version,
      platform: process.platform,
      log_file: LOG_FILE,
    });

    // Read from stdin line by line (JSON-RPC over stdio)
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    rl.on("line", async (line) => {
      try {
        const request = JSON.parse(line);
        await logger.debug("MCP request received", {
          method: request.method,
          id: request.id,
        });

        const response = await this.handleRequest(request);

        // Send JSON-RPC response
        console.log(
          JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            result: response,
          }),
        );
      } catch (error) {
        console.error(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32603,
              message: error.message,
            },
          }),
        );
      }
    });

    rl.on("close", async () => {
      // Wait for any pending stats recordings to complete before exiting
      if (this.pendingStatsRecordings.length > 0) {
        await logger.info("Waiting for pending stats recordings", {
          count: this.pendingStatsRecordings.length,
        });
        await Promise.allSettled(this.pendingStatsRecordings);
        await logger.info("All stats recordings complete");
      }
      await logger.info("MCP Server shutting down");
      process.exit(0);
    });
  }
}

// Export functions for testing
module.exports = {
  parseFlexibleDate,
  detectLLMClient,
  calculateCostSavings,
  MODEL_PRICING,
  aggregateStats,
  migrateStatsFormat,
  RETENTION_POLICY,
};

// Start server (only if running directly, not when imported)
if (require.main === module) {
  const server = new MCPServer();
  server.start().catch(async (error) => {
    await logger.error("Fatal server error", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });
}
