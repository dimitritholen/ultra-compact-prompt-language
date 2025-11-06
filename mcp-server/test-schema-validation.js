#!/usr/bin/env node
/**
 * Schema Validation Test
 * Tests the get_compression_stats tool schema for MCP compliance
 */

// Extract the schema from server.js
const schema = {
  name: 'get_compression_stats',
  description: 'Retrieve token savings statistics for code compressions with flexible date queries. Shows actual token counts (not estimates) for compressions within specified time period using period presets, custom date ranges, or relative days.',
  inputSchema: {
    type: 'object',
    properties: {
      period: {
        type: 'string',
        description: 'Time period preset to filter statistics (backward compatible)',
        default: 'all',
        oneOf: [
          {
            const: 'all',
            title: 'All Time',
            description: 'All compression statistics ever recorded'
          },
          {
            const: 'today',
            title: 'Today',
            description: 'Compressions from the last 24 hours'
          },
          {
            const: 'week',
            title: 'This Week',
            description: 'Compressions from the last 7 days'
          },
          {
            const: 'month',
            title: 'This Month',
            description: 'Compressions from the last 30 days'
          }
        ]
      },
      startDate: {
        type: 'string',
        description: 'Start date for custom date range. Accepts ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ) or relative time strings (e.g., "2 hours ago", "yesterday", "last week"). Optional - if omitted, no start boundary is applied.'
      },
      endDate: {
        type: 'string',
        description: 'End date for custom date range. Accepts ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ) or relative time strings (e.g., "now", "today", "1 hour ago"). Optional - if omitted, defaults to current time.'
      },
      relativeDays: {
        type: 'number',
        description: 'Number of days to look back from now. Alternative to startDate/endDate for simple queries. Example: relativeDays=7 returns compressions from last 7 days. Must be between 1 and 365.',
        minimum: 1,
        maximum: 365
      },
      includeDetails: {
        type: 'boolean',
        description: 'Include individual compression records (not just summary)',
        default: false
      },
      limit: {
        type: 'number',
        description: 'Maximum number of individual records to return (when includeDetails=true)',
        minimum: 1,
        maximum: 100,
        default: 10
      }
    }
  }
};

console.log('Schema Validation Test for get_compression_stats\n');
console.log('='.repeat(60));

// Test 1: Tool name validation
const toolNameRegex = /^[a-zA-Z0-9_-]{1,64}$/;
const nameValid = toolNameRegex.test(schema.name);
console.log(`✓ Tool name matches regex: ${nameValid ? 'PASS' : 'FAIL'}`);
console.log(`  Name: ${schema.name}`);

// Test 2: Description length
const descLength = schema.description.length;
console.log(`✓ Description length: ${descLength} chars (${descLength < 255 ? 'PASS' : 'FAIL'})`);

// Test 3: Parameter validation
console.log('\n✓ Parameter Definitions:');
const props = schema.inputSchema.properties;

for (const [paramName, param] of Object.entries(props)) {
  console.log(`\n  ${paramName}:`);
  console.log(`    - Type: ${param.type}`);
  console.log(`    - Description length: ${param.description.length} chars`);
  if (param.default !== undefined) {
    console.log(`    - Default: ${JSON.stringify(param.default)} (optional)`);
  } else {
    console.log(`    - No default (optional)`);
  }
  if (param.minimum !== undefined) {
    console.log(`    - Minimum: ${param.minimum}`);
  }
  if (param.maximum !== undefined) {
    console.log(`    - Maximum: ${param.maximum}`);
  }
  if (param.oneOf) {
    console.log(`    - oneOf patterns: ${param.oneOf.length}`);
  }
}

// Test 4: New parameters check
console.log('\n✓ New Parameters Added:');
console.log(`  - startDate: ${props.startDate ? 'YES' : 'NO'}`);
console.log(`  - endDate: ${props.endDate ? 'YES' : 'NO'}`);
console.log(`  - relativeDays: ${props.relativeDays ? 'YES' : 'NO'}`);

// Test 5: Validation constraints
console.log('\n✓ Validation Constraints:');
console.log(`  - relativeDays has minimum (1): ${props.relativeDays.minimum === 1 ? 'YES' : 'NO'}`);
console.log(`  - relativeDays has maximum (365): ${props.relativeDays.maximum === 365 ? 'YES' : 'NO'}`);

// Test 6: Backward compatibility
console.log('\n✓ Backward Compatibility:');
console.log(`  - period parameter exists: ${props.period ? 'YES' : 'NO'}`);
console.log(`  - period has default: ${props.period.default ? 'YES' : 'NO'}`);

console.log('\n' + '='.repeat(60));
console.log('Schema validation complete!');
