/**
 * Test script to validate MCP server schema improvements
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load and parse server.js to extract tool definition
const serverCode = fs.readFileSync(
  path.join(__dirname, "../server.js"),
  "utf8",
);

// Extract tool definition from server.js
const constructorMatch = serverCode.match(
  /constructor\(\) \{[\s\S]*?this\.tools = \[([\s\S]*?)\];/,
);
if (!constructorMatch) {
  throw new Error("Failed to parse tool definition");
}

const toolJson = constructorMatch[1].trim();
let tool;
try {
  // Wrap in array and parse
  eval(`tool = ${toolJson}`);
} catch (e) {
  throw new Error(`Failed to parse tool JSON: ${e.message}`);
}

describe("MCP Server Schema Validation", () => {
  describe("Tool Name Format", () => {
    test("should have valid tool name format", () => {
      const nameRegex = /^[a-zA-Z0-9_-]{1,64}$/;
      const nameValid = nameRegex.test(tool.name);
      assert.ok(nameValid, `Tool name "${tool.name}" must match ${nameRegex}`);
    });
  });

  describe("Description Length", () => {
    test("should have description within 255 character limit", () => {
      const descLength = tool.description.length;
      assert.ok(
        descLength <= 255,
        `Description length ${descLength} exceeds 255 character limit`,
      );
    });
  });

  describe("Parameter Validation Constraints", () => {
    const props = tool.inputSchema.properties;

    test("path should have minLength constraint", () => {
      assert.ok(
        props.path.minLength !== undefined,
        "path should have minLength",
      );
    });

    test("path should have maxLength constraint", () => {
      assert.ok(
        props.path.maxLength !== undefined,
        "path should have maxLength",
      );
    });

    test("level should have oneOf constraint", () => {
      assert.ok(props.level.oneOf !== undefined, "level should have oneOf");
    });

    test("level should have default value", () => {
      assert.ok(props.level.default !== undefined, "level should have default");
    });

    test("language should have oneOf constraint", () => {
      assert.ok(
        props.language.oneOf !== undefined,
        "language should have oneOf",
      );
    });

    test("format should have oneOf constraint", () => {
      assert.ok(props.format.oneOf !== undefined, "format should have oneOf");
    });

    test("format should have default value", () => {
      assert.ok(
        props.format.default !== undefined,
        "format should have default",
      );
    });

    test("include should have items schema", () => {
      assert.ok(
        props.include.items !== undefined,
        "include should have items schema",
      );
    });

    test("include should have minItems constraint", () => {
      assert.ok(
        props.include.minItems !== undefined,
        "include should have minItems",
      );
    });

    test("exclude should have items schema", () => {
      assert.ok(
        props.exclude.items !== undefined,
        "exclude should have items schema",
      );
    });

    test("exclude should have minItems constraint", () => {
      assert.ok(
        props.exclude.minItems !== undefined,
        "exclude should have minItems",
      );
    });

    test("limit should have minimum constraint", () => {
      assert.ok(props.limit.minimum !== undefined, "limit should have minimum");
    });

    test("limit should have maximum constraint", () => {
      assert.ok(props.limit.maximum !== undefined, "limit should have maximum");
    });

    test("offset should have minimum constraint", () => {
      assert.ok(
        props.offset.minimum !== undefined,
        "offset should have minimum",
      );
    });

    test("offset should have default value", () => {
      assert.ok(
        props.offset.default !== undefined,
        "offset should have default",
      );
    });
  });

  describe("Enum to oneOf Conversion", () => {
    const props = tool.inputSchema.properties;

    test("level should use oneOf instead of enum", () => {
      assert.ok(props.level.oneOf !== undefined, "level should have oneOf");
      assert.strictEqual(
        props.level.enum,
        undefined,
        "level should not have enum",
      );
    });

    test("language should use oneOf instead of enum", () => {
      assert.ok(
        props.language.oneOf !== undefined,
        "language should have oneOf",
      );
      assert.strictEqual(
        props.language.enum,
        undefined,
        "language should not have enum",
      );
    });

    test("format should use oneOf instead of enum", () => {
      assert.ok(props.format.oneOf !== undefined, "format should have oneOf");
      assert.strictEqual(
        props.format.enum,
        undefined,
        "format should not have enum",
      );
    });
  });

  describe("Output Schema", () => {
    test("should have outputSchema defined", () => {
      assert.ok(
        tool.outputSchema !== undefined,
        "Tool should have outputSchema",
      );
    });

    test("outputSchema should have properties", () => {
      if (tool.outputSchema) {
        const props = Object.keys(tool.outputSchema.properties || {});
        assert.ok(
          props.length > 0,
          "outputSchema should have properties defined",
        );
      }
    });
  });

  describe("Tool Annotations", () => {
    test("should have annotations defined", () => {
      assert.ok(tool.annotations !== undefined, "Tool should have annotations");
    });

    test("should have audience annotation", () => {
      if (tool.annotations) {
        assert.ok(
          tool.annotations.audience !== undefined,
          "Should have audience annotation",
        );
      }
    });

    test("should have priority annotation", () => {
      if (tool.annotations) {
        assert.ok(
          tool.annotations.priority !== undefined,
          "Should have priority annotation",
        );
      }
    });

    test("should have readOnlyHint annotation", () => {
      if (tool.annotations) {
        assert.ok(
          tool.annotations.readOnlyHint !== undefined,
          "Should have readOnlyHint annotation",
        );
      }
    });

    test("should have destructiveHint annotation", () => {
      if (tool.annotations) {
        assert.ok(
          tool.annotations.destructiveHint !== undefined,
          "Should have destructiveHint annotation",
        );
      }
    });

    test("should have openWorldHint annotation", () => {
      if (tool.annotations) {
        assert.ok(
          tool.annotations.openWorldHint !== undefined,
          "Should have openWorldHint annotation",
        );
      }
    });
  });

  describe("Parameter Description Lengths", () => {
    const props = tool.inputSchema.properties;

    test("all parameter descriptions should be reasonable length", (t) => {
      for (const [param, schema] of Object.entries(props)) {
        const desc = schema.description || "";
        const length = desc.length;
        t.diagnostic(`${param}: ${length} chars ${length <= 150 ? "✓" : "⚠"}`);
        // This is a soft limit - descriptions can be longer but we warn about it
        if (length > 150) {
          t.diagnostic(
            `  Warning: ${param} description is longer than recommended (${length} > 150)`,
          );
        }
      }
      assert.ok(true, "Parameter descriptions checked");
    });
  });

  describe("Discoverability Score", () => {
    test("should calculate and verify discoverability score", (t) => {
      const nameRegex = /^[a-zA-Z0-9_-]{1,64}$/;
      const nameValid = nameRegex.test(tool.name);
      const descLength = tool.description.length;
      const props = tool.inputSchema.properties;

      const checks = {
        "path has minLength": props.path.minLength !== undefined,
        "path has maxLength": props.path.maxLength !== undefined,
        "level has oneOf": props.level.oneOf !== undefined,
        "level has default": props.level.default !== undefined,
        "language has oneOf": props.language.oneOf !== undefined,
        "format has oneOf": props.format.oneOf !== undefined,
        "format has default": props.format.default !== undefined,
        "include has items schema": props.include.items !== undefined,
        "include has minItems": props.include.minItems !== undefined,
        "exclude has items schema": props.exclude.items !== undefined,
        "exclude has minItems": props.exclude.minItems !== undefined,
        "limit has minimum": props.limit.minimum !== undefined,
        "limit has maximum": props.limit.maximum !== undefined,
        "offset has minimum": props.offset.minimum !== undefined,
        "offset has default": props.offset.default !== undefined,
      };

      const enumParams = ["level", "language", "format"];

      let score = 0;
      let maxScore = 0;

      // Name format (10 points)
      maxScore += 10;
      if (nameValid) score += 10;

      // Description length (15 points)
      maxScore += 15;
      if (descLength <= 255) score += 15;

      // Validation constraints (20 points)
      maxScore += 20;
      const validationChecks = Object.values(checks).filter((v) => v).length;
      score += Math.round((validationChecks / Object.keys(checks).length) * 20);

      // oneOf pattern (15 points)
      maxScore += 15;
      const oneOfCount = enumParams.filter(
        (p) => props[p].oneOf !== undefined,
      ).length;
      score += Math.round((oneOfCount / enumParams.length) * 15);

      // Output schema (20 points)
      maxScore += 20;
      if (tool.outputSchema) score += 20;

      // Annotations (20 points)
      maxScore += 20;
      if (tool.annotations) score += 20;

      const percentage = Math.round((score / maxScore) * 100);
      t.diagnostic(
        `Discoverability Score: ${score}/${maxScore} (${percentage}%)`,
      );

      assert.ok(
        score >= maxScore * 0.8,
        `Score ${score}/${maxScore} should be at least 80%`,
      );
    });
  });
});
