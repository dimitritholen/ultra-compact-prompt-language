# MCP Server Logging System

## Overview

The MCP server now includes comprehensive logging to help diagnose performance issues and track operations.

## Log Location

All logs are written to: `~/.ucpl/logs/mcp-server.log`

## Features

### 1. **Automatic Log Rotation**
- Maximum log file size: 10MB
- Keeps up to 5 backup files (mcp-server.log.1, .2, etc.)
- Automatically rotates when size limit is reached

### 2. **Performance Tracking**
Every operation is timed and logged with:
- Operation name
- Duration in milliseconds
- Status (completed/failed/error)
- Additional context data

### 3. **Log Levels**
- **INFO**: Major operations (server start, tool invocations, compression operations)
- **WARN**: Non-fatal warnings (config issues, fallback scenarios)
- **ERROR**: Failures and exceptions with full stack traces
- **DEBUG**: Detailed debugging info (command args, progress updates)

### 4. **Structured JSON Format**
All logs are in JSON format for easy parsing:
```json
{
  "timestamp": "2025-11-07T08:38:50.123Z",
  "level": "info",
  "message": "Starting compression",
  "path": "./fib-backend/tests",
  "level": "full",
  "limit": 20,
  "duration_ms": 3245,
  "status": "completed"
}
```

## What Gets Logged

### Server Lifecycle
- Server startup with version info
- MCP requests received
- Server errors and shutdowns

### Compression Operations
- Start time with full parameters (path, level, filters, limits)
- Progress updates every 5 seconds
- Python subprocess stderr output (real-time)
- Completion time with duration and output size
- Failures with exit codes and error messages

### Tool Invocations
- Tool name and arguments
- Duration
- Success/failure status

### Cost Calculations
- Model detection results
- Pricing lookups
- Cost calculation results

## Monitoring Logs

### Real-Time Monitoring
Use the provided watch script:
```bash
./scripts/watch-logs.sh
```

This will:
- Follow the log file in real-time
- Pretty-print JSON logs in human-readable format
- Show timestamps, log levels, messages, and durations

### Manual Inspection
View recent logs:
```bash
tail -50 ~/.ucpl/logs/mcp-server.log | jq '.'
```

View logs from last hour:
```bash
jq 'select(.timestamp > "'$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)'")' ~/.ucpl/logs/mcp-server.log
```

Filter by log level:
```bash
jq 'select(.level == "error")' ~/.ucpl/logs/mcp-server.log
```

Find slow operations (>5 seconds):
```bash
jq 'select(.duration_ms > 5000)' ~/.ucpl/logs/mcp-server.log
```

Search for specific operation:
```bash
jq 'select(.operation == "compress_context")' ~/.ucpl/logs/mcp-server.log
```

### Analyzing Performance Issues

If compression is taking too long (>3 minutes), check logs for:

1. **Compression start time**:
```bash
jq 'select(.message == "Starting compression")' ~/.ucpl/logs/mcp-server.log | tail -1
```

2. **Progress updates** (logged every 5 seconds):
```bash
jq 'select(.message == "Compression in progress")' ~/.ucpl/logs/mcp-server.log | tail -5
```

3. **Python stderr output** (shows file processing):
```bash
jq 'select(.message == "ucpl-compress stderr")' ~/.ucpl/logs/mcp-server.log | tail -20
```

4. **Final duration**:
```bash
jq 'select(.operation == "compress_context" and .status == "completed") | {duration_ms, path, level, limit}' ~/.ucpl/logs/mcp-server.log | tail -1
```

## Example Log Analysis

### Scenario: Compression stuck for 3+ minutes

1. Check what parameters were used:
```bash
jq 'select(.message == "Starting compression") | {timestamp, path, level, limit, offset}' ~/.ucpl/logs/mcp-server.log | tail -1
```

2. See if subprocess is outputting anything:
```bash
jq 'select(.message == "ucpl-compress stderr") | .message' ~/.ucpl/logs/mcp-server.log | tail -20
```

3. Check for errors:
```bash
jq 'select(.level == "error")' ~/.ucpl/logs/mcp-server.log | tail -5
```

### Scenario: Finding bottlenecks

Find slowest operations:
```bash
jq 'select(.duration_ms) | {operation, duration_ms, path}' ~/.ucpl/logs/mcp-server.log | jq -s 'sort_by(.duration_ms) | reverse | .[0:10]'
```

## Log Management

### Clear Old Logs
```bash
rm ~/.ucpl/logs/mcp-server.log.*  # Remove backups
> ~/.ucpl/logs/mcp-server.log      # Clear current log
```

### Archive Logs
```bash
tar -czf ~/mcp-logs-$(date +%Y%m%d).tar.gz ~/.ucpl/logs/
```

## Troubleshooting

### No logs appearing?
1. Check if log directory exists: `ls -la ~/.ucpl/logs/`
2. Check file permissions: `ls -la ~/.ucpl/logs/mcp-server.log`
3. Check if server is actually running: Look for console.error output

### Logs too verbose?
The logging system is designed to be comprehensive by default. All logs go to file + stderr, so you'll see them in both places.

### Disk space concerns?
- Logs are automatically rotated at 10MB
- Only 5 backups are kept (max ~50MB total)
- You can safely delete old backups anytime

## Integration with Other Tools

### Send logs to external monitoring
```bash
tail -f ~/.ucpl/logs/mcp-server.log | while read line; do
  echo "$line" | curl -X POST https://your-log-service.com/api/logs \
    -H "Content-Type: application/json" \
    -d "$line"
done
```

### Parse logs with Python
```python
import json
with open(os.path.expanduser('~/.ucpl/logs/mcp-server.log')) as f:
    for line in f:
        log = json.loads(line)
        if log.get('duration_ms', 0) > 5000:
            print(f"Slow operation: {log['operation']} took {log['duration_ms']}ms")
```
