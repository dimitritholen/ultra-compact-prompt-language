# Manual Testing Guide for MCP Server

This guide documents manual testing procedures for scenarios that cannot be fully automated in the CI/CD pipeline.

## When to Use Manual Testing

Manual testing should be used for:

1. **Interactive UI Testing** - Testing the MCP Inspector interface
2. **End-to-End Integration** - Testing with real MCP clients (Claude Desktop, Claude Code, etc.)
3. **Visual Validation** - Verifying formatted output appears correctly in client UIs
4. **Environment-Specific Tests** - Testing behavior that varies by OS or client version

## Automated Tests

All functional logic tests are automated and run with `npm test`. Do NOT create manual tests for logic that can be validated with assertions.

---

## Manual Test Scenarios

### 1. MCP Inspector Testing for get_compression_stats

**Purpose**: Validate that the get_compression_stats tool works correctly through the MCP protocol with real client interaction.

**Prerequisites**:
- MCP server is running
- MCP Inspector is installed: `npm install -g @modelcontextprotocol/inspector`
- Test compression statistics exist (run some compressions first)

**Steps**:

1. **Start MCP Server with Inspector**
   ```bash
   cd mcp-server
   npx @modelcontextprotocol/inspector node server.js
   ```

2. **Test relativeDays Parameter**

   Navigate to "Tools" → "get_compression_stats" in the Inspector UI

   Test Case A: Last 3 Days
   ```json
   {"relativeDays": 3}
   ```

   **Expected**:
   - Summary shows compressions from last 3 days only
   - Period label: "Last 3 Days"
   - Token counts and cost savings are non-zero (if data exists)

   Test Case B: Last 7 Days
   ```json
   {"relativeDays": 7}
   ```

   **Expected**:
   - Summary shows compressions from last week
   - Period label: "Last 7 Days"
   - More compressions than 3-day test (if data exists)

   Test Case C: Last 30 Days
   ```json
   {"relativeDays": 30}
   ```

   **Expected**:
   - Summary includes all recent compressions (last month)
   - Period label: "Last 30 Days"

3. **Test Custom Date Ranges (ISO Format)**

   Test Case D: Specific Date Range
   ```json
   {
     "startDate": "2025-01-01",
     "endDate": "2025-01-31"
   }
   ```

   **Expected**:
   - Only compressions within January 2025
   - Period label: "2025-01-01 to 2025-01-31"

   Test Case E: Start Date Only
   ```json
   {"startDate": "2025-01-15"}
   ```

   **Expected**:
   - Compressions from Jan 15, 2025 to now
   - Period label shows date range

   Test Case F: End Date Only
   ```json
   {"endDate": "2025-01-31"}
   ```

   **Expected**:
   - All compressions up to Jan 31, 2025
   - Period label shows date range

4. **Test Relative Time Strings**

   Test Case G: Days Ago
   ```json
   {"startDate": "-7d", "endDate": "now"}
   ```

   **Expected**:
   - Same as relativeDays: 7
   - Period label shows calculated date range

   Test Case H: Weeks Ago
   ```json
   {"startDate": "-2w", "endDate": "-1w"}
   ```

   **Expected**:
   - Compressions from 2 weeks ago to 1 week ago
   - Period label shows date range

   Test Case I: Months Ago
   ```json
   {"startDate": "-1m"}
   ```

   **Expected**:
   - Last ~30 days of compressions
   - Period label shows calculated range

5. **Test Legacy Backward Compatibility**

   Test Case J: Legacy "today"
   ```json
   {"period": "today"}
   ```

   **Expected**:
   - Last 24 hours of compressions
   - Period label: "Last 24 Hours"

   Test Case K: Legacy "week"
   ```json
   {"period": "week"}
   ```

   **Expected**:
   - Last 7 days
   - Period label: "Last 7 Days"

   Test Case L: Legacy "month"
   ```json
   {"period": "month"}
   ```

   **Expected**:
   - Last 30 days
   - Period label: "Last 30 Days"

   Test Case M: Legacy "all"
   ```json
   {"period": "all"}
   ```

   **Expected**:
   - All compressions from all tiers (recent, daily, monthly)
   - Period label: "All Time"
   - Includes summary totals

6. **Test Priority Order**

   Test Case N: relativeDays Takes Precedence
   ```json
   {"relativeDays": 7, "period": "all"}
   ```

   **Expected**:
   - Uses relativeDays (7 days), NOT period (all)
   - Period label: "Last 7 Days"

   Test Case O: startDate Takes Precedence
   ```json
   {"startDate": "-7d", "period": "all"}
   ```

   **Expected**:
   - Uses startDate (last 7 days to now), NOT period (all)
   - Period label shows calculated date range

7. **Test Error Cases**

   Test Case P: Invalid relativeDays (out of range)
   ```json
   {"relativeDays": 400}
   ```

   **Expected**:
   - Error message: "relativeDays must be a number between 1 and 365"

   Test Case Q: Invalid Date Format
   ```json
   {"startDate": "invalid-date"}
   ```

   **Expected**:
   - Error message: "Invalid date format: invalid-date. Expected ISO date..."

   Test Case R: startDate After endDate
   ```json
   {
     "startDate": "2025-02-01",
     "endDate": "2025-01-01"
   }
   ```

   **Expected**:
   - Error message: "Invalid date range: startDate ... is after endDate ..."

8. **Test Multi-tier Filtering**

   Test Case S: Recent Tier (30 days)
   ```json
   {"relativeDays": 90}
   ```

   **Expected**:
   - Includes recent tier (individual records) AND daily tier (aggregated)
   - Storage Breakdown section shows counts for each tier

   Test Case T: All Tiers
   ```json
   {"period": "all"}
   ```

   **Expected**:
   - Storage Breakdown shows:
     - Recent records (30 days): X
     - Daily aggregates (365 days): Y
     - Monthly aggregates (5 years): Z
   - Summary includes data from all tiers

9. **Test includeDetails Parameter**

   Test Case U: Details Enabled
   ```json
   {"relativeDays": 7, "includeDetails": true}
   ```

   **Expected**:
   - Response includes "Recent Compressions" section
   - Each compression shows: path, date, level, format, tokens saved, percentage

   Test Case V: Details with Limit
   ```json
   {"relativeDays": 30, "includeDetails": true, "limit": 5}
   ```

   **Expected**:
   - Shows maximum 5 compression details
   - Header indicates "showing 5 of X"

10. **Test Cost Savings Calculation**

    Test Case W: Cost Breakdown
    ```json
    {"relativeDays": 30}
    ```

    **Expected**:
    - Cost Savings section shows:
      - Total Cost Savings in USD
      - Average Savings per Compression
      - Detected Model (e.g., "Claude Sonnet 4")
      - Price per million tokens

    Test Case X: Model Breakdown (Multiple Models)
    ```json
    {"period": "all"}
    ```

    **Expected** (if multiple models were used):
    - Model Breakdown section lists each model:
      - Model name
      - Number of compressions
      - Tokens saved
      - Cost savings in USD

### 2. Testing with Real MCP Clients

**Purpose**: Validate integration with Claude Desktop, Claude Code, and other MCP clients.

**Steps**:

1. **Claude Desktop Integration**

   a. Configure MCP server in Claude Desktop config

   b. Open Claude Desktop

   c. Type: "Show me my compression statistics for the last week"

   **Expected**: Claude uses get_compression_stats tool and displays formatted results

2. **Claude Code / VSCode Integration**

   a. Configure MCP server in Claude Code

   b. Open VSCode with Claude Code extension

   c. Ask: "What are my token savings from code compression this month?"

   **Expected**: Tool invocation works, results are formatted in sidebar

### 3. Visual Output Validation

**Purpose**: Verify that formatted markdown output renders correctly in client UIs.

**Steps**:

1. Run get_compression_stats through MCP Inspector or client
2. Verify markdown formatting:
   - Headers render correctly (##, **bold**)
   - Lists are properly formatted (bullet points, indentation)
   - Numbers have thousand separators (e.g., "1,000")
   - Currency formatted with $ and 2 decimal places
   - Dates formatted correctly

### 4. Cross-Platform Testing

**Purpose**: Ensure stats file access works across operating systems.

**Manual Tests**:

1. **Linux**: Test file at `~/.ucpl/compress/compression-stats.json`
2. **macOS**: Test file at `~/.ucpl/compress/compression-stats.json`
3. **Windows**: Test file at `%USERPROFILE%\.ucpl\compress\compression-stats.json`

For each platform:
- Run compression
- Verify stats file is created/updated
- Query stats with get_compression_stats
- Verify correct data is returned

---

## Reporting Issues

When a manual test fails:

1. **Document the failure**:
   - Test case ID and name
   - Input parameters used
   - Expected vs actual behavior
   - Screenshots (if UI-related)
   - Environment details (OS, client version, etc.)

2. **Check if it can be automated**:
   - If the failure is due to logic error → write automated test
   - If it's truly manual-only → file bug with manual test procedure

3. **Create GitHub Issue** with:
   - Title: `[Manual Test] Test Case X Failed: Brief Description`
   - Full test procedure
   - Reproduction steps
   - Expected vs actual results

---

## Notes

- Automated tests cover all functional logic (date parsing, filtering, aggregation, etc.)
- Manual tests focus on protocol integration, UI rendering, and client interaction
- Do NOT create manual tests for scenarios that can be automated
- Always check if a manual test can be converted to an automated test before documenting it here
