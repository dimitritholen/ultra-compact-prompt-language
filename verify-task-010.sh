#!/bin/bash

# Task 010: Comprehensive Field Validation - Verification Script
# This script verifies all deliverables are complete and tests pass

echo "=========================================="
echo "Task 010: Comprehensive Field Validation"
echo "Verification Script"
echo "=========================================="
echo ""

cd "$(dirname "$0")/mcp-server"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
CHECKS_PASSED=0
CHECKS_FAILED=0

check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}❌ $1${NC}"
        ((CHECKS_FAILED++))
    fi
}

# 1. Verify all required files exist
echo "1. Verifying Files Exist..."
echo "----------------------------"

[ -f "test-validation-helpers.js" ]
check "test-validation-helpers.js exists"

[ -f "test-validation-helpers-unit.js" ]
check "test-validation-helpers-unit.js exists"

[ -f "TASK-010-COMPLETION.md" ]
check "TASK-010-COMPLETION.md exists"

[ -f "VALIDATION-GUIDE.md" ]
check "VALIDATION-GUIDE.md exists"

[ -f "../TASK-010-SUMMARY.md" ]
check "TASK-010-SUMMARY.md exists"

[ -f "../DELIVERABLES-CHECKLIST.md" ]
check "DELIVERABLES-CHECKLIST.md exists"

echo ""

# 2. Verify validation helper has required functions
echo "2. Verifying Validation Helper Functions..."
echo "--------------------------------------------"

grep -q "function validateCompressionRecord" test-validation-helpers.js
check "validateCompressionRecord function exists"

grep -q "function validateStatsSummary" test-validation-helpers.js
check "validateStatsSummary function exists"

grep -q "function validateStatsFile" test-validation-helpers.js
check "validateStatsFile function exists"

grep -q "function validateTimestamp" test-validation-helpers.js
check "validateTimestamp function exists"

grep -q "function validateRange" test-validation-helpers.js
check "validateRange function exists"

echo ""

# 3. Verify test files import validation helpers
echo "3. Verifying Test File Integration..."
echo "--------------------------------------"

grep -q "validateCompressionRecord" test-statistics.js
check "test-statistics.js imports validation helpers"

grep -q "validateCompressionRecord" test-mcp-stats.js
check "test-mcp-stats.js imports validation helpers"

echo ""

# 4. Run unit tests
echo "4. Running Unit Tests..."
echo "------------------------"

if node test-validation-helpers-unit.js > /tmp/task-010-unit-test.log 2>&1; then
    UNIT_PASSED=$(grep -o "Passed: [0-9]*" /tmp/task-010-unit-test.log | cut -d' ' -f2)
    UNIT_FAILED=$(grep -o "Failed: [0-9]*" /tmp/task-010-unit-test.log | cut -d' ' -f2)

    if [ "$UNIT_FAILED" -eq 0 ]; then
        echo -e "${GREEN}✅ All $UNIT_PASSED unit tests passed${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}❌ $UNIT_FAILED unit tests failed${NC}"
        ((CHECKS_FAILED++))
    fi
else
    echo -e "${RED}❌ Unit tests failed to run${NC}"
    ((CHECKS_FAILED++))
fi

echo ""

# 5. Run integration tests
echo "5. Running Integration Tests..."
echo "--------------------------------"

if node test-statistics.js > /tmp/task-010-integration-test.log 2>&1; then
    INT_RESULTS=$(grep "Results:" /tmp/task-010-integration-test.log | tail -1)

    if echo "$INT_RESULTS" | grep -q "3/3 tests passed"; then
        echo -e "${GREEN}✅ All integration tests passed (3/3)${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}❌ Integration tests failed${NC}"
        echo "$INT_RESULTS"
        ((CHECKS_FAILED++))
    fi
else
    echo -e "${RED}❌ Integration tests failed to run${NC}"
    ((CHECKS_FAILED++))
fi

echo ""

# 6. Verify documentation completeness
echo "6. Verifying Documentation..."
echo "------------------------------"

COMPLETION_LINES=$(wc -l < TASK-010-COMPLETION.md)
if [ "$COMPLETION_LINES" -gt 250 ]; then
    echo -e "${GREEN}✅ TASK-010-COMPLETION.md is comprehensive ($COMPLETION_LINES lines)${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠️  TASK-010-COMPLETION.md might be incomplete ($COMPLETION_LINES lines)${NC}"
    ((CHECKS_FAILED++))
fi

GUIDE_LINES=$(wc -l < VALIDATION-GUIDE.md)
if [ "$GUIDE_LINES" -gt 300 ]; then
    echo -e "${GREEN}✅ VALIDATION-GUIDE.md is comprehensive ($GUIDE_LINES lines)${NC}"
    ((CHECKS_PASSED++))
else
    echo -e "${YELLOW}⚠️  VALIDATION-GUIDE.md might be incomplete ($GUIDE_LINES lines)${NC}"
    ((CHECKS_FAILED++))
fi

echo ""

# 7. Summary
echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo ""
echo "Checks Passed: $CHECKS_PASSED"
echo "Checks Failed: $CHECKS_FAILED"
echo "Total Checks:  $((CHECKS_PASSED + CHECKS_FAILED))"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL VERIFICATIONS PASSED${NC}"
    echo ""
    echo "Task 010 is complete and verified!"
    echo "All deliverables are present and functional."
    exit 0
else
    echo -e "${RED}❌ SOME VERIFICATIONS FAILED${NC}"
    echo ""
    echo "Please review the failed checks above."
    exit 1
fi
