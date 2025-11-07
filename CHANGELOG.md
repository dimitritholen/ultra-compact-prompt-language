# Changelog

All notable changes to the UCPL-Compress MCP Server will be documented in this file.

## [1.1.0] - 2025-01-05

### 🎉 Major: Self-Documenting MCP Server

The MCP server is now **fully self-documenting**. LLMs automatically understand how to use it correctly without requiring any system prompt configuration.

#### Added

- **Comprehensive Tool Description** with embedded usage patterns, examples, and warnings
- **Detailed Parameter Descriptions** with recommendations and best practices
- **Proactive Validation** - Server checks for common mistakes before execution
- **Intelligent Error Messages** with corrective instructions and examples
- **Automatic File Counting** - Warns when directory has >20 files without pagination
- **Response Size Checking** - Prevents responses exceeding 25K token MCP limit
- **Enhanced Error Context** - File not found, permission denied, and other errors include troubleshooting steps

#### Changed

- Tool description now includes complete usage patterns (no external docs needed)
- Parameter descriptions include CRITICAL warnings and RECOMMENDED values
- Error messages are instructive rather than just informational
- Version bumped to 1.1.0 across all components

#### Fixed

- **Pagination Support** - Added `limit` and `offset` parameters to handle large directories
- **Token Limit Compliance** - Responses now stay under 25,000 token MCP limit
- **Directory Processing** - Large directories (500+ files) no longer cause failures

### 📄 Pagination System

#### Added

- `limit` parameter: Maximum number of files to process per request
- `offset` parameter: Skip N files for pagination
- `format="summary"` option: Lightweight file list without compressed content
- Pagination hints in output (e.g., "Showing files 1-20 of 150")
- Total file count tracking for directories

#### Changed

- `compress_directory()` now returns `(results, total_files)` tuple
- `format_output()` displays pagination information
- CLI supports `--limit` and `--offset` flags

### 🛡️ Error Prevention

#### Added

- Pre-execution file count check for directories
- Post-execution response size validation
- Path validation with helpful troubleshooting
- Permission error detection with guidance
- Compression failure hints

### 📚 Documentation

#### Added

- `docs/MCP-SELF-DOCUMENTING.md` - Comprehensive guide to self-documenting design
- `docs/MCP-PAGINATION-FIX.md` - Detailed pagination implementation guide
- `docs/mcp-system-prompt-snippet.md` - Updated to indicate no longer needed

#### Changed

- Main README highlights self-documenting feature
- Installation guide simplified (no system prompt configuration needed)
- Examples updated with pagination patterns

### Migration Guide

**From 1.0.0 to 1.1.0:**

No breaking changes. Existing code continues to work. New features are backward compatible.

**Optional:** Remove system prompt snippets - they're no longer needed:

- Delete content from `~/.claude/CLAUDE.md` or project `CLAUDE.md`
- MCP server now provides all instructions automatically

---

## [1.0.0] - 2024-12-XX

### Initial Release

#### Features

- Code compression with 70-98% token reduction
- Support for 16 programming languages
- Three compression levels (full, signatures, minimal)
- MCP protocol integration
- Claude Desktop / Claude Code compatibility
- File and directory compression
- Include/exclude glob pattern filtering
- CLI and MCP server modes
- JSON, text, and summary output formats

#### Components

- Python compression engine (`ucpl-compress`)
- Node.js MCP server (`server.js`)
- Package distribution via npm

---

## Version History

- **1.1.0** (2025-01-05): Self-documenting + Pagination
- **1.0.0** (2024-12-XX): Initial release

---

## Upgrade Instructions

### To 1.1.0 from 1.0.0

```bash
# If installed globally
npm install -g ucpl-compress-mcp@latest

# Or if using npm link for development
cd mcp-server
npm link

# Restart Claude Desktop/Code to pick up changes
```

### Verify Upgrade

```bash
ucpl-compress-mcp --version
# Should show: 1.1.0

# Test pagination
ucpl-compress . --format summary --limit 10
```

---

## Known Issues

### 1.1.0

- None currently known

### 1.0.0

- ❌ Large directories (>100 files) exceed MCP 25K token limit → **Fixed in 1.1.0**
- ❌ No guidance for LLMs on proper usage → **Fixed in 1.1.0**
- ❌ Error messages not actionable → **Fixed in 1.1.0**

---

## Future Roadmap

### v1.2.0 (Planned)

- **Smart Auto-Pagination**: Automatically chunk large directories based on token budget
- **File Prioritization**: Sort files by importance (main files first, tests last)
- **Resume Tokens**: Stateless pagination with continuation tokens
- **Token Budget Parameter**: Accept `max_tokens` and auto-adjust `limit`
- **Interactive Help**: `{path: "help"}` returns detailed examples with current working directory

### v1.3.0 (Planned)

- **Batch Operations**: Compress multiple directories in parallel
- **Caching Layer**: Cache compressed results for faster repeated queries
- **Incremental Compression**: Only recompress changed files
- **Custom Compression Rules**: User-defined extraction patterns
- **Metrics Dashboard**: Usage statistics and optimization recommendations

### v2.0.0 (Planned)

- **Context-Aware Compression**: Adapt to user's specific query
- **Semantic Search**: Find relevant files before compressing
- **Multi-Language Models**: Optimize for different LLM architectures
- **Streaming Responses**: Send compressed data incrementally
- **Plugin System**: Extensible compression strategies

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Reporting Issues

- **Bug reports**: Include MCP server version, error message, and steps to reproduce
- **Feature requests**: Describe use case and expected behavior
- **Documentation**: Suggest improvements or report unclear sections

### Pull Requests

- Follow existing code style
- Add tests for new features
- Update documentation
- Include changelog entry

---

## License

MIT License - See [LICENSE](LICENSE) for details
