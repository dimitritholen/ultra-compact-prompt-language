#!/bin/bash
# Watch MCP server logs in real-time with pretty printing

LOG_FILE="$HOME/.ucpl/logs/mcp-server.log"

if [ ! -f "$LOG_FILE" ]; then
  echo "Log file not found: $LOG_FILE"
  echo "The MCP server hasn't been started yet or logging is not enabled."
  exit 1
fi

echo "Watching MCP server logs at: $LOG_FILE"
echo "Press Ctrl+C to stop"
echo ""
echo "----------------------------------------"

# Use tail to follow the log file and pipe through jq for pretty printing
tail -f "$LOG_FILE" | while read -r line; do
  echo "$line" | jq -r '. | "\(.timestamp) [\(.level | ascii_upcase)] \(.message) \(if .duration_ms then "(\(.duration_ms)ms)" else "" end)"'
done
