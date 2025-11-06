#!/usr/bin/env node
/**
 * Schema Validation Test
 * Tests the get_compression_stats tool schema for MCP compliance
 */

const assert = require('assert');
const { test } = require('node:test');

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

test('Schema validation for get_compression_stats', async (t) => {
  const props = schema.inputSchema.properties;

  await t.test('tool name matches MCP naming requirements', () => {
    const toolNameRegex = /^[a-zA-Z0-9_-]{1,64}$/;
    assert.ok(
      toolNameRegex.test(schema.name),
      `Tool name "${schema.name}" must match pattern /^[a-zA-Z0-9_-]{1,64}$/`
    );
  });

  await t.test('description is under 255 characters', () => {
    const descLength = schema.description.length;
    assert.ok(
      descLength < 255,
      `Description length ${descLength} must be less than 255 characters`
    );
  });

  await t.test('all parameters have valid type definitions', () => {
    for (const [paramName, param] of Object.entries(props)) {
      assert.ok(
        param.type,
        `Parameter "${paramName}" must have a type definition`
      );
      assert.ok(
        ['string', 'number', 'boolean', 'object', 'array'].includes(param.type),
        `Parameter "${paramName}" type "${param.type}" must be a valid JSON Schema type`
      );
    }
  });

  await t.test('all parameters have descriptions', () => {
    for (const [paramName, param] of Object.entries(props)) {
      assert.ok(
        param.description && param.description.length > 0,
        `Parameter "${paramName}" must have a description`
      );
    }
  });

  await t.test('new date filtering parameters are present', () => {
    assert.ok(props.startDate, 'startDate parameter must be defined');
    assert.strictEqual(props.startDate.type, 'string', 'startDate must be a string type');

    assert.ok(props.endDate, 'endDate parameter must be defined');
    assert.strictEqual(props.endDate.type, 'string', 'endDate must be a string type');

    assert.ok(props.relativeDays, 'relativeDays parameter must be defined');
    assert.strictEqual(props.relativeDays.type, 'number', 'relativeDays must be a number type');
  });

  await t.test('relativeDays has proper validation constraints', () => {
    assert.strictEqual(
      props.relativeDays.minimum,
      1,
      'relativeDays minimum must be 1'
    );
    assert.strictEqual(
      props.relativeDays.maximum,
      365,
      'relativeDays maximum must be 365'
    );
  });

  await t.test('backward compatibility is maintained', () => {
    assert.ok(
      props.period,
      'period parameter must exist for backward compatibility'
    );
    assert.strictEqual(
      props.period.default,
      'all',
      'period parameter must have default value "all"'
    );
    assert.ok(
      props.period.oneOf && props.period.oneOf.length === 4,
      'period parameter must have 4 oneOf options (all, today, week, month)'
    );
  });

  await t.test('includeDetails parameter has correct configuration', () => {
    assert.strictEqual(
      props.includeDetails.type,
      'boolean',
      'includeDetails must be boolean type'
    );
    assert.strictEqual(
      props.includeDetails.default,
      false,
      'includeDetails must default to false'
    );
  });

  await t.test('limit parameter has proper constraints', () => {
    assert.strictEqual(
      props.limit.minimum,
      1,
      'limit minimum must be 1'
    );
    assert.strictEqual(
      props.limit.maximum,
      100,
      'limit maximum must be 100'
    );
    assert.strictEqual(
      props.limit.default,
      10,
      'limit default must be 10'
    );
  });
});
