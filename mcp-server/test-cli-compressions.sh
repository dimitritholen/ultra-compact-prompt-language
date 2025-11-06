#!/bin/bash

# Test real compressions using the CLI to verify statistics recording

echo "=== Testing Real Compression Statistics Recording ==="
echo ""
echo "This test will compress several files and verify stats are recorded"
echo ""

# Backup existing stats
STATS_FILE="$HOME/.ucpl/compress/compression-stats.json"
BACKUP_FILE="$HOME/.ucpl/compress/compression-stats.json.backup"

if [ -f "$STATS_FILE" ]; then
  cp "$STATS_FILE" "$BACKUP_FILE"
  echo "✅ Backed up existing stats"
else
  echo "  (No existing stats to backup)"
fi

# Clear stats for clean test
rm -f "$STATS_FILE"
echo "✅ Cleared stats for clean test"
echo ""

# Count compressions function
count_compressions() {
  if [ -f "$STATS_FILE" ]; then
    grep -o '"timestamp"' "$STATS_FILE" | wc -l
  else
    echo "0"
  fi
}

# Initial count
INITIAL_COUNT=$(count_compressions)
echo "Initial compression count: $INITIAL_COUNT"
echo ""

# Test 1: Compress a single file
echo "Test 1: Single file compression..."
./scripts/ucpl-compress server.js --level minimal --format summary > /dev/null 2>&1
sleep 0.5
COUNT_AFTER_1=$(count_compressions)
echo "  Compressions after test 1: $COUNT_AFTER_1"

if [ "$COUNT_AFTER_1" -gt "$INITIAL_COUNT" ]; then
  echo "  ✅ Single file compression recorded"
else
  echo "  ❌ Single file compression NOT recorded"
fi
echo ""

# Test 2: Compress multiple files
echo "Test 2: Multiple file compressions..."
./scripts/ucpl-compress test-statistics.js --level full --format text > /dev/null 2>&1
sleep 0.5
./scripts/ucpl-compress test-schema.js --level signatures --format summary > /dev/null 2>&1
sleep 0.5
COUNT_AFTER_2=$(count_compressions)
echo "  Compressions after test 2: $COUNT_AFTER_2"

if [ "$COUNT_AFTER_2" -gt "$COUNT_AFTER_1" ]; then
  echo "  ✅ Multiple file compressions recorded"
else
  echo "  ❌ Multiple file compressions NOT recorded"
fi
echo ""

# Test 3: Compress a directory (likely to use fallback estimation)
echo "Test 3: Directory compression (tests fallback)..."
./scripts/ucpl-compress ../scripts --level minimal --format summary --limit 10 > /dev/null 2>&1
sleep 0.5
COUNT_AFTER_3=$(count_compressions)
echo "  Compressions after test 3: $COUNT_AFTER_3"

if [ "$COUNT_AFTER_3" -gt "$COUNT_AFTER_2" ]; then
  echo "  ✅ Directory compression recorded"
else
  echo "  ❌ Directory compression NOT recorded"
fi
echo ""

# Show final stats
echo "=== Final Statistics ==="
if [ -f "$STATS_FILE" ]; then
  echo "Total compressions recorded: $COUNT_AFTER_3"
  echo ""
  echo "Stats file content:"
  cat "$STATS_FILE" | head -50
else
  echo "❌ No stats file found!"
fi
echo ""

# Restore original stats
if [ -f "$BACKUP_FILE" ]; then
  mv "$BACKUP_FILE" "$STATS_FILE"
  echo "✅ Restored original stats"
else
  echo "  (No backup to restore)"
fi

# Check if all tests passed
EXPECTED_TOTAL=$((INITIAL_COUNT + 4))
if [ "$COUNT_AFTER_3" -ge "$EXPECTED_TOTAL" ]; then
  echo ""
  echo "✅ All tests passed!"
  echo "   The bug fix is working correctly!"
  exit 0
else
  echo ""
  echo "❌ Some compressions were not recorded"
  echo "   Expected at least $EXPECTED_TOTAL, got $COUNT_AFTER_3"
  exit 1
fi
