/**
 * Test suite for compact format
 * Validates that compact format:
 * - Has minimal overhead
 * - Removes markdown formatting
 * - Preserves content
 * - Achieves token savings vs text format
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to ucpl-compress script
const COMPRESS_SCRIPT = path.join(__dirname, "../scripts/ucpl-compress");

describe("Compact Format Tests", () => {
  test("should not contain markdown headers (#, ##)", () => {
    const output = execSync(
      `${COMPRESS_SCRIPT} ${__dirname}/fixtures/server-sample.js --format compact --level full`,
    ).toString();

    // Should not have markdown headers
    assert.strictEqual(output.includes("# "), false, "Found markdown H1 header");
    assert.strictEqual(output.includes("## "), false, "Found markdown H2 header");
  });

  test("should not contain bold markers (**)", () => {
    const output = execSync(
      `${COMPRESS_SCRIPT} ${__dirname}/fixtures/server-sample.js --format compact --level full`,
    ).toString();

    // Should not have bold markers
    assert.strictEqual(
      output.includes("**"),
      false,
      "Found bold markdown markers",
    );
  });

  test("should not contain markdown bullets (* or - at line start)", () => {
    const output = execSync(
      `${COMPRESS_SCRIPT} ${__dirname}/fixtures/server-sample.js --format compact --level full`,
    ).toString();

    // Should not have bullet points at line start (but dashes in other contexts are OK)
    const lines = output.split("\n");
    const hasBullets = lines.some(
      (line) =>
        line.trim().startsWith("* ") || line.trim().startsWith("- "),
    );

    assert.strictEqual(hasBullets, false, "Found markdown bullet points");
  });

  test("should not contain 80-char separators", () => {
    const output = execSync(
      `${COMPRESS_SCRIPT} ${__dirname}/fixtures/server-sample.js --format compact --level full`,
    ).toString();

    // Should not have long dash separators
    assert.strictEqual(
      output.includes("-".repeat(40)),
      false,
      "Found separator line",
    );
  });

  test("should use fewer tokens than text format", () => {
    const textOutput = execSync(
      `${COMPRESS_SCRIPT} ${__dirname}/fixtures/server-sample.js --format text --level full`,
    ).toString();

    const compactOutput = execSync(
      `${COMPRESS_SCRIPT} ${__dirname}/fixtures/server-sample.js --format compact --level full`,
    ).toString();

    // Compact should be shorter
    assert.ok(
      compactOutput.length < textOutput.length,
      `Compact (${compactOutput.length} chars) should be shorter than text (${textOutput.length} chars)`,
    );

    // Calculate savings
    const savings =
      ((textOutput.length - compactOutput.length) / textOutput.length) * 100;

    // Should achieve at least 15% savings
    assert.ok(
      savings >= 15,
      `Expected at least 15% savings, got ${savings.toFixed(1)}%`,
    );

    console.log(
      `      ✓ Token savings: ${savings.toFixed(1)}% (${textOutput.length} → ${compactOutput.length} chars)`,
    );
  });

  test("should preserve function/class names", () => {
    const output = execSync(
      `${COMPRESS_SCRIPT} ${__dirname}/fixtures/server-sample.js --format compact --level full`,
    ).toString();

    // Should still contain function names
    assert.ok(
      output.includes("detectLLMClient"),
      "Missing function name detectLLMClient",
    );
    assert.ok(
      output.includes("calculateCostSavings"),
      "Missing function name calculateCostSavings",
    );
  });

  test("should handle directory compression with pagination", () => {
    const output = execSync(
      `${COMPRESS_SCRIPT} ${__dirname} --format compact --level full --limit 3`,
    ).toString();

    // Should have minimal header
    assert.ok(output.includes("==="), "Missing compact format header");

    // Should have pagination hint
    assert.ok(
      output.includes("offset") && output.includes("limit"),
      "Missing pagination hint",
    );

    // Should not have markdown formatting
    assert.strictEqual(output.includes("# "), false, "Found markdown headers");
    assert.strictEqual(output.includes("**"), false, "Found bold markers");
  });

  test("should handle error cases gracefully", () => {
    // Non-existent file
    try {
      execSync(
        `${COMPRESS_SCRIPT} /nonexistent/file.js --format compact --level full 2>&1`,
      ).toString();
      assert.fail("Should have thrown error for nonexistent file");
    } catch (error) {
      // Should fail gracefully
      assert.ok(error.message.includes("No such file or directory") || error.message.includes("ENOENT"));
    }
  });

  test("should work with all compression levels", () => {
    const levels = ["full", "signatures", "minimal"];

    for (const level of levels) {
      const output = execSync(
        `${COMPRESS_SCRIPT} ${__dirname}/fixtures/server-sample.js --format compact --level ${level}`,
      ).toString();

      // Should produce output
      assert.ok(output.length > 0, `No output for level ${level}`);

      // Should not have markdown
      assert.strictEqual(
        output.includes("**"),
        false,
        `Found markdown in ${level} level`,
      );
    }
  });

  test("should remove excessive blank lines", () => {
    const output = execSync(
      `${COMPRESS_SCRIPT} ${__dirname}/fixtures/server-sample.js --format compact --level full`,
    ).toString();

    // Should not have more than 2 consecutive newlines
    assert.strictEqual(
      output.includes("\n\n\n"),
      false,
      "Found excessive blank lines (3+)",
    );
  });

  test("should have minimal pagination hints", () => {
    const output = execSync(
      `${COMPRESS_SCRIPT} ${__dirname} --format compact --level full --limit 3`,
    ).toString();

    // Extract pagination hint
    const lines = output.split("\n");
    const paginationLine = lines.find((line) => line.includes("offset"));

    if (paginationLine) {
      // Pagination hint should be concise (< 100 chars)
      assert.ok(
        paginationLine.length < 100,
        `Pagination hint too verbose: ${paginationLine.length} chars`,
      );
    }
  });
});
