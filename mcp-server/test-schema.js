#!/usr/bin/env node

/**
 * Test script to validate MCP server schema improvements
 */

const fs = require('fs');
const path = require('path');

// Load and parse server.js to extract tool definition
const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

// Create a mock MCPServer class to access the tool definition
class MCPServerTest {
  constructor() {
    this.tools = [];
  }
}

// Evaluate the constructor portion to get tools
const constructorMatch = serverCode.match(/constructor\(\) \{[\s\S]*?this\.tools = \[([\s\S]*?)\];/);
if (!constructorMatch) {
  console.error('❌ Failed to parse tool definition');
  process.exit(1);
}

const toolJson = constructorMatch[1].trim();
let tool;
try {
  // Wrap in array and parse
  eval(`tool = ${toolJson}`);
} catch (e) {
  console.error('❌ Failed to parse tool JSON:', e.message);
  process.exit(1);
}

console.log('=== MCP Server Schema Validation Report ===\n');

// Test 1: Tool name format
const nameRegex = /^[a-zA-Z0-9_-]{1,64}$/;
const nameValid = nameRegex.test(tool.name);
console.log(`✓ Tool name format: ${tool.name} ${nameValid ? '✓' : '✗'}`);
if (!nameValid) {
  console.error(`  ERROR: Name must match ${nameRegex}`);
}

// Test 2: Description length
const descLength = tool.description.length;
console.log(`✓ Description length: ${descLength} chars ${descLength <= 255 ? '✓' : '✗'}`);
if (descLength > 255) {
  console.error(`  ERROR: Description exceeds 255 character limit`);
}

// Test 3: JSON Schema validation constraints
console.log('\n=== Parameter Validation Constraints ===');

const props = tool.inputSchema.properties;
const checks = {
  'path has minLength': props.path.minLength !== undefined,
  'path has maxLength': props.path.maxLength !== undefined,
  'level has oneOf': props.level.oneOf !== undefined,
  'level has default': props.level.default !== undefined,
  'language has oneOf': props.language.oneOf !== undefined,
  'format has oneOf': props.format.oneOf !== undefined,
  'format has default': props.format.default !== undefined,
  'include has items schema': props.include.items !== undefined,
  'include has minItems': props.include.minItems !== undefined,
  'exclude has items schema': props.exclude.items !== undefined,
  'exclude has minItems': props.exclude.minItems !== undefined,
  'limit has minimum': props.limit.minimum !== undefined,
  'limit has maximum': props.limit.maximum !== undefined,
  'offset has minimum': props.offset.minimum !== undefined,
  'offset has default': props.offset.default !== undefined
};

for (const [check, passed] of Object.entries(checks)) {
  console.log(`  ${passed ? '✓' : '✗'} ${check}`);
}

// Test 4: Enum to oneOf conversion
console.log('\n=== Enum Pattern (oneOf vs enum) ===');
const enumParams = ['level', 'language', 'format'];
for (const param of enumParams) {
  const hasEnum = props[param].enum !== undefined;
  const hasOneOf = props[param].oneOf !== undefined;
  console.log(`  ${param}: enum=${hasEnum}, oneOf=${hasOneOf} ${hasOneOf ? '✓' : '✗'}`);
}

// Test 5: Output schema
console.log('\n=== Output Schema ===');
console.log(`  Has outputSchema: ${tool.outputSchema !== undefined ? '✓' : '✗'}`);
if (tool.outputSchema) {
  console.log(`  Properties defined: ${Object.keys(tool.outputSchema.properties || {}).join(', ')}`);
}

// Test 6: Annotations
console.log('\n=== Tool Annotations ===');
console.log(`  Has annotations: ${tool.annotations !== undefined ? '✓' : '✗'}`);
if (tool.annotations) {
  const annotations = tool.annotations;
  console.log(`  audience: ${JSON.stringify(annotations.audience)} ${annotations.audience ? '✓' : '✗'}`);
  console.log(`  priority: ${annotations.priority} ${annotations.priority !== undefined ? '✓' : '✗'}`);
  console.log(`  readOnlyHint: ${annotations.readOnlyHint} ${annotations.readOnlyHint !== undefined ? '✓' : '✗'}`);
  console.log(`  destructiveHint: ${annotations.destructiveHint} ${annotations.destructiveHint !== undefined ? '✓' : '✗'}`);
  console.log(`  openWorldHint: ${annotations.openWorldHint} ${annotations.openWorldHint !== undefined ? '✓' : '✗'}`);
}

// Test 7: Parameter descriptions
console.log('\n=== Parameter Description Lengths ===');
for (const [param, schema] of Object.entries(props)) {
  const desc = schema.description || '';
  const length = desc.length;
  const status = length <= 150 ? '✓' : '⚠';
  console.log(`  ${param}: ${length} chars ${status}`);
}

// Summary
console.log('\n=== Summary ===');
const allPassed = nameValid && descLength <= 255 && tool.outputSchema && tool.annotations;
console.log(`Overall: ${allPassed ? '✓ PASSED' : '✗ NEEDS WORK'}`);

// Calculate discoverability score
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
const validationChecks = Object.values(checks).filter(v => v).length;
score += Math.round((validationChecks / Object.keys(checks).length) * 20);

// oneOf pattern (15 points)
maxScore += 15;
const oneOfCount = enumParams.filter(p => props[p].oneOf !== undefined).length;
score += Math.round((oneOfCount / enumParams.length) * 15);

// Output schema (20 points)
maxScore += 20;
if (tool.outputSchema) score += 20;

// Annotations (20 points)
maxScore += 20;
if (tool.annotations) score += 20;

console.log(`\nDiscoverability Score: ${score}/${maxScore} (${Math.round((score/maxScore)*100)}%)`);

if (score < maxScore) {
  console.log('\nRecommendations:');
  if (!nameValid) console.log('  - Fix tool name format');
  if (descLength > 255) console.log('  - Shorten description');
  if (validationChecks < Object.keys(checks).length) console.log('  - Add missing validation constraints');
  if (oneOfCount < enumParams.length) console.log('  - Convert remaining enums to oneOf');
  if (!tool.outputSchema) console.log('  - Add outputSchema');
  if (!tool.annotations) console.log('  - Add tool annotations');
}

process.exit(allPassed ? 0 : 1);
