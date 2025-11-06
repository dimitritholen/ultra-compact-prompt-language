const { spawn } = require('child_process');

/**
 * Call an MCP tool by spawning the server process
 * @param {string} serverPath - Path to the server.js file
 * @param {string} toolName - Name of the MCP tool to call
 * @param {Object} args - Arguments to pass to the tool
 * @returns {Promise<{response: Object, stderr: string}>} Tool response and stderr output
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
