# How Coding LLMs Process Codebases: A Technical Reference

**Date**: January 5, 2025
**Audience**: Junior developers and engineers new to AI coding tools

---

## 1. How LLMs Process Code: Fundamentals

### Tokenization Basics

LLMs don't read code the way humans do. They process text by breaking it into **tokens** - small chunks that can be words, parts of words, or individual characters.

**Key Facts**:

- Tokenization is a separate module from the LLM itself
- Uses algorithms like Byte-Pair Encoding (BPE) to convert text → bytes → token sequences
- Different models use different tokenizers:
  - GPT models: tiktoken
  - LLaMA/Mistral: SentencePiece
  - Each has its own vocabulary and encoding rules

**Code-Specific Challenges**:

- Code is more verbose than natural language
- Early models (GPT-2) tokenized inefficiently: each indentation space = separate token
- Modern models (GPT-4) improved by grouping indentation spaces
- Different languages tokenize differently based on syntax complexity

### Token Calculation for Code

**Rule of Thumb**:

- **~10 tokens per line of code** (average across languages)
- **~4 bytes per token** (compression ratio)
- **100 lines ≈ 1,000 tokens**

**Why It Varies**:

- Verbose languages (Java, C#) generate more tokens per line
- Concise languages (Python, Ruby) generate fewer
- Comments, long variable names, and complex expressions increase token count

---

## 2. Token Usage Mechanics: Line-by-Line Processing

### Does the Model Read Every Line?

**Short Answer**: Only the lines you feed it within the context window.

**How It Works**:

1. You make a request to the LLM (via tool like Claude Code)
2. The tool constructs a prompt containing:
   - System instructions
   - Relevant code files/snippets
   - Your question/request
3. Everything in that prompt gets tokenized
4. The entire token sequence counts toward your usage

### Token Accumulation

**Yes, tokens add up linearly**:

- File 1: 500 tokens
- File 2: 800 tokens
- File 3: 300 tokens
- **Total sent to LLM**: 1,600 tokens

**Cost Impact**:

- Input tokens: charged per million tokens
- Output tokens: charged separately (usually higher rate)
- Both directions count toward your usage limits

---

## 3. Context Window Limitations

### What is a Context Window?

The **maximum number of tokens** an LLM can process in a single request (input + output combined).

**Evolution Timeline**:

- **2023**: 4K-8K tokens standard
- **2024**: 32K tokens standard
- **2025**: 128K-200K tokens common, some offer 1M tokens

**Real-World Comparison**:

- 32K tokens ≈ 50-page document
- 128K tokens ≈ 250-page book
- 200K tokens ≈ small to medium codebase
- 1M tokens ≈ large codebase or documentation

### Why Limitations Matter

**The Novel Analogy**:

- Imagine reading a 400,000-file monorepo with a 32K context window
- Like understanding a novel by reading one paragraph at a time
- Missing context = incomplete understanding = hallucinations

**Practical Impact**:

- Cannot load entire large codebases at once
- Must strategically select which files to include
- Important context may be cut off
- Affects quality of suggestions and analysis

---

## 4. Token Optimization Strategies

### 4.1 Prompt Caching

**What It Is**:
Temporarily stores frequently used context between API calls to avoid re-processing the same tokens.

**How It Works**:

1. Send system prompt + codebase context (e.g., 50K tokens)
2. Provider caches the prefix
3. Next request reuses cached prefix, only processes new query (e.g., 200 tokens)
4. **90% cost reduction** + **80% latency reduction** on cached portions

**Introduced By**:

- Anthropic (Claude): 2024
- OpenAI (GPT): 2024
- Google (Gemini): 2024

**Code Use Cases**:

- Static library documentation
- Boilerplate code templates
- Repository structure/metadata
- Frequent code analysis on same files

**Example**:

```
Request 1: [System Prompt (cached)] + [Codebase Context (cached)] + [Query: "Fix bug in auth.py"]
Request 2: [Cached System + Context] + [New Query: "Add logging to auth.py"]
```

Only the new query gets charged full price.

### 4.2 RAG (Retrieval-Augmented Generation)

**What It Is**:
Instead of sending entire codebase, send only the **most relevant chunks** retrieved via semantic search.

**Architecture**:

1. **Indexing Phase** (done once):
   - Split codebase into chunks (functions, classes, modules)
   - Generate embeddings (vector representations) for each chunk
   - Store embeddings in vector database

2. **Retrieval Phase** (per query):
   - Convert user query to embedding
   - Vector search finds top-K most similar chunks
   - Send only those chunks to LLM

3. **Generation Phase**:
   - LLM generates response using retrieved context
   - Much smaller token footprint

**Benefits**:

- Process codebases larger than context window
- Reduce token costs significantly
- Faster responses (less to process)

**Vector Databases**:

- Pinecone, Weaviate, Qdrant
- MongoDB Vector Search
- Postgres with pgvector

### 4.3 AST (Abstract Syntax Tree) Indexing

**What It Is**:
Parse code into structural tree representation instead of treating it as plain text.

**How It Helps**:

- **Semantic understanding**: Know what's a function vs. variable vs. class
- **Dependency graphs**: Track relationships between code elements
- **Precise retrieval**: Find exact function definitions, not just text matches
- **Language-agnostic**: Same approach works for 40+ languages

**Popular Tool**: Tree-sitter

- Incremental parsing (only re-parse changed portions)
- Error-resilient (works with incomplete/broken code)
- Used by: GitHub Copilot, Cursor, many AI tools

**Workflow**:

1. Parse files → generate ASTs
2. Extract semantic chunks (functions, classes)
3. Index chunks for retrieval
4. AI assistant queries index for relevant structures
5. Only sends matching structures to LLM

**Example**:
Query: "How does user authentication work?"

- AST index finds: `authenticate_user()`, `validate_token()`, `User` class
- Sends only those 3 structures to LLM (~500 tokens)
- Instead of entire `auth/` directory (~5,000 tokens)

### 4.4 Chunking Strategies

Most code files exceed single embedding limits, requiring strategic splitting.

**Common Approaches**:

- **Fixed-size chunking**: Split every N tokens (simple but breaks context)
- **AST-based chunking**: Split by function/class boundaries (preserves semantics)
- **Sliding window**: Overlapping chunks to maintain context
- **Hierarchical**: Module → File → Class → Function

---

## 5. How Coding Tools Handle Large Codebases

### What Tools DON'T Do (Usually)

**Myth**: Tools upload your entire codebase to the cloud
**Reality**: Tools are selective about what they send

**Why**:

- Token limits prevent sending everything
- Privacy/security concerns
- Cost optimization
- Performance (latency)

### What Tools DO Instead

#### Strategy 1: Context-Focused Analysis

**Used by**: GitHub Copilot

- Analyzes only files currently open in editor
- Considers nearby code in same file
- Does NOT upload entire repository
- Keeps suggestions relevant and privacy-conscious

**Token Footprint**: Small (few thousand tokens per request)

#### Strategy 2: Full Codebase Indexing + Selective Retrieval

**Used by**: Cursor, Augment Code, Supermaven

**Process**:

1. Index entire codebase locally (one-time operation)
2. Build dependency graphs and symbol tables
3. When you ask a question:
   - Query local index
   - Retrieve only relevant files/functions
   - Send curated context to LLM

**Benefits**:

- Multi-repository understanding
- Cross-file refactoring
- Accurate dependency tracking

**Token Footprint**: Medium (10K-50K tokens per request)

#### Strategy 3: Massive Context Windows

**Used by**: Claude Code, Gemini Code Assist

**Approach**:

- Leverage 200K-1M token windows
- Send larger portions of codebase directly
- Less reliance on retrieval systems
- Better for deep architectural analysis

**Trade-offs**:

- Higher cost per request
- Better understanding but slower
- Useful for complex reasoning tasks

**Token Footprint**: Large (50K-200K tokens per request)

---

## 6. Tool-Specific Approaches

### GitHub Copilot

- **Context Window**: 64K tokens (2024 update)
- **Strategy**: Current file + open files
- **Multi-file**: Copilot Edits feature (limited cross-file analysis)
- **Agent Mode**: Can analyze repository structure
- **Token Optimization**: Minimal - only sends what's visible

**Best For**: Auto-completion, single-file edits, small refactors

### Cursor

- **Context Window**: Leverages GPT-4/Claude APIs
- **Strategy**: Full codebase indexing + sophisticated retrieval
- **Multi-file**: Advanced - agent mode edits across many files
- **Unique Features**: @codebase mentions, composer for multi-step tasks
- **Token Optimization**: Heavy use of RAG and local indexing

**Best For**: Large refactors, multi-file features, codebase exploration

### Claude Code

- **Context Window**: 200K tokens (Sonnet 4.5)
- **Strategy**: Direct file access + MCP servers
- **Multi-file**: Workspace-wide analysis and edits
- **Token Optimization**: Prompt caching, selective file reading
- **Average Cost**: $6/day per developer

**Unique Challenges**:

- Users report high token burn on large repos
- Recommendation: Pre-create 5K token spec of key components
- Use `/context` command to monitor token usage
- Disable unused MCP servers (each adds to system prompt)

**Best For**: Deep architectural reasoning, complex debugging, CLI workflows

### Tool Comparison Summary

| Tool                   | Context Window | Multi-File Capability | Token Strategy          | Best Use Case                |
| ---------------------- | -------------- | --------------------- | ----------------------- | ---------------------------- |
| **Copilot**            | 64K            | Limited               | Minimal sending         | Auto-completion              |
| **Cursor**             | API-dependent  | Advanced              | RAG + Indexing          | Feature development          |
| **Claude Code**        | 200K           | Advanced              | Large context + caching | Architecture analysis        |
| **Supermaven**         | 300K           | Advanced              | Massive context         | Large codebase understanding |
| **Gemini Code Assist** | 1M             | Advanced              | Ultra-large context     | Multi-file reasoning         |

---

## 7. Best Practices for Developers

### Minimize Token Usage

1. **Be specific**: Ask about specific files/functions, not "analyze everything"
2. **Use file paths**: `@file:auth.py` instead of vague descriptions
3. **Break down tasks**: Multiple focused requests vs. one giant request
4. **Close irrelevant files**: Many tools consider open files as context
5. **Disable unused integrations**: MCP servers, plugins add to system prompt

### Optimize for Large Codebases

1. **Create architecture docs**: 5K token overview of system design
2. **Maintain code maps**: List of key files and their purposes
3. **Use task-specific prompts**: "Focus on authentication module only"
4. **Leverage caching**: Repeated queries on same files use cached context
5. **Monitor usage**: Tools like `ccusage`, Claude Code's `/context` command

### When to Use Which Tool

**Quick autocomplete**: GitHub Copilot
**Multi-file refactoring**: Cursor
**Deep architectural analysis**: Claude Code
**Massive legacy codebase**: Gemini Code Assist (1M context)

---

## 8. Common Misconceptions

### ❌ "The AI reads my entire codebase every time"

**Reality**: Tools selectively send relevant portions based on context

### ❌ "Tokens are charged per line of code"

**Reality**: Tokens are linguistic units; lines are approximate (~10 tokens/line average)

### ❌ "Bigger context window = always better"

**Reality**: Larger contexts cost more and process slower; strategic retrieval often wins

### ❌ "All tokens cost the same"

**Reality**: Input tokens cheaper than output; cached tokens much cheaper (90% discount)

### ❌ "AI coding tools understand my code like a human"

**Reality**: They process statistical patterns in token sequences; AST indexing helps but isn't human comprehension

---

## 9. Future Developments (2024-2025)

### Emerging Trends

1. **Hybrid LLM architectures**: Research on prefix caching for next-gen models (Marconi, Nov 2024)
2. **Unsupervised retrievers**: RAG systems that don't need labeled training data
3. **Multi-modal code understanding**: Combining text, AST, and execution traces
4. **Federated code intelligence**: Local indexing + cloud LLM hybrid approaches
5. **Token-efficient formats**: UCPL and similar compressed prompt formats

### Research Areas

- **TREC 2024 RAG Track**: Industrial baselines for retrieval-augmented generation
- **AST + embeddings**: Combining structural and semantic understanding
- **Incremental context updates**: Only send diffs, not entire files
- **Knowledge graph integration**: Graph-based code representation for better reasoning

---

## Sources & Further Reading

1. Anthropic Claude Code Documentation (2025) - Token management and costs
2. GitHub Blog - Byte-pair tokenization for code (2024)
3. Fast.ai - "Let's Build the GPT Tokenizer" (2025)
4. Medium - "Semantic Code Indexing with AST and Tree-sitter" (Oct 2024)
5. ArXiv - "Marconi: Prefix Caching for Hybrid LLMs" (Nov 2024)
6. Microsoft Azure - RAG in AI Search (2024)
7. Dropstone Blog - AST parsing across 40+ languages
8. IBM Research - Why larger context windows matter (2024)
9. Various tool comparisons: Augment Code, Builder.io, Zapier (2024-2025)

---

**Document Version**: 1.0
**Last Updated**: January 5, 2025
**Keywords**: LLM, tokenization, context window, RAG, AST, prompt caching, code analysis, token optimization

---

## Summary for Junior Developers

**Think of it this way**:

1. **LLMs convert code → tokens** (small text chunks, ~10 per line)
2. **Tokens = costs** (every token sent and received is charged)
3. **Context windows = limits** (can only process so many tokens at once)
4. **Tools are smart** - they DON'T send your whole codebase:
   - Copilot: sends current file + open files
   - Cursor: indexes everything, sends only relevant pieces (RAG)
   - Claude Code: uses large context but still selective
5. **Optimization techniques**:
   - Prompt caching (reuse common context)
   - RAG (vector search for relevant chunks)
   - AST indexing (structural understanding)
   - Chunking (smart splitting of large files)

**Bottom line**: Modern AI coding tools are designed to be efficient. They analyze what's needed, not everything. Understanding this helps you use them more effectively and economically.
