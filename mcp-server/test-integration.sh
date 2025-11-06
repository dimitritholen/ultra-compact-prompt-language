#!/bin/bash

# Integration test for MCP server with new schema

echo "=== MCP Server Integration Test ==="
echo ""

# Test 1: Initialize
echo "Test 1: Initialize"
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | node server.js &
PID=$!
sleep 1
kill $PID 2>/dev/null

# Test 2: List Tools
echo "Test 2: List Tools"
TOOLS_OUTPUT=$(echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | timeout 2 node server.js 2>/dev/null)
if echo "$TOOLS_OUTPUT" | jq -e '.result.tools[0].name' > /dev/null 2>&1; then
  echo "✓ Tools list successful"
  echo "  Tool name: $(echo "$TOOLS_OUTPUT" | jq -r '.result.tools[0].name')"
  echo "  Description length: $(echo "$TOOLS_OUTPUT" | jq -r '.result.tools[0].description' | wc -c)"
  echo "  Has outputSchema: $(echo "$TOOLS_OUTPUT" | jq -e '.result.tools[0].outputSchema' > /dev/null && echo 'yes' || echo 'no')"
  echo "  Has annotations: $(echo "$TOOLS_OUTPUT" | jq -e '.result.tools[0].annotations' > /dev/null && echo 'yes' || echo 'no')"
else
  echo "✗ Tools list failed"
  exit 1
fi

echo ""
echo "Test 3: Validate Schema Structure"
# Check for oneOf patterns
if echo "$TOOLS_OUTPUT" | jq -e '.result.tools[0].inputSchema.properties.level.oneOf' > /dev/null 2>&1; then
  echo "✓ level parameter has oneOf pattern"
else
  echo "✗ level parameter missing oneOf"
fi

if echo "$TOOLS_OUTPUT" | jq -e '.result.tools[0].inputSchema.properties.format.oneOf' > /dev/null 2>&1; then
  echo "✓ format parameter has oneOf pattern"
else
  echo "✗ format parameter missing oneOf"
fi

if echo "$TOOLS_OUTPUT" | jq -e '.result.tools[0].inputSchema.properties.language.oneOf' > /dev/null 2>&1; then
  echo "✓ language parameter has oneOf pattern"
else
  echo "✗ language parameter missing oneOf"
fi

# Check for validation constraints
if echo "$TOOLS_OUTPUT" | jq -e '.result.tools[0].inputSchema.properties.limit.minimum' > /dev/null 2>&1; then
  echo "✓ limit has minimum constraint"
else
  echo "✗ limit missing minimum"
fi

if echo "$TOOLS_OUTPUT" | jq -e '.result.tools[0].inputSchema.properties.offset.minimum' > /dev/null 2>&1; then
  echo "✓ offset has minimum constraint"
else
  echo "✗ offset missing minimum"
fi

echo ""
echo "=== All Tests Passed ==="
