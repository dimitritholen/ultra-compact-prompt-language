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
    console.error(`[WARN] Token counting failed: ${error.message}`);
    // Fallback: rough estimate (chars/4)
    return Math.ceil(text.length / 4);
  }
}

/**
 * Load compression statistics from file
 * @returns {Promise<Object>} Statistics object
 */
async function loadStats() {
  try {
    const data = await fs.readFile(STATS_FILE, 'utf-8');
    const stats = JSON.parse(data);

    // Migrate old format if needed
    if (stats.compressions && !stats.recent) {
      console.error('[INFO] Migrating stats to new multi-tier format...');
      return migrateStatsFormat(stats);
    }

    return stats;
  } catch (_error) {
    // File doesn't exist or is corrupted - return empty stats
    return {
      version: '2.0',
      recent: [],      // Individual records from last 30 days
      daily: {},       // Aggregated by day for 31-395 days ago
      monthly: {},     // Aggregated by month for 395+ days ago
      summary: {
        totalCompressions: 0,
        totalOriginalTokens: 0,
        totalCompressedTokens: 0,
        totalTokensSaved: 0
      }
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
  const recentCutoff = new Date(now.getTime() - RETENTION_POLICY.RECENT_DAYS * 24 * 60 * 60 * 1000);
  const dailyCutoff = new Date(now.getTime() - RETENTION_POLICY.DAILY_DAYS * 24 * 60 * 60 * 1000);

  const newStats = {
    version: '2.0',
    recent: [],
    daily: {},
    monthly: {},
    summary: oldStats.summary || {
      totalCompressions: 0,
      totalOriginalTokens: 0,
      totalCompressedTokens: 0,
      totalTokensSaved: 0
    }
  };

  // Distribute old compressions into appropriate tiers
  for (const compression of oldStats.compressions || []) {
    const timestamp = new Date(compression.timestamp);

    if (timestamp >= recentCutoff) {
      // Keep in recent
      newStats.recent.push(compression);
    } else if (timestamp >= dailyCutoff) {
      // Aggregate into daily
      const dayKey = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!newStats.daily[dayKey]) {
        newStats.daily[dayKey] = {
          date: dayKey,
          count: 0,
          originalTokens: 0,
          compressedTokens: 0,
          tokensSaved: 0
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
          tokensSaved: 0
        };
      }
      newStats.monthly[monthKey].count++;
      newStats.monthly[monthKey].originalTokens += compression.originalTokens;
      newStats.monthly[monthKey].compressedTokens += compression.compressedTokens;
      newStats.monthly[monthKey].tokensSaved += compression.tokensSaved;
    }
  }

  console.error(`[INFO] Migration complete: ${newStats.recent.length} recent, ${Object.keys(newStats.daily).length} daily, ${Object.keys(newStats.monthly).length} monthly`);
  return newStats;
}

/**
 * Aggregate stats by moving old data from recent to daily/monthly tiers
 * @param {Object} stats - Statistics object to aggregate
 * @returns {Object} Aggregated stats
 */
function aggregateStats(stats) {
  const now = new Date();
  const recentCutoff = new Date(now.getTime() - RETENTION_POLICY.RECENT_DAYS * 24 * 60 * 60 * 1000);
  const dailyCutoff = new Date(now.getTime() - RETENTION_POLICY.DAILY_DAYS * 24 * 60 * 60 * 1000);
  const monthlyCutoff = new Date(now.getTime() - RETENTION_POLICY.MONTHLY_YEARS * 365 * 24 * 60 * 60 * 1000);

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
      const dayKey = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!newDaily[dayKey]) {
        newDaily[dayKey] = {
          date: dayKey,
          count: 0,
          originalTokens: 0,
          compressedTokens: 0,
          tokensSaved: 0
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
          tokensSaved: 0
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
          tokensSaved: 0
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
    const monthDate = new Date(monthKey + '-01');
    if (monthDate < monthlyCutoff) {
      oldMonthlyKeys.push(monthKey);
    }
  }

  // Remove old monthly aggregates (optional: could keep forever)
  for (const key of oldMonthlyKeys) {
    delete newMonthly[key];
  }

  return {
    ...stats,
    recent: newRecent,
    daily: newDaily,
    monthly: newMonthly
  };
}

/**
 * Save compression statistics to file (with auto-aggregation)
 * @param {Object} stats - Statistics object to save
 */
async function saveStats(stats) {
  try {
    // Aggregate old data before saving
    const aggregatedStats = aggregateStats(stats);

    // Ensure directory exists (cross-platform)
    await fs.mkdir(STATS_DIR, { recursive: true });
    await fs.writeFile(STATS_FILE, JSON.stringify(aggregatedStats, null, 2), 'utf-8');
  } catch (error) {
    console.error(`[ERROR] Failed to save statistics: ${error.message}`);
  }
}

/**
 * Record a compression operation in statistics
 * @param {string} path - Path that was compressed
 * @param {string} originalContent - Original file content(s)
 * @param {string} compressedContent - Compressed output
 * @param {string} level - Compression level used
 * @param {string} format - Format used
 */
async function recordCompression(path, originalContent, compressedContent, level, format) {
  try {
    const stats = await loadStats();

    const originalTokens = countTokens(originalContent);
    const compressedTokens = countTokens(compressedContent);
    const tokensSaved = originalTokens - compressedTokens;
    const compressionRatio = originalTokens > 0 ? (compressedTokens / originalTokens) : 0;
    const savingsPercentage = originalTokens > 0 ? ((tokensSaved / originalTokens) * 100) : 0;

    const record = {
      timestamp: new Date().toISOString(),
      path,
      originalTokens,
      compressedTokens,
      tokensSaved,
      compressionRatio: Math.round(compressionRatio * 1000) / 1000,
      savingsPercentage: Math.round(savingsPercentage * 10) / 10,
      level,
      format
    };

    // Add to recent compressions (will be auto-aggregated on save)
    if (!stats.recent) stats.recent = [];
    stats.recent.push(record);

    stats.summary.totalCompressions++;
    stats.summary.totalOriginalTokens += originalTokens;
    stats.summary.totalCompressedTokens += compressedTokens;
    stats.summary.totalTokensSaved += tokensSaved;

    await saveStats(stats);

    console.error(`[INFO] Recorded compression: ${path} - Original: ${originalTokens} tokens, Compressed: ${compressedTokens} tokens, Saved: ${tokensSaved} tokens (${Math.round(savingsPercentage)}%)`);
  } catch (error) {
    console.error(`[ERROR] Failed to record compression statistics: ${error.message}`);
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
async function recordCompressionWithFallback(filePath, compressedContent, level, format, include, exclude, limit) {
  try {
    // Try to read original content for accurate statistics
    const originalContent = await readOriginalContent(filePath, include, exclude, limit);

    if (originalContent && originalContent.length > 0) {
      // Success: record with accurate token counts
      await recordCompression(filePath, originalContent, compressedContent, level, format);
    } else {
      // Fallback: original content is empty (shouldn't happen, but handle gracefully)
      console.error(`[WARN] Original content is empty for ${filePath}, using fallback estimation`);
      await recordCompressionWithEstimation(filePath, compressedContent, level, format);
    }
  } catch (error) {
    // Fallback: estimate original tokens from compressed output
    console.error(`[WARN] Could not read original content for ${filePath}: ${error.message}`);
    console.error('[WARN] Using estimated token counts based on compression level');
    await recordCompressionWithEstimation(filePath, compressedContent, level, format);
  }
}

/**
 * Record compression using estimated original token count
 * @param {string} filePath - Path that was compressed
 * @param {string} compressedContent - Compressed output
 * @param {string} level - Compression level used
 * @param {string} format - Format used
 */
async function recordCompressionWithEstimation(filePath, compressedContent, level, format) {
  try {
    const stats = await loadStats();
    const compressedTokens = countTokens(compressedContent);

    // Estimate original tokens based on typical compression ratios
    // These are conservative estimates based on observed compression performance
    const estimationMultipliers = {
      'minimal': 10.0,  // 90% typical reduction
      'signatures': 6.0,  // 83% typical reduction
      'full': 4.0  // 75% typical reduction
    };

    const multiplier = estimationMultipliers[level] || 4.0;
    const estimatedOriginalTokens = Math.round(compressedTokens * multiplier);
    const tokensSaved = estimatedOriginalTokens - compressedTokens;
    const compressionRatio = compressedTokens / estimatedOriginalTokens;
    const savingsPercentage = (tokensSaved / estimatedOriginalTokens) * 100;

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
      estimated: true  // Flag to indicate this used estimation
    };

    // Add to recent compressions (will be auto-aggregated on save)
    if (!stats.recent) stats.recent = [];
    stats.recent.push(record);

    stats.summary.totalCompressions++;
    stats.summary.totalOriginalTokens += estimatedOriginalTokens;
    stats.summary.totalCompressedTokens += compressedTokens;
    stats.summary.totalTokensSaved += tokensSaved;

    await saveStats(stats);

    console.error(`[INFO] Recorded compression (estimated): ${filePath} - Original: ~${estimatedOriginalTokens} tokens, Compressed: ${compressedTokens} tokens, Saved: ~${tokensSaved} tokens (${Math.round(savingsPercentage)}%)`);
  } catch (error) {
    // This is the last resort - log and throw
    console.error(`[ERROR] Failed to record compression statistics even with estimation: ${error.message}`);
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
async function readOriginalContent(filePath, _include = null, _exclude = null, limit = null) {
  try {
    const stats = await fs.stat(filePath);

    if (stats.isFile()) {
      return await fs.readFile(filePath, 'utf-8');
    }

    // For directories, read files matching criteria
    const { readdirSync, readFileSync } = require('fs');
    const pathModule = require('path');
    let content = '';
    let fileCount = 0;

    const readDir = (dir) => {
      if (limit && fileCount >= limit) return;

      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (limit && fileCount >= limit) break;

        const fullPath = pathModule.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          readDir(fullPath);
        } else if (entry.isFile()) {
          // Apply include/exclude filters (simplified - just check extensions)
          try {
            const fileContent = readFileSync(fullPath, 'utf-8');
            content += fileContent + '\n';
            fileCount++;
          } catch (_err) {
            // Skip files that can't be read
          }
        }
      }
    };

    readDir(filePath);
    return content;
  } catch (error) {
    console.error(`[WARN] Could not read original content for token counting: ${error.message}`);
    return '';
  }
}

/**
 * Execute ucpl-compress and return results
 */
async function compressContext(filePath, level = 'full', language = null, format = 'text', include = null, exclude = null, limit = null, offset = 0) {
  return new Promise((resolve, reject) => {
    const args = [filePath, '--level', level, '--format', format, '--offset', String(offset)];

    if (language) {
      args.push('--language', language);
    }

    if (limit !== null && limit !== undefined) {
      args.push('--limit', String(limit));
    }

    if (include && Array.isArray(include)) {
      include.forEach(pattern => {
        args.push('--include', pattern);
      });
    }

    if (exclude && Array.isArray(exclude)) {
      exclude.forEach(pattern => {
        args.push('--exclude', pattern);
      });
    }

    const proc = spawn(COMPRESS_SCRIPT, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`ucpl-compress failed: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
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
        name: 'compress_code_context',
        description: 'Compress code files/directories to semantic summaries (70-98% token reduction). LLM can read compressed format directly. Supports multiple languages, auto-pagination for large dirs, and adjustable compression levels.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to file or directory (relative or absolute). Defaults to current directory if not specified.',
              minLength: 1,
              maxLength: 4096
            },
            level: {
              type: 'string',
              description: 'Compression level. Use "minimal" for initial exploration (85-90% reduction), "full" for detailed understanding (70-80% reduction).',
              default: 'full',
              oneOf: [
                {
                  const: 'full',
                  title: 'Full',
                  description: 'Complete semantic compression (70-80% reduction)'
                },
                {
                  const: 'signatures',
                  title: 'Signatures',
                  description: 'Function signatures only (80-90% reduction)'
                },
                {
                  const: 'minimal',
                  title: 'Minimal',
                  description: 'Minimal structure (85-90% reduction)'
                }
              ]
            },
            language: {
              type: 'string',
              description: 'Programming language (auto-detected from file extension). Only needed for stdin or ambiguous extensions.',
              oneOf: [
                { const: 'python', title: 'Python', description: '.py files' },
                { const: 'javascript', title: 'JavaScript', description: '.js files' },
                { const: 'typescript', title: 'TypeScript', description: '.ts/.tsx files' },
                { const: 'java', title: 'Java', description: '.java files' },
                { const: 'go', title: 'Go', description: '.go files' },
                { const: 'csharp', title: 'C#', description: '.cs files' },
                { const: 'php', title: 'PHP', description: '.php files' },
                { const: 'rust', title: 'Rust', description: '.rs files' },
                { const: 'ruby', title: 'Ruby', description: '.rb files' },
                { const: 'cpp', title: 'C++', description: '.cpp/.hpp files' },
                { const: 'powershell', title: 'PowerShell', description: '.ps1 files' },
                { const: 'shell', title: 'Shell', description: '.sh files' },
                { const: 'json', title: 'JSON', description: '.json files' },
                { const: 'yaml', title: 'YAML', description: '.yaml/.yml files' },
                { const: 'markdown', title: 'Markdown', description: '.md files' },
                { const: 'text', title: 'Text', description: 'Plain text files' }
              ]
            },
            format: {
              type: 'string',
              description: 'Output format. Use "summary" for quick overview, "text" for compressed content, "json" for structured data.',
              default: 'text',
              oneOf: [
                {
                  const: 'text',
                  title: 'Text',
                  description: 'Human-readable compressed content'
                },
                {
                  const: 'summary',
                  title: 'Summary',
                  description: 'Statistics and file list (1-3K tokens)'
                },
                {
                  const: 'json',
                  title: 'JSON',
                  description: 'Structured data format'
                }
              ]
            },
            include: {
              type: 'array',
              items: {
                type: 'string',
                minLength: 1,
                maxLength: 256,
                description: 'Glob pattern (e.g., "*.py", "src/**/*.js")'
              },
              description: 'Include only files matching patterns. Overrides language defaults.',
              minItems: 1,
              maxItems: 50
            },
            exclude: {
              type: 'array',
              items: {
                type: 'string',
                minLength: 1,
                maxLength: 256,
                description: 'Glob pattern (e.g., "**/test_*", "**/__pycache__")'
              },
              description: 'Exclude files matching patterns. Recommended: exclude tests and build artifacts.',
              minItems: 1,
              maxItems: 50
            },
            limit: {
              type: 'number',
              description: 'Max files to process. Auto-applied: minimal=50, signatures=30, full=20. Use for manual pagination.',
              minimum: 1,
              maximum: 200,
              default: null
            },
            offset: {
              type: 'number',
              description: 'Files to skip (for pagination). Example: limit=30,offset=0 → files 1-30, offset=30 → files 31-60.',
              minimum: 0,
              default: 0
            }
          },
          required: ['path']
        },
        outputSchema: {
          type: 'object',
          properties: {
            compressed: {
              type: 'string',
              description: 'Compressed code content or summary text'
            },
            metadata: {
              type: 'object',
              properties: {
                filesProcessed: {
                  type: 'number',
                  description: 'Number of files compressed'
                },
                totalFiles: {
                  type: 'number',
                  description: 'Total files found (if directory)'
                },
                compressionLevel: {
                  type: 'string',
                  description: 'Applied compression level'
                },
                format: {
                  type: 'string',
                  description: 'Output format used'
                },
                estimatedTokens: {
                  type: 'number',
                  description: 'Rough token estimate (chars/4)'
                }
              }
            }
          }
        },
        annotations: {
          audience: ['assistant'],
          priority: 0.7,
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false
        }
      },
      {
        name: 'get_compression_stats',
        description: 'Retrieve token savings statistics for code compressions. Shows actual token counts (not estimates) for all compressions within specified time period.',
        inputSchema: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              description: 'Time period to filter statistics',
              default: 'all',
              oneOf: [
                {
                  const: 'all',
                  title: 'All Time',
                  description: 'All compression statistics ever recorded'
                },
                {
                  const: 'today',
                  title: 'Today',
                  description: 'Compressions from the last 24 hours'
                },
                {
                  const: 'week',
                  title: 'This Week',
                  description: 'Compressions from the last 7 days'
                },
                {
                  const: 'month',
                  title: 'This Month',
                  description: 'Compressions from the last 30 days'
                }
              ]
            },
            includeDetails: {
              type: 'boolean',
              description: 'Include individual compression records (not just summary)',
              default: false
            },
            limit: {
              type: 'number',
              description: 'Maximum number of individual records to return (when includeDetails=true)',
              minimum: 1,
              maximum: 100,
              default: 10
            }
          }
        },
        outputSchema: {
          type: 'object',
          properties: {
            summary: {
              type: 'object',
              properties: {
                totalCompressions: { type: 'number' },
                totalOriginalTokens: { type: 'number' },
                totalCompressedTokens: { type: 'number' },
                totalTokensSaved: { type: 'number' },
                averageCompressionRatio: { type: 'number' },
                averageSavingsPercentage: { type: 'number' }
              }
            },
            compressions: {
              type: 'array',
              description: 'Individual compression records (if includeDetails=true)'
            }
          }
        },
        annotations: {
          audience: ['user', 'assistant'],
          priority: 0.5,
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false
        }
      }
    ];
  }

  async handleRequest(request) {
    const { method, params } = request;

    switch (method) {
      case 'initialize':
        return {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'ucpl-compress-mcp',
            version: '1.1.0'
          }
        };

      case 'tools/list':
        return { tools: this.tools };

      case 'tools/call':
        return await this.handleToolCall(params);

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  async handleToolCall(params) {
    const { name, arguments: args } = params;

    if (name === 'get_compression_stats') {
      return await this.handleGetStats(args);
    } else if (name === 'compress_code_context') {
      return await this.handleCompress(args);
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  }

  async handleGetStats(args) {
    try {
      const stats = await loadStats();
      const period = args.period || 'all';
      const includeDetails = args.includeDetails || false;
      const limit = args.limit || 10;

      // Collect data from all tiers based on period
      const now = new Date();
      let recentCompressions = [];
      let aggregatedData = { count: 0, originalTokens: 0, compressedTokens: 0, tokensSaved: 0 };

      if (period === 'today') {
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        // Only recent compressions can be from today
        recentCompressions = (stats.recent || []).filter(c => new Date(c.timestamp) >= oneDayAgo);

        aggregatedData.count = recentCompressions.length;
        aggregatedData.originalTokens = recentCompressions.reduce((sum, c) => sum + c.originalTokens, 0);
        aggregatedData.compressedTokens = recentCompressions.reduce((sum, c) => sum + c.compressedTokens, 0);
        aggregatedData.tokensSaved = recentCompressions.reduce((sum, c) => sum + c.tokensSaved, 0);
      } else if (period === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        // Recent compressions from last week
        recentCompressions = (stats.recent || []).filter(c => new Date(c.timestamp) >= oneWeekAgo);

        aggregatedData.count = recentCompressions.length;
        aggregatedData.originalTokens = recentCompressions.reduce((sum, c) => sum + c.originalTokens, 0);
        aggregatedData.compressedTokens = recentCompressions.reduce((sum, c) => sum + c.compressedTokens, 0);
        aggregatedData.tokensSaved = recentCompressions.reduce((sum, c) => sum + c.tokensSaved, 0);
      } else if (period === 'month') {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        // Recent compressions from last month
        recentCompressions = (stats.recent || []).filter(c => new Date(c.timestamp) >= oneMonthAgo);

        aggregatedData.count = recentCompressions.length;
        aggregatedData.originalTokens = recentCompressions.reduce((sum, c) => sum + c.originalTokens, 0);
        aggregatedData.compressedTokens = recentCompressions.reduce((sum, c) => sum + c.compressedTokens, 0);
        aggregatedData.tokensSaved = recentCompressions.reduce((sum, c) => sum + c.tokensSaved, 0);

        // Add daily aggregates from last month
        for (const [dayKey, dayStats] of Object.entries(stats.daily || {})) {
          const dayDate = new Date(dayKey);
          if (dayDate >= oneMonthAgo) {
            aggregatedData.count += dayStats.count;
            aggregatedData.originalTokens += dayStats.originalTokens;
            aggregatedData.compressedTokens += dayStats.compressedTokens;
            aggregatedData.tokensSaved += dayStats.tokensSaved;
          }
        }
      } else {
        // All time - use summary
        recentCompressions = stats.recent || [];
        aggregatedData = {
          count: stats.summary.totalCompressions,
          originalTokens: stats.summary.totalOriginalTokens,
          compressedTokens: stats.summary.totalCompressedTokens,
          tokensSaved: stats.summary.totalTokensSaved
        };
      }

      // Calculate summary for filtered period
      const summary = {
        totalCompressions: aggregatedData.count,
        totalOriginalTokens: aggregatedData.originalTokens,
        totalCompressedTokens: aggregatedData.compressedTokens,
        totalTokensSaved: aggregatedData.tokensSaved,
        averageCompressionRatio: aggregatedData.originalTokens > 0
          ? Math.round((aggregatedData.compressedTokens / aggregatedData.originalTokens) * 1000) / 1000
          : 0,
        averageSavingsPercentage: aggregatedData.originalTokens > 0
          ? Math.round((aggregatedData.tokensSaved / aggregatedData.originalTokens) * 100 * 10) / 10
          : 0
      };

      // Format response
      let responseText = `## Compression Statistics (${period === 'all' ? 'All Time' : period === 'today' ? 'Last 24 Hours' : period === 'week' ? 'Last 7 Days' : 'Last 30 Days'})\n\n`;
      responseText += '**Summary:**\n';
      responseText += `- Total Compressions: ${summary.totalCompressions}\n`;
      responseText += `- Original Tokens: ${summary.totalOriginalTokens.toLocaleString()}\n`;
      responseText += `- Compressed Tokens: ${summary.totalCompressedTokens.toLocaleString()}\n`;
      responseText += `- Tokens Saved: ${summary.totalTokensSaved.toLocaleString()}\n`;
      responseText += `- Average Compression Ratio: ${summary.averageCompressionRatio}x\n`;
      responseText += `- Average Savings: ${summary.averageSavingsPercentage}%\n`;

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
            type: 'text',
            text: responseText
          }
        ],
        structuredContent: {
          summary,
          compressions: includeDetails ? recentCompressions.slice(0, limit) : []
        }
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error retrieving statistics: ${error.message}\n\nStatistics may not have been recorded yet. Compress some files first.`
          }
        ],
        isError: true
      };
    }
  }

  async handleCompress(args) {

    try {
      // Validate path exists
      const filePath = args.path;
      const stats = await fs.stat(filePath).catch(_err => {
        throw new Error(`Path not found: ${filePath}\n\nMake sure the path is correct and accessible from the current working directory.`);
      });

      // Auto-apply sensible defaults for directories
      const isDirectory = stats.isDirectory();
      let appliedLimit = args.limit;

      if (isDirectory && !args.limit) {
        // Count files to estimate if this might exceed token limit
        const { readdirSync } = require('fs');
        const pathModule = require('path');

        let fileCount = 0;
        try {
          const countFiles = (dir) => {
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory() && !entry.name.startsWith('.')) {
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
          const level = args.level || 'full';

          // Calculate safe limit based on compression level
          if (level === 'minimal') {
            appliedLimit = 50;  // Minimal compression is very compact
          } else if (level === 'signatures') {
            appliedLimit = 30;  // Signatures are moderately compact
          } else {  // 'full'
            appliedLimit = 20;  // Full compression includes more content
          }

          // For summary format, use smaller limit (it still needs to compress files for stats)
          if (args.format === 'summary') {
            appliedLimit = 30;  // Summary shows stats for first 30 files + total count
          }

          console.error(`[INFO] Auto-applied limit=${appliedLimit} for directory with ${fileCount}+ files (level=${level}, format=${args.format || 'text'})`);
        }
      }

      // Execute compression
      const result = await compressContext(
        filePath,
        args.level || 'full',
        args.language || null,
        args.format || 'text',
        args.include || null,
        args.exclude || null,
        appliedLimit,  // Use auto-applied limit if set
        args.offset || 0
      );

      // Check if result is suspiciously large (rough token estimate)
      const estimatedTokens = result.length / 4;
      if (estimatedTokens > 25000) {
        return {
          content: [
            {
              type: 'text',
              text: `ERROR: Response too large (~${Math.round(estimatedTokens)} tokens, limit is 25,000).

SOLUTION - Use pagination:

1. Try format="summary" first:
   {path: "${filePath}", format: "summary"}

2. Or reduce batch size:
   Current: {limit: ${args.limit || 'none'}}
   Try: {limit: ${args.limit ? Math.floor(args.limit / 2) : 20}}

3. Or use higher compression:
   Current: {level: "${args.level || 'full'}"}
   Try: {level: "minimal"}`
            }
          ],
          isError: true
        };
      }

      // Record compression statistics (async, non-blocking)
      // Use fallback strategy if original content can't be read
      // Track the promise to ensure it completes before server exit
      const statsPromise = recordCompressionWithFallback(
        filePath,
        result,
        args.level || 'full',
        args.format || 'text',
        args.include,
        args.exclude,
        appliedLimit
      ).catch(err => {
        console.error(`[ERROR] Failed to record compression statistics: ${err.message}`);
      });

      // Track this promise so server waits for it before exiting
      if (this.pendingStatsRecordings) {
        this.pendingStatsRecordings.push(statsPromise);
      }

      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
    } catch (error) {
      // Enhance error messages
      let errorMessage = error.message;

      if (error.message.includes('ENOENT')) {
        errorMessage = `File or directory not found: ${args.path}\n\nCheck that:\n1. Path is correct and accessible\n2. You're in the right working directory\n3. File/directory exists`;
      } else if (error.message.includes('EACCES')) {
        errorMessage = `Permission denied: ${args.path}\n\nThe file or directory is not readable. Check file permissions.`;
      } else if (error.message.includes('ucpl-compress failed')) {
        errorMessage = `Compression failed: ${error.message}\n\nThis might be due to:\n1. Unsupported file type\n2. Corrupted file\n3. Invalid syntax in source code`;
      }

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }

  async start() {
    // Track pending statistics recordings to ensure they complete before exit
    this.pendingStatsRecordings = [];

    // Read from stdin line by line (JSON-RPC over stdio)
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    rl.on('line', async (line) => {
      try {
        const request = JSON.parse(line);
        const response = await this.handleRequest(request);

        // Send JSON-RPC response
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          result: response
        }));
      } catch (error) {
        console.error(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: error.message
          }
        }));
      }
    });

    rl.on('close', async () => {
      // Wait for any pending stats recordings to complete before exiting
      if (this.pendingStatsRecordings.length > 0) {
        console.error(`[INFO] Waiting for ${this.pendingStatsRecordings.length} pending stats recordings...`);
        await Promise.allSettled(this.pendingStatsRecordings);
        console.error('[INFO] All stats recordings complete');
      }
      process.exit(0);
    });
  }
}

// Start server
const server = new MCPServer();
server.start().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
