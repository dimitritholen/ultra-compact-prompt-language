const { spawn } = require('child_process');

/**
 * Call an MCP (Model Context Protocol) tool by spawning the server process
 *
 * Spawns the MCP server as a child process, sends an initialize request
 * followed by a tools/call request, and waits for the response. This function
 * handles the full MCP protocol handshake including JSON-RPC formatting.
 *
 * @param {string} serverPath - Absolute path to the server.js file to spawn
 * @param {string} toolName - Name of the MCP tool to call (e.g., 'compress_code_context', 'get_compression_stats')
 * @param {Object} args - Arguments object to pass to the tool (tool-specific parameters)
 * @returns {Promise<{response: Object, stderr: string}>} Object containing the JSON-RPC response and stderr output
 * @returns {Object} response - The JSON-RPC response object with id, result, or error
 * @returns {string} stderr - Standard error output from the server process
 * @throws {Error} When the server process exits with non-zero code
 * @throws {Error} When no tool response is found in the output
 * @throws {Error} When response parsing fails
 * @example
 * // Call the compress_code_context tool
 * const { response, stderr } = await callMCPTool(
 *   '/path/to/server.js',
 *   'compress_code_context',
 *   { path: './src/index.js', level: 'full', format: 'text' }
 * );
 *
 * if (response.error) {
 *   console.error('Tool error:', response.error);
 * } else {
 *   console.log('Tool result:', response.result);
 * }
 *
 * @example
 * // Call the get_compression_stats tool
 * const { response } = await callMCPTool(
 *   '/path/to/server.js',
 *   'get_compression_stats',
 *   { period: 'today', includeDetails: true }
 * );
 * const stats = response.result?.content[0]?.text;
 */
function callMCPTool(serverPath, toolName, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [serverPath]);
    let stdout = '';
    let stderr = '';
    let requestId = Date.now();

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Set a timeout to collect output
    let responseTimeout = setTimeout(() => {
      proc.kill();

      try {
        const lines = stdout.trim().split('\n').filter(line => line.length > 0);

        // Find the tool call response
        let toolResponse = null;
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(lines[i]);
            if (parsed.id === requestId + 1) {
              toolResponse = parsed;
              break;
            }
          } catch (_e) {
            // Skip non-JSON lines
          }
        }

        if (toolResponse) {
          resolve({ response: toolResponse, stderr });
        } else {
          // Debug: show the actual output
          const debugOutput = lines.length > 0 ? `\nFirst line: ${lines[0].substring(0, 200)}` : '\nNo lines';
          reject(new Error(`No tool response found in output. Expected ID: ${requestId + 1}. Output lines: ${lines.length}.${debugOutput}\nStderr: ${stderr}`));
        }
      } catch (error) {
        reject(new Error(`Failed to parse response: ${error.message}\nOutput: ${stdout}`));
      }
    }, 3500); // Wait 3.5 seconds for responses and stats recording

    proc.on('close', (code) => {
      clearTimeout(responseTimeout);
      if (code !== 0 && code !== null) {
        reject(new Error(`Process exited with code ${code}: ${stderr}`));
      }
    });

    // Initialize server first
    const initRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    };

    // Then call the tool
    const toolRequest = {
      jsonrpc: '2.0',
      id: requestId + 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    proc.stdin.write(JSON.stringify(initRequest) + '\n');
    // Give server time to process initialize before sending tool request
    setTimeout(() => {
      proc.stdin.write(JSON.stringify(toolRequest) + '\n');
      // Don't call end() - let the timeout kill the process after responses are received
    }, 100);
  });
}

module.exports = {
  callMCPTool
};
