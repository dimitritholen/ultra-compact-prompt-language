/**
 * Schema Validation Test
 * Tests the get_compression_stats tool schema for MCP compliance
 *
 * Migrated to node:test format.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Extract the schema from server.js
const schema = {
  name: "get_compression_stats",
  description:
    "Retrieve token savings statistics for code compressions with flexible date queries. Shows actual token counts (not estimates) for compressions within specified time period using period presets, custom date ranges, or relative days.",
  inputSchema: {
    type: "object",
    properties: {
      period: {
        type: "string",
        description:
          "Time period preset to filter statistics (backward compatible)",
        default: "all",
        oneOf: [
          {
            const: "all",
            title: "All Time",
            description: "All compression statistics ever recorded",
          },
          {
            const: "today",
            title: "Today",
            description: "Compressions from the last 24 hours",
          },
          {
            const: "week",
            title: "This Week",
            description: "Compressions from the last 7 days",
          },
          {
            const: "month",
            title: "This Month",
            description: "Compressions from the last 30 days",
          },
        ],
      },
      startDate: {
        type: "string",
        description:
          'Start date for custom date range. Accepts ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ) or relative time strings (e.g., "2 hours ago", "yesterday", "last week"). Optional - if omitted, no start boundary is applied.',
      },
      endDate: {
        type: "string",
        description:
          'End date for custom date range. Accepts ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ) or relative time strings (e.g., "now", "today", "1 hour ago"). Optional - if omitted, defaults to current time.',
      },
      relativeDays: {
        type: "number",
        description:
          "Number of days to look back from now. Alternative to startDate/endDate for simple queries. Example: relativeDays=7 returns compressions from last 7 days. Must be between 1 and 365.",
        minimum: 1,
        maximum: 365,
      },
      includeDetails: {
        type: "boolean",
        description:
          "Include individual compression records (not just summary)",
        default: false,
      },
      limit: {
        type: "number",
        description:
          "Maximum number of individual records to return (when includeDetails=true)",
        minimum: 1,
        maximum: 100,
        default: 10,
      },
    },
  },
};

describe("Schema Validation for get_compression_stats", () => {
  test("Tool name matches regex", () => {
    const toolNameRegex = /^[a-zA-Z0-9_-]{1,64}$/;
    const nameValid = toolNameRegex.test(schema.name);
    assert.ok(
      nameValid,
      `Tool name "${schema.name}" should match regex pattern`,
    );
  });

  test("Description length is reasonable", () => {
    const descLength = schema.description.length;
    assert.ok(
      descLength < 255,
      `Description length (${descLength}) should be under 255 chars`,
    );
    assert.ok(descLength > 0, "Description should not be empty");
  });

  describe("Parameter Definitions", () => {
    const props = schema.inputSchema.properties;

    test("All parameters have type", () => {
      for (const [paramName, param] of Object.entries(props)) {
        assert.ok(param.type, `Parameter "${paramName}" should have a type`);
      }
    });

    test("All parameters have description", () => {
      for (const [paramName, param] of Object.entries(props)) {
        assert.ok(
          param.description,
          `Parameter "${paramName}" should have a description`,
        );
        assert.ok(
          param.description.length > 0,
          `Parameter "${paramName}" description should not be empty`,
        );
      }
    });

    test("Optional parameters have defaults or are marked optional", () => {
      for (const [paramName, param] of Object.entries(props)) {
        const hasDefault = param.default !== undefined;
        const isInRequired =
          schema.inputSchema.required?.includes(paramName) || false;

        // If not required, it's optional (which is fine for MCP)
        assert.ok(
          hasDefault || !isInRequired,
          `Parameter "${paramName}" is optional (has default or not required)`,
        );
      }
    });
  });

  describe("New Parameters", () => {
    const props = schema.inputSchema.properties;

    test("startDate parameter exists", () => {
      assert.ok(props.startDate, "startDate parameter should exist");
      assert.strictEqual(props.startDate.type, "string");
    });

    test("endDate parameter exists", () => {
      assert.ok(props.endDate, "endDate parameter should exist");
      assert.strictEqual(props.endDate.type, "string");
    });

    test("relativeDays parameter exists", () => {
      assert.ok(props.relativeDays, "relativeDays parameter should exist");
      assert.strictEqual(props.relativeDays.type, "number");
    });
  });

  describe("Validation Constraints", () => {
    const props = schema.inputSchema.properties;

    test("relativeDays has minimum constraint", () => {
      assert.strictEqual(
        props.relativeDays.minimum,
        1,
        "relativeDays should have minimum of 1",
      );
    });

    test("relativeDays has maximum constraint", () => {
      assert.strictEqual(
        props.relativeDays.maximum,
        365,
        "relativeDays should have maximum of 365",
      );
    });

    test("limit has valid constraints", () => {
      assert.strictEqual(
        props.limit.minimum,
        1,
        "limit should have minimum of 1",
      );
      assert.strictEqual(
        props.limit.maximum,
        100,
        "limit should have maximum of 100",
      );
    });
  });

  describe("Backward Compatibility", () => {
    const props = schema.inputSchema.properties;

    test("period parameter exists", () => {
      assert.ok(
        props.period,
        "period parameter should exist for backward compatibility",
      );
    });

    test("period has default", () => {
      assert.strictEqual(
        props.period.default,
        "all",
        'period should have default value "all"',
      );
    });

    test("period has oneOf options", () => {
      assert.ok(
        Array.isArray(props.period.oneOf),
        "period should have oneOf array",
      );
      assert.strictEqual(
        props.period.oneOf.length,
        4,
        "period should have 4 options",
      );
    });
  });
});
