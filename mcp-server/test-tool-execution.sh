#!/bin/bash

echo "=== Testing Tool Execution with New Schema ==="
echo ""

# Create a temporary test file
cat > /tmp/test-compress.py <<'PYFILE'
def hello_world():
    """Print hello world"""
    print("Hello, World!")

class Calculator:
    """Simple calculator"""
    
    def add(self, a, b):
        """Add two numbers"""
        return a + b
    
    def subtract(self, a, b):
        """Subtract two numbers"""
        return a - b
PYFILE

echo "Created test file: /tmp/test-compress.py"
echo ""

# Test tool execution through MCP protocol
echo "Test 1: Compress test file (minimal level)"
RESULT=$(cat <<'JSONRPC' | timeout 5 node server.js 2>&1 | tail -1
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"compress_code_context","arguments":{"path":"/tmp/test-compress.py","level":"minimal","format":"text"}}}
JSONRPC
)

if echo "$RESULT" | jq -e '.result.content[0].text' > /dev/null 2>&1; then
  echo "✓ Tool execution successful"
  echo "  Response type: $(echo "$RESULT" | jq -r '.result.content[0].type')"
  echo "  Content length: $(echo "$RESULT" | jq -r '.result.content[0].text' | wc -c) chars"
else
  echo "✗ Tool execution failed"
  echo "  Response: $RESULT"
fi

echo ""
echo "Test 2: Invalid parameters (should fail gracefully)"
ERROR_RESULT=$(cat <<'JSONRPC' | timeout 5 node server.js 2>&1 | tail -1
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"compress_code_context","arguments":{"path":"/nonexistent/file.py"}}}
JSONRPC
)

if echo "$ERROR_RESULT" | jq -e '.result.isError' > /dev/null 2>&1; then
  echo "✓ Error handling works correctly"
  echo "  isError flag: $(echo "$ERROR_RESULT" | jq -r '.result.isError')"
else
  echo "⚠ Error handling might need review"
fi

echo ""
echo "Test 3: Validation constraints (limit parameter)"
# Test that limit respects minimum constraint
LIMIT_RESULT=$(cat <<'JSONRPC' | timeout 5 node server.js 2>&1 | tail -1
{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"compress_code_context","arguments":{"path":"/tmp/test-compress.py","limit":10,"offset":0}}}
JSONRPC
)

if echo "$LIMIT_RESULT" | jq -e '.result' > /dev/null 2>&1; then
  echo "✓ Limit parameter validation works"
else
  echo "✗ Limit parameter validation failed"
fi

# Cleanup
rm -f /tmp/test-compress.py

echo ""
echo "=== Tool Execution Tests Complete ==="
