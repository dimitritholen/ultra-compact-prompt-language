#!/bin/bash

# Comprehensive Test Runner for MCP Server
# Runs all unit tests, integration tests, and static analysis

set -e  # Exit on error

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  MCP Server - Comprehensive Test Suite Runner               ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

FAILED=0
PASSED=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run a test
run_test() {
  local name="$1"
  local command="$2"

  echo -e "${YELLOW}Running: $name${NC}"
  if eval "$command"; then
    echo -e "${GREEN}✓ $name passed${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ $name failed${NC}"
    ((FAILED++))
  fi
  echo ""
}

# 1. Static Analysis
echo "═══ 1. Static Analysis ═══"
echo ""

# ESLint
run_test "ESLint" "npm run lint"

# Syntax check
run_test "JavaScript Syntax Check" "node -c server.js && node -c test-integration.js"

# 2. Unit Tests
echo "═══ 2. Unit Tests ═══"
echo ""

run_test "Date Parsing Tests" "node test-date-parsing.js"
run_test "LLM Detection Tests" "node test-llm-detection.js"
run_test "Cost Calculation Tests" "node test-cost-tracking.js"
run_test "Stats Query Tests" "node test-stats-query.js"

# 3. Integration Tests
echo "═══ 3. Integration Tests ═══"
echo ""

run_test "Comprehensive Integration Tests" "node test-integration.js"
run_test "MCP Protocol Integration Tests" "./test-integration.sh"

# 4. Schema Validation
echo "═══ 4. Schema Validation ═══"
echo ""

run_test "Tool Schema Validation" "node test-schema.js"

# 5. Statistics Tests
echo "═══ 5. Statistics Tests ═══"
echo ""

run_test "Statistics Functionality" "node test-statistics.js"
run_test "Statistics Fallback" "node test-statistics-fallback.js"
run_test "Stats Retention" "node test-stats-retention.js"

# Summary
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Test Summary:"
echo -e "${GREEN}  Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
  echo -e "${RED}  Failed: $FAILED${NC}"
else
  echo "  Failed: 0"
fi
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Some tests failed. Review the output above.${NC}"
  echo ""
  exit 1
fi
