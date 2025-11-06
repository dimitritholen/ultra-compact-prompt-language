# MCP Server Development Best Practices: API Discoverability Reference

**Research Date:** 2025-11-05
**Target Audience:** Developers building Model Context Protocol servers
**Focus:** LLM auto-discovery without explicit prompting

---

## Executive Summary

The Model Context Protocol (MCP) enables LLMs to auto-discover tools through structured JSON Schema metadata, eliminating the need for manual prompt instructions. This document synthesizes best practices from official specifications, production implementations, and community patterns.

**Key Finding:** Tool discoverability depends on three critical factors:
1. **Schema Quality** - Detailed JSON Schema with clear types and constraints
2. **Description Clarity** - Concise, action-oriented descriptions
3. **Parameter Design** - Explicit required/optional fields with defaults and validation

---

## 1. Tool Discovery Mechanism

### 1.1 How LLMs Discover Tools

MCP follows a standardized discovery protocol[^1]:

```
1. Client sends: tools/list request
2. Server returns: Tool definitions with schemas
3. LLM analyzes: Names, descriptions, inputSchemas
4. LLM selects: Appropriate tool based on context
5. Client invokes: tools/call with arguments
```

**Dynamic Updates:** Servers emit `notifications/tools/list_changed` when tool availability changes[^2].

### 1.2 Tool Definition Structure

Every MCP tool contains[^3]:

```json
{
  "name": "search_documents",
  "title": "Search Documents",
  "description": "Search through indexed documents using semantic or keyword matching",
  "inputSchema": {
    "type": "object",
    "properties": { /* ... */ },
    "required": ["query"]
  },
  "outputSchema": { /* Optional */ },
  "annotations": { /* Optional metadata */ }
}
```

---

## 2. Naming Conventions

### 2.1 Tool Name Requirements

**Format:** Must match regex `^[a-zA-Z0-9_-]{1,64}$`[^4]

**Style:** Use `snake_case` for optimal GPT-4o tokenization[^5]:
```
✓ get_user_data
✓ search_documents
✓ create_backup
✗ getUserData (camelCase not recommended)
✗ search.documents (dots not allowed)
✗ create backup (spaces not allowed)
```

**Service Prefixing:** Recommended for multi-service servers[^6]:
```
github_create_issue
github_add_comment
github_list_pulls
```

Benefits:
- Groups related functions together
- Prevents name collisions
- Clarifies service ownership

### 2.2 Consistency Principle

**Critical:** Choose one convention and maintain it throughout. Inconsistency signals poor quality to LLMs[^7].

---

## 3. Description Writing Guidelines

### 3.1 Tool Descriptions

**Formula:** What + Why + What Action

**Length:** Keep under 255 characters for optimal parsing

**Examples:**

```
✓ "Search the web for current information and return top results"

✓ "Fetch file contents from repository. Returns raw content or error if file not found"

✓ "Execute SQL query against database. Validates syntax before execution"

✗ "Does stuff with files" (too vague)

✗ "This tool provides comprehensive functionality for performing various operations related to document management and retrieval across multiple storage backends with support for..." (too verbose)
```

**Best Practice:** Each tool should have a unique name that explains its function clearly and a description that highlights what the tool does, what its purpose is, and the specific action(s) it takes[^8].

### 3.2 Parameter Descriptions

**Formula:** Type + Purpose + Constraints

```json
{
  "query": {
    "type": "string",
    "description": "Search query string (max 500 characters)"
  },
  "limit": {
    "type": "integer",
    "description": "Maximum results to return (1-100)",
    "minimum": 1,
    "maximum": 100,
    "default": 10
  },
  "sort_by": {
    "type": "string",
    "description": "Sort order for results",
    "enum": ["relevance", "date", "popularity"],
    "default": "relevance"
  }
}
```

**Avoid Ambiguity:** Your LLM can easily perform the wrong action if the MCP server's tools aren't descriptive, comprehensive, and unique from one another[^9].

---

## 4. JSON Schema Design

### 4.1 Parameter Types and Validation

**Primitive Types:**
- `string` - Text data
- `number` - Numeric values (float)
- `integer` - Whole numbers
- `boolean` - True/false

**Complex Types:**
- `array` - Lists of items
- `object` - Nested structures

**Validation Constraints:**

```json
{
  "email": {
    "type": "string",
    "format": "email",
    "minLength": 5,
    "maxLength": 100,
    "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
  },
  "age": {
    "type": "integer",
    "minimum": 0,
    "maximum": 150
  },
  "tags": {
    "type": "array",
    "items": {"type": "string"},
    "minItems": 1,
    "maxItems": 10
  }
}
```

### 4.2 Enums and Restricted Values

**Simple Enum:**
```json
{
  "priority": {
    "type": "string",
    "enum": ["low", "medium", "high"],
    "default": "medium"
  }
}
```

**Enum with Descriptions (oneOf pattern):**[^10]
```json
{
  "color": {
    "type": "string",
    "description": "Choose your favorite color",
    "oneOf": [
      {"const": "#FF0000", "title": "Red"},
      {"const": "#00FF00", "title": "Green"},
      {"const": "#0000FF", "title": "Blue"}
    ]
  }
}
```

**Note:** MCP is deprecating non-standard `enumNames` in favor of `oneOf` pattern[^11].

### 4.3 Required vs Optional Parameters

**Rule:** Parameters with `default` values are optional. Others are required[^12].

```json
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Search query (required)"
      },
      "limit": {
        "type": "integer",
        "default": 10,
        "description": "Max results (optional)"
      }
    },
    "required": ["query"]
  }
}
```

### 4.4 Advanced Patterns

**anyOf - Multiple Valid Types:**
```json
{
  "identifier": {
    "anyOf": [
      {"type": "string", "pattern": "^[A-Z]{3}[0-9]{3}$"},
      {"type": "integer", "minimum": 1}
    ]
  }
}
```

**oneOf - Exactly One Match:**
```json
{
  "search": {
    "oneOf": [
      {
        "type": "object",
        "properties": {"id": {"type": "string"}},
        "required": ["id"]
      },
      {
        "type": "object",
        "properties": {"name": {"type": "string"}},
        "required": ["name"]
      }
    ]
  }
}
```

**Client Compatibility Note:** Claude Desktop supports `anyOf` at root level, but some clients don't support union types[^13].

---

## 5. Output Schemas and Structured Responses

### 5.1 Output Schema Declaration

Declare expected response structure for validation[^14]:

```json
{
  "name": "get_weather",
  "outputSchema": {
    "type": "object",
    "properties": {
      "temperature": {"type": "number"},
      "conditions": {"type": "string"},
      "humidity": {"type": "integer"}
    },
    "required": ["temperature", "conditions"]
  }
}
```

### 5.2 Content Types

MCP supports multiple content types[^15]:

- **TextContent** - Plain text responses
- **ImageContent** - Base64-encoded images with MIME type
- **AudioContent** - Base64-encoded audio
- **ResourceLink** - References to external resources
- **EmbeddedResource** - Inline resource content

### 5.3 Structured Content Field

Return both serialized and structured data[^16]:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"temperature\": 22.5, \"conditions\": \"Partly cloudy\"}"
    }
  ],
  "structuredContent": {
    "temperature": 22.5,
    "conditions": "Partly cloudy"
  }
}
```

**Philosophy:** Tools SHOULD provide structured results, clients SHOULD validate them. Flexibility is key for handling AI-generated variations[^17].

---

## 6. Annotations and Metadata

### 6.1 Tool Annotations

Optional metadata that informs client behavior[^18]:

```json
{
  "annotations": {
    "audience": ["user", "assistant"],
    "priority": 0.8,
    "readOnlyHint": true,
    "destructiveHint": false,
    "openWorldHint": false
  }
}
```

**Annotation Types:**

- **audience** - Who should see this (`["user"]`, `["assistant"]`, both)
- **priority** - Importance scale (0.0=optional, 1.0=required)
- **readOnlyHint** - Tool only reads data, no modifications
- **destructiveHint** - Tool performs destructive operations
- **openWorldHint** - Tool interacts with external systems

**Important:** Annotations are advisory hints only. They don't enforce behavior[^19].

### 6.2 Use Cases

- **Human-in-the-Loop:** Flag destructive operations for confirmation
- **Access Control:** Mark tools requiring elevated permissions
- **UI Rendering:** Prioritize important tools in client interfaces

---

## 7. Pagination and Token Limits

### 7.1 MCP Response Limit

**Hard Limit:** 25,000 tokens per tool response[^20]

**Problem:** Large datasets exceed this limit, causing errors

**Solution:** Implement pagination in tool design

### 7.2 Pagination Patterns

**MCP Standard: Cursor-Based**[^21]

```json
{
  "inputSchema": {
    "properties": {
      "cursor": {
        "type": "string",
        "description": "Opaque pagination cursor (optional)"
      },
      "page_size": {
        "type": "integer",
        "default": 50,
        "description": "Results per page"
      }
    }
  }
}
```

**Alternative: Limit-Offset** (for backwards compatibility)

```json
{
  "limit": {
    "type": "integer",
    "description": "Maximum items to return (1-100)",
    "minimum": 1,
    "maximum": 100,
    "default": 25
  },
  "offset": {
    "type": "integer",
    "description": "Number of items to skip",
    "minimum": 0,
    "default": 0
  }
}
```

### 7.3 Best Practices

1. **Avoid limit-offset for large datasets** - Performance degrades with high offsets[^22]
2. **Prefer cursor-based pagination** - Scales to millions of records[^23]
3. **Validate pagination parameters** - Prevent malicious requests
4. **Set reasonable defaults** - limit=25-50 for most use cases
5. **Document pagination clearly** - Include examples in descriptions

### 7.4 Real-World Example

From ucpl-compress MCP server:

```json
{
  "limit": {
    "type": "number",
    "description": "CRITICAL FOR DIRECTORIES: Maximum files to process. REQUIRED for directories with >20 files to avoid exceeding 25K token limit. RECOMMENDED VALUES: level=minimal → limit=50, level=signatures → limit=30, level=full → limit=20."
  },
  "offset": {
    "type": "number",
    "default": 0,
    "description": "Files to skip before processing (for pagination). Use with limit to paginate through large directories. Example: limit=30,offset=0 → files 1-30, limit=30,offset=30 → files 31-60."
  }
}
```

---

## 8. Error Handling

### 8.1 Error Architecture

MCP defines three error levels[^24]:

**1. Transport-Level Errors**
- Network timeouts
- Connection failures
- Authentication errors
- Handled by transport layer (stdio, HTTP, SSE)

**2. Protocol-Level Errors**
- JSON-RPC 2.0 violations
- Malformed requests
- Invalid methods
- Return standardized error codes

**3. Application-Level Errors**
- Business logic failures
- External API errors
- Resource constraints
- Use `isError` flag in tool response

### 8.2 JSON-RPC Error Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Internal server error",
    "data": {
      "details": "Database connection failed",
      "retry_after": 30
    }
  }
}
```

**Standard Error Codes:**
- `-32700` - Parse error (invalid JSON)
- `-32600` - Invalid request
- `-32601` - Method not found
- `-32602` - Invalid params
- `-32603` - Internal error

**Custom Error Codes:** Organize by range[^25]
- `-31xxx` - Authentication errors
- `-30xxx` - Resource access errors
- `-29xxx` - Validation errors

### 8.3 Tool Execution Errors

**Don't use JSON-RPC errors for tool failures.** Use `isError` flag instead[^26]:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error: File not found: data.json\n\nCheck that:\n1. Path is correct\n2. File exists\n3. Permissions are correct"
    }
  ],
  "isError": true
}
```

**Why?** This separates protocol errors from application errors, allowing LLMs to understand and potentially recover.

### 8.4 Error Message Best Practices

**Formula:** Error + Cause + Solution

```
✓ "Permission denied: /etc/passwd\n\nThe file is not readable. Check file permissions with 'ls -la /etc/passwd'"

✓ "Database query timeout (30s exceeded)\n\nThe query is too complex. Try:\n1. Adding indexes\n2. Reducing date range\n3. Limiting results"

✗ "Error occurred" (no context)

✗ "EACCES" (technical jargon without explanation)
```

### 8.5 Structured Error Handling

Classify errors for appropriate handling[^27]:

```javascript
try {
  return await executeTool(args);
} catch (error) {
  if (error.code === 'ENOENT') {
    return {
      content: [{
        type: 'text',
        text: `File not found: ${args.path}\n\nVerify path exists`
      }],
      isError: true
    };
  } else if (error.code === 'EACCES') {
    return {
      content: [{
        type: 'text',
        text: `Permission denied: ${args.path}\n\nCheck file permissions`
      }],
      isError: true
    };
  } else {
    throw error; // Unknown error - let protocol handler deal with it
  }
}
```

---

## 9. Testing and Validation

### 9.1 MCP Inspector

Official testing tool for MCP servers[^28]:

**Installation:**
```bash
npx @modelcontextprotocol/inspector node build/index.js
```

**Features:**
- Visual UI at http://localhost:6274
- Schema validation
- Tool execution testing
- Request/response logging
- Parameter form generation from JSON Schema

### 9.2 Automated Testing Layers[^29]

**1. Unit Tests**
- Individual tool handlers
- Parameter validation
- Error handling

**2. Integration Tests**
- Tool interactions
- External API calls
- Database operations

**3. Contract Tests**
- MCP protocol compliance
- Schema validation
- JSON-RPC format

**4. Load Tests**
- Concurrent requests
- Performance benchmarks
- Token limit validation

### 9.3 Schema Validation

Use MCP Inspector to catch common issues[^30]:
- Missing required parameters
- Type mismatches
- Invalid enum values
- Schema violations

**Recommendation:** Maintain explicit unit/integration tests for tool schemas as regression coverage.

---

## 10. Architecture Best Practices

### 10.1 Single Responsibility Principle

**Rule:** Each MCP server should have one clear, well-defined purpose[^31].

```
✓ github-mcp - GitHub operations only
✓ filesystem-mcp - File operations only
✓ database-mcp - Database queries only

✗ enterprise-mcp - Everything (too broad)
```

**Benefits:**
- Independent scaling
- Easier testing
- Clear team ownership
- Simpler maintenance

### 10.2 Tool Grouping

**Don't:** Map every API endpoint to a separate tool[^32]

**Do:** Group related tasks into higher-level functions

```
✗ github_get_issue
✗ github_get_issue_comments
✗ github_get_issue_labels
✗ github_get_issue_assignees

✓ github_get_issue_details (includes comments, labels, assignees)
```

### 10.3 Security by Design

**Defense in Depth**[^33]:
1. Network isolation
2. Authentication
3. Authorization
4. Input validation
5. Output sanitization

**Input Validation:**
```json
{
  "file_path": {
    "type": "string",
    "pattern": "^[a-zA-Z0-9/_.-]+$",
    "description": "Safe file path (no .. or special chars)"
  }
}
```

**Schema Enforcement:** Prevents injection attacks by validating all inputs against defined constraints[^34].

### 10.4 Configuration Management

**Externalize all settings**[^35]:

```javascript
const config = {
  apiKey: process.env.API_KEY,
  dbHost: process.env.DB_HOST,
  maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
  timeout: parseInt(process.env.TIMEOUT || '30000')
};
```

**Use validated configuration objects:**
- Pydantic (Python)
- Zod (TypeScript)
- JSON Schema validation

### 10.5 Observability

**Structured Logging**[^36]:
```javascript
console.error(JSON.stringify({
  level: 'error',
  timestamp: new Date().toISOString(),
  requestId: req.id,
  tool: 'search_documents',
  error: error.message,
  userId: user.id
}));
```

**Important:** Log to stderr, not stdout. MCP servers must only write JSON-RPC to stdout[^37].

**Metrics to Track:**
- Request latency (P50, P95, P99)
- Error rates by tool
- Token usage per request
- Throughput (requests/sec)

**Target KPIs**[^38]:
- Throughput: >1000 req/sec
- P95 latency: <100ms
- Error rate: <0.1%
- Availability: >99.9%

---

## 11. Advanced Topics

### 11.1 Prompts vs Tools

**Tools:** Execute actions (read/write operations)

**Prompts:** Define reusable message templates[^39]

```json
{
  "name": "code_review_prompt",
  "description": "Template for structured code review",
  "arguments": [
    {
      "name": "language",
      "description": "Programming language",
      "required": true
    }
  ]
}
```

**Use Case:** Guide LLM behavior in consistent patterns without hard-coding prompts in client.

### 11.2 Resources vs Tools

**Resources:** Provide read-only data access[^40]

**Tools:** Perform actions with side effects

**Example:**
```
Resource: file:///project/README.md (read-only reference)
Tool: update_file(path, content) (modifies file)
```

### 11.3 Caching Solutions

**Problem:** Large responses exceed token limits

**Solution:** mcp-cache pattern[^41]
1. Server caches large response locally
2. Returns summary + query tools
3. LLM searches cached data on demand

**Implementation:**
```json
{
  "content": [{
    "type": "text",
    "text": "Cached 1000 results. Use search_cache(query) to explore."
  }],
  "tools": [
    {
      "name": "search_cache",
      "description": "Query cached results by keyword"
    }
  ]
}
```

---

## 12. Real-World Implementation Checklist

### Pre-Launch Validation

- [ ] Tool names use `snake_case` and match `^[a-zA-Z0-9_-]{1,64}$`
- [ ] Descriptions are clear, concise (<255 chars), action-oriented
- [ ] All parameters have detailed descriptions with constraints
- [ ] Required vs optional fields explicitly defined
- [ ] Default values provided for optional parameters
- [ ] Enums use `oneOf` pattern (not deprecated `enumNames`)
- [ ] Input validation uses JSON Schema constraints (pattern, min/max)
- [ ] Pagination implemented for tools returning large datasets
- [ ] Error messages follow Error + Cause + Solution formula
- [ ] Application errors use `isError` flag (not JSON-RPC errors)
- [ ] All logs go to stderr (not stdout)
- [ ] Tool execution wrapped in try-catch blocks
- [ ] Output schemas defined for structured responses
- [ ] Annotations added for destructive/read-only operations
- [ ] MCP Inspector validation passes without errors
- [ ] Token usage tested with large responses (<25K tokens)
- [ ] Integration tests cover all tool paths
- [ ] Security: Input sanitization implemented
- [ ] Configuration externalized to environment variables
- [ ] Observability: Structured logging and metrics in place

### Documentation Completeness

- [ ] Each tool has usage examples
- [ ] Pagination parameters clearly documented
- [ ] Error codes documented with recovery strategies
- [ ] Installation instructions provided
- [ ] Configuration options documented
- [ ] Common troubleshooting scenarios covered

---

## 13. Common Pitfalls and Solutions

### Pitfall 1: Vague Descriptions
**Problem:** "Does stuff with data"
**Solution:** "Fetch user profile data from database by ID or email"

### Pitfall 2: Missing Pagination
**Problem:** Tool returns 10,000 items, exceeds token limit
**Solution:** Implement cursor-based pagination with default page_size=50

### Pitfall 3: Ambiguous Parameters
**Problem:** `date` field accepts any string
**Solution:** Add `format: "date-time"` and pattern validation

### Pitfall 4: Poor Error Messages
**Problem:** "Error: ENOENT"
**Solution:** "File not found: data.json. Check path is correct."

### Pitfall 5: No Default Values
**Problem:** All parameters required, even optional ones
**Solution:** Add `default` values for optional parameters

### Pitfall 6: Inconsistent Naming
**Problem:** Mix of `camelCase` and `snake_case`
**Solution:** Choose `snake_case` and enforce consistently

### Pitfall 7: Missing Schema Validation
**Problem:** Tool accepts invalid inputs, fails at runtime
**Solution:** Use JSON Schema constraints (min/max, pattern, enum)

### Pitfall 8: Logging to stdout
**Problem:** Breaks JSON-RPC protocol
**Solution:** All logs to stderr, only JSON-RPC to stdout

---

## 14. Summary: Keys to Auto-Discovery

LLMs successfully discover and use MCP tools when:

1. **Names are semantic** - `snake_case`, descriptive, service-prefixed
2. **Descriptions are actionable** - What + Why + Action in <255 chars
3. **Schemas are detailed** - Types, constraints, required fields explicit
4. **Parameters are self-documenting** - Each has clear description + validation
5. **Defaults indicate optionality** - Parameters with defaults are optional
6. **Enums are properly formatted** - Use `oneOf` with const/title
7. **Pagination is built-in** - For any tool returning variable-length results
8. **Errors are informative** - Error + Cause + Solution pattern
9. **Output is structured** - Use outputSchema + structuredContent
10. **Testing validates schemas** - MCP Inspector catches issues early

**Core Principle:** The schema is the documentation. If an LLM can understand your JSON Schema without external prompts, you've succeeded.

---

## Sources and References

[^1]: Model Context Protocol - Tools Specification. https://modelcontextprotocol.io/specification/2025-06-18/server/tools
[^2]: Model Context Protocol - Dynamic Updates. https://modelcontextprotocol.io/specification/2025-06-18/server/tools
[^3]: Model Context Protocol - Tool Definition. https://modelcontextprotocol.io/specification/2025-06-18/server/tools
[^4]: Tool Naming Convention - ShotGrid MCP Server. https://pipeline-f26f1c83.mintlify.app/guides/tool-naming-convention
[^5]: MCP Server Naming Conventions. https://zazencodes.com/blog/mcp-server-naming-conventions
[^6]: Suggestion for MCP Function Naming Convention - GitHub Issue #333. https://github.com/github/github-mcp-server/issues/333
[^7]: 3 Insider Tips for Using MCP Effectively. https://www.merge.dev/blog/mcp-best-practices
[^8]: Tools - Model Context Protocol. https://modelcontextprotocol.info/docs/concepts/tools/
[^9]: 3 Insider Tips for Using MCP Effectively. https://www.merge.dev/blog/mcp-best-practices
[^10]: Enums in OpenAPI Best Practices. https://www.speakeasy.com/openapi/schemas/enums
[^11]: SEP-1330: Elicitation Enum Schema Improvements. https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1330
[^12]: Tools - FastMCP. https://gofastmcp.com/servers/tools
[^13]: Optional Fields in rust-sdk MCP Schemas. https://github.com/modelcontextprotocol/rust-sdk/issues/135
[^14]: What's New in MCP - Structured Content. https://blogs.cisco.com/developer/whats-new-in-mcp-elicitation-structured-content-and-oauth-enhancements
[^15]: Model Context Protocol - Schema Reference. https://modelcontextprotocol.io/specification/2025-06-18/schema
[^16]: Model Context Protocol - Structured Content. https://modelcontextprotocol.io/specification/2025-06-18/server/tools
[^17]: Lessons from OpenAPI to MCP Conversions. https://www.stainless.com/blog/lessons-from-openapi-to-mcp-server-conversion
[^18]: MCP Tool Annotations Introduction. https://blog.marcnuri.com/mcp-tool-annotations-introduction
[^19]: MCP Tool Annotations And Metadata. https://devflowstack.org/blog/mcp-tool-annotations-and-metadata
[^20]: Tokens Exceeds Maximum Allowed - GitHub Issue. https://github.com/oraios/serena/issues/516
[^21]: Pagination - Model Context Protocol. https://modelcontextprotocol.io/specification/2025-03-26/server/utilities/pagination
[^22]: Understanding Limits of LIMIT and OFFSET. https://blog.thnkandgrow.com/understanding-the-limits-of-limit-and-offset-for-large-datasets/
[^23]: API Pagination Best Practices. https://engineeringatscale.substack.com/p/api-pagination-limit-offset-vs-cursor
[^24]: Error Handling in MCP Servers. https://mcpcat.io/guides/error-handling-custom-mcp-servers/
[^25]: Error Handling And Debugging MCP Servers. https://www.stainless.com/mcp/error-handling-and-debugging-mcp-servers
[^26]: Error Handling in MCP TypeScript SDK. https://dev.to/yigit-konur/error-handling-in-mcp-typescript-sdk-2ol7
[^27]: Best Practices for Handling MCP Exceptions. https://gist.github.com/eonist/1cbc3502305e0fc0aa6e977bae283b41
[^28]: MCP Inspector - Official Tool. https://github.com/modelcontextprotocol/inspector
[^29]: MCP Best Practices: Architecture Guide. https://modelcontextprotocol.info/docs/best-practices/
[^30]: MCP Inspector Testing Guide. https://www.stainless.com/mcp/mcp-inspector-testing-and-debugging-mcp-servers
[^31]: MCP Best Practices: Single Responsibility. https://modelcontextprotocol.info/docs/best-practices/
[^32]: MCP Best Practices: Tool Design. https://modelcontextprotocol.info/docs/best-practices/
[^33]: MCP Best Practices: Security. https://modelcontextprotocol.info/docs/best-practices/
[^34]: MCP JSON Schema Validation. https://www.byteplus.com/en/topic/542256
[^35]: MCP Best Practices: Configuration. https://modelcontextprotocol.info/docs/best-practices/
[^36]: MCP Best Practices: Observability. https://modelcontextprotocol.info/docs/best-practices/
[^37]: Error Handling in MCP Servers. https://mcpcat.io/guides/error-handling-custom-mcp-servers/
[^38]: 7 MCP Server Best Practices. https://www.marktechpost.com/2025/07/23/7-mcp-server-best-practices-for-scalable-ai-integrations-in-2025/
[^39]: MCP Prompts Explained. https://medium.com/@laurentkubaski/mcp-prompts-explained-including-how-to-actually-use-them-9db13d69d7e2
[^40]: What are MCP Resources. https://www.speakeasy.com/mcp/building-servers/protocol-reference/resources
[^41]: Solving AI's 25000 Token Wall. https://dev.to/swapnilsurdi/solving-ais-25000-token-wall-introducing-mcp-cache-1fie

---

**Document Version:** 1.0
**Last Updated:** 2025-11-05
**Protocol Version:** MCP 2025-06-18
