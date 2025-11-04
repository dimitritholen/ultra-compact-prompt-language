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

// Path to ucpl-compress script
const COMPRESS_SCRIPT = path.join(__dirname, '../scripts/ucpl-compress');

/**
 * Execute ucpl-compress and return results
 */
async function compressContext(filePath, level = 'full', language = null, format = 'text', include = null, exclude = null) {
  return new Promise((resolve, reject) => {
    const args = [filePath, '--level', level, '--format', format];

    if (language) {
      args.push('--language', language);
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
        description: 'Compress code files/directories to semantic summaries (70-98% token reduction). Returns compressed content by default. Preserves semantic meaning while drastically reducing tokens. LLM can read compressed format directly without decompression. Use format="summary" for stats only. Supports 16 languages: Python, JavaScript, TypeScript, Java, Go, C#, PHP, Rust, Ruby, C++, PowerShell, Bash/Shell, JSON, YAML, Markdown, Plain Text.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to file or directory to compress (relative or absolute)'
            },
            level: {
              type: 'string',
              enum: ['full', 'signatures', 'minimal'],
              default: 'full',
              description: 'Compression level: full (70-80% reduction, includes docstrings), signatures (80-85%, signatures+types only), minimal (85-90%, API surface only)'
            },
            language: {
              type: 'string',
              enum: ['python', 'javascript', 'typescript', 'java', 'go', 'csharp', 'php', 'rust', 'ruby', 'cpp', 'powershell', 'shell', 'json', 'yaml', 'markdown', 'text'],
              description: 'Programming language (auto-detected if not specified)'
            },
            format: {
              type: 'string',
              enum: ['text', 'summary', 'json'],
              default: 'text',
              description: 'Output format: text (compressed content - default), summary (stats table only), json (content + metadata)'
            },
            include: {
              type: 'array',
              items: { type: 'string' },
              description: 'Include only files matching these glob patterns (e.g., ["*.py", "src/**/*.js"]). Overrides language-based defaults.'
            },
            exclude: {
              type: 'array',
              items: { type: 'string' },
              description: 'Exclude files matching these glob patterns (e.g., ["**/test_*", "**/__pycache__", "*.min.js"])'
            }
          },
          required: ['path']
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
            version: '1.0.0'
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

    if (name !== 'compress_code_context') {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      // Validate path exists
      const filePath = args.path;
      try {
        await fs.access(filePath);
      } catch (err) {
        throw new Error(`Path not found: ${filePath}`);
      }

      // Execute compression
      const result = await compressContext(
        filePath,
        args.level || 'full',
        args.language || null,
        args.format || 'text',
        args.include || null,
        args.exclude || null
      );

      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  async start() {
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

    rl.on('close', () => {
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
