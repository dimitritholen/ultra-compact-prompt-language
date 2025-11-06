#!/bin/bash

echo "=== Manual Verification of Statistics Recording Fix ==="
echo ""
echo "This test will perform multiple compressions via the MCP server"
echo "and verify that ALL compressions are recorded in the stats file."
echo ""

# Stats file location
STATS_FILE="$HOME/.ucpl/compress/compression-stats.json"
BACKUP_FILE="$HOME/.ucpl/compress/compression-stats.json.backup"

# Backup existing stats
if [ -f "$STATS_FILE" ]; then
  cp "$STATS_FILE" "$BACKUP_FILE"
  echo "✅ Backed up existing stats to $BACKUP_FILE"
else
  echo "  (No existing stats file)"
fi

# Clear stats for clean test
rm -f "$STATS_FILE"
echo "✅ Cleared stats file for clean test"
echo ""

# Create test files
mkdir -p /tmp/ucpl-test
cat > /tmp/ucpl-test/test1.py <<'EOF'
def calculate_total(items):
    """Calculate total price"""
    return sum(item.price * item.quantity for item in items)

def format_currency(amount):
    """Format amount as USD"""
    return f"${amount:.2f}"
EOF

cat > /tmp/ucpl-test/test2.js <<'EOF'
function getUserData(userId) {
  return fetch(\`/api/users/\${userId}\`)
    .then(res => res.json())
    .catch(err => console.error(err));
}

class UserManager {
  constructor() {
    this.users = new Map();
  }

  addUser(id, data) {
    this.users.set(id, data);
  }
}
EOF

echo "Created test files in /tmp/ucpl-test/"
echo ""

# Helper function to call MCP tool
call_mcp_tool() {
  local path="$1"
  local level="$2"
  local format="$3"

  cat <<JSONRPC | timeout 10 node server.js 2>&1 | grep -v "^$" | tail -1
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"compress_code_context","arguments":{"path":"$path","level":"$level","format":"$format"}}}
JSONRPC
}

# Count compressions in stats file
count_compressions() {
  if [ -f "$STATS_FILE" ]; then
    jq '.compressions | length' "$STATS_FILE" 2>/dev/null || echo "0"
  else
    echo "0"
  fi
}

# Wait for async stats recording
wait_for_stats() {
  sleep 1
}

echo "Initial compression count: $(count_compressions)"
echo ""

# Test 1: Single file compression
echo "Test 1: Compressing test1.py (full level)..."
RESULT=$(call_mcp_tool "/tmp/ucpl-test/test1.py" "full" "text")
wait_for_stats
COUNT1=$(count_compressions)
echo "  Compressions after test 1: $COUNT1"
if [ "$COUNT1" -ge "1" ]; then
  echo "  ✅ Test 1 recorded"
else
  echo "  ❌ Test 1 NOT recorded"
fi
echo ""

# Test 2: Another file compression
echo "Test 2: Compressing test2.js (minimal level)..."
RESULT=$(call_mcp_tool "/tmp/ucpl-test/test2.js" "minimal" "summary")
wait_for_stats
COUNT2=$(count_compressions)
echo "  Compressions after test 2: $COUNT2"
if [ "$COUNT2" -ge "2" ]; then
  echo "  ✅ Test 2 recorded"
else
  echo "  ❌ Test 2 NOT recorded"
fi
echo ""

# Test 3: Directory compression (likely to use fallback)
echo "Test 3: Compressing directory /tmp/ucpl-test (signatures level)..."
RESULT=$(call_mcp_tool "/tmp/ucpl-test" "signatures" "summary")
wait_for_stats
COUNT3=$(count_compressions)
echo "  Compressions after test 3: $COUNT3"
if [ "$COUNT3" -ge "3" ]; then
  echo "  ✅ Test 3 recorded"
else
  echo "  ❌ Test 3 NOT recorded"
fi
echo ""

# Test 4: Compression that will fail readOriginalContent (nonexistent file - will error before stats)
echo "Test 4: Testing actual server.js file (will use real stats recording)..."
RESULT=$(call_mcp_tool "$(pwd)/server.js" "minimal" "summary")
wait_for_stats
COUNT4=$(count_compressions)
echo "  Compressions after test 4: $COUNT4"
if [ "$COUNT4" -ge "4" ]; then
  echo "  ✅ Test 4 recorded"
else
  echo "  ❌ Test 4 NOT recorded"
fi
echo ""

# Show final stats
echo "=== Final Results ==="
FINAL_COUNT=$(count_compressions)
echo "Total compressions recorded: $FINAL_COUNT / 4"
echo ""

if [ -f "$STATS_FILE" ]; then
  echo "Statistics file content:"
  jq '.' "$STATS_FILE" | head -80

  # Check if any have estimated flag
  ESTIMATED_COUNT=$(jq '[.compressions[] | select(.estimated == true)] | length' "$STATS_FILE" 2>/dev/null || echo "0")
  echo ""
  echo "Compressions with estimated flag: $ESTIMATED_COUNT"

  if [ "$ESTIMATED_COUNT" -gt "0" ]; then
    echo "  ✅ Fallback estimation is working"
  fi
else
  echo "❌ No statistics file created!"
fi

# Cleanup
rm -rf /tmp/ucpl-test
echo ""

# Restore backup if desired
if [ -f "$BACKUP_FILE" ]; then
  read -p "Restore original stats file? (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    mv "$BACKUP_FILE" "$STATS_FILE"
    echo "✅ Restored original stats"
  else
    echo "  Keeping test results, backup saved at $BACKUP_FILE"
  fi
fi

# Final verdict
if [ "$FINAL_COUNT" -ge "4" ]; then
  echo ""
  echo "✅ SUCCESS: All 4 compressions were recorded!"
  echo "   The bug fix is working correctly!"
  exit 0
else
  echo ""
  echo "❌ FAILURE: Only $FINAL_COUNT / 4 compressions were recorded"
  exit 1
fi
