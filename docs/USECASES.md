# UCPL-Compress MCP Server: Use Cases & Limitations

## 🎯 What It's Good For

### 1. **Exploring Large Codebases**

**Use case**: Understanding structure before diving deep

- Compress entire directories to get a 30,000-foot view
- 70-90% token reduction means you can fit 10x more code in context
- Example: "What does the `src/auth/` module do?"

**Workflow**:

```
You → "Show me what's in src/"
Claude → Automatically compresses src/
Claude → Reads compressed view (10K tokens instead of 100K)
Claude → "The src/ directory contains auth, api, and database modules..."
```

### 2. **API Surface Understanding**

**Use case**: Learning interfaces without implementation details

- Get function signatures, types, and docstrings
- Perfect for understanding "what's available" not "how it works"
- Useful for: integration tasks, finding the right function to call, understanding module boundaries

**Example**: Compress at `signatures` level to see:

```
class UserAuthenticator:
  generate_token(user_id: int, email: str) -> str
  verify_token(token: str) -> Dict[str, Any]
```

### 3. **Context Budget Management**

**Use case**: Fitting more context when hitting token limits

- You have 200K token limit but codebase is 500K tokens
- Compress non-critical parts, keep full detail where needed
- Strategic: full code for editing, compressed for reference

### 4. **Multi-File Analysis**

**Use case**: Understanding relationships across files

- Compress 20 files to understand architecture
- See how modules connect without drowning in implementation
- Good for: refactoring planning, architecture review, dependency analysis

### 5. **Cost Optimization**

**Use case**: Reducing API costs for large projects

- 70-90% fewer input tokens = 70-90% lower costs on context
- Most useful for: teams processing lots of code, automated workflows, frequent codebase queries

---

## ❌ What It's NOT Good For

### 1. **Algorithm/Logic Debugging**

**Why**: You need the actual implementation details

- Compression loses: exact control flow, edge cases, specific logic
- Can't debug `if x > 5` vs `if x >= 5` from a summary
- **Use full code instead** when fixing bugs or understanding complex logic

### 2. **Code Modification/Writing**

**Why**: LLM needs to see actual code to edit it correctly

- Can't refactor code you haven't read fully
- Can't preserve formatting, comments, style from a summary
- **Use full code** for any file you're actively editing

### 3. **Security Audits**

**Why**: Details matter for vulnerabilities

- SQL injection, XSS, auth bypasses hide in implementation details
- Compression might skip the exact line with the vulnerability
- **Use full code** for security reviews

### 4. **Performance Optimization**

**Why**: Performance issues are in the details

- Memory leaks, N+1 queries, inefficient loops need actual code
- Can't optimize what you can't see
- **Use full code** for performance work

### 5. **Small Codebases (<1000 lines)**

**Why**: Overhead isn't worth it

- If your entire codebase fits in context, just send it
- Compression adds latency and complexity
- **Skip compression** for small projects

### 6. **Test Writing**

**Why**: Need to understand exact behavior

- Tests need to match precise function behavior
- Edge cases come from implementation details
- **Use full code** when writing comprehensive tests

### 7. **Documentation Tasks**

**Why**: Documentation needs nuance and examples

- Can't document usage patterns from signatures alone
- Need actual code examples, error handling details
- **Use full code** for writing user-facing docs

---

## 🔄 Ideal Daily Workflow

### Two-Phase Approach

**Phase 1: Exploration (Compressed)**

```
"What does this project do?"
"Where is authentication handled?"
"Which modules depend on the database layer?"
```

→ Use compressed context to explore and orient

**Phase 2: Implementation (Full Code)**

```
"Fix the bug in auth/user.py line 45"
"Refactor the calculate_discount function"
"Add error handling to the API routes"
```

→ Read full files for actual work

### Compression Levels by Task

| Task                    | Level            | Token Reduction | Use When                   |
| ----------------------- | ---------------- | --------------- | -------------------------- |
| "What does this do?"    | minimal          | 85-90%          | Initial exploration        |
| "How do these connect?" | signatures       | 80-85%          | Architecture understanding |
| "Explain this module"   | full             | 70-80%          | Detailed understanding     |
| "Fix this bug"          | none (full code) | 0%              | Actual editing             |

---

## 💡 Smart Use Cases

### ✅ Do This

```
1. Compress src/ at 'minimal' level → understand structure
2. Compress auth/ at 'full' level → see module details
3. Read auth/user.py fully → edit specific file
```

### ❌ Not This

```
1. Compress entire codebase
2. Try to write code from compressed view
3. Debug from summaries
```

---

## Summary

**ucpl-compress MCP is ideal for:**

- 🔍 Code exploration and discovery
- 📊 Architecture understanding
- 🗺️ Navigation and orientation
- 💰 Token/cost optimization for large codebases
- 🔗 Understanding relationships between modules

**Not suitable for:**

- 🐛 Debugging
- ✍️ Code editing/refactoring
- 🔒 Security audits
- ⚡ Performance optimization
- 📝 Detailed documentation

**Best practice**: Compress for context, read full code for work. Think of it like viewing a city map (compressed) before walking a specific street (full code).
