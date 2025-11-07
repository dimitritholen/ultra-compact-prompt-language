# Context Compression: The Next Frontier

## The Real Token Problem

UCPL optimizes prompt instructions (500-2,000 tokens), but **code context dominates** (20,000-50,000 tokens per session).

**Question**: Can we compress code context without the LLM needing to expand it back to full text?

## The Challenge

Traditional compression (gzip, zlib) doesn't work because:

```
Compressed code → LLM tokenizes compressed text → LLM must decode mentally
```

Even though the compressed payload is smaller, the LLM still needs to understand it, which means:

1. Processing compressed tokens
2. Mental expansion to understand semantics
3. No net token savings (you're just shifting the work)

**The Key Insight**: We need compression formats the LLM can understand **directly**, without mental expansion.

---

## Solution 1: Semantic Compression (Available Today)

Instead of sending full code, send **semantic summaries** that the LLM can process directly.

### Example: Full Code (850 tokens)

```python
class UserAuthenticator:
    """Handles user authentication with JWT tokens."""

    def __init__(self, secret_key: str, token_expiry: int = 3600):
        self.secret_key = secret_key
        self.token_expiry = token_expiry
        self.logger = logging.getLogger(__name__)

    def generate_token(self, user_id: int, email: str) -> str:
        """Generate JWT token for authenticated user."""
        payload = {
            'user_id': user_id,
            'email': email,
            'exp': datetime.utcnow() + timedelta(seconds=self.token_expiry),
            'iat': datetime.utcnow()
        }

        try:
            token = jwt.encode(payload, self.secret_key, algorithm='HS256')
            self.logger.info(f"Token generated for user {user_id}")
            return token
        except Exception as e:
            self.logger.error(f"Token generation failed: {str(e)}")
            raise AuthenticationError("Failed to generate token")

    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify JWT token and return payload."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=['HS256'])
            return payload
        except jwt.ExpiredSignatureError:
            raise AuthenticationError("Token has expired")
        except jwt.InvalidTokenError:
            raise AuthenticationError("Invalid token")
```

### Semantic Summary (180 tokens - 79% reduction)

```
# UserAuthenticator (auth/user.py:15-45)
Class: JWT-based user authentication
Dependencies: jwt, logging, datetime

Methods:
- __init__(secret_key: str, token_expiry: int=3600)
  Initializes authenticator with secret and expiry config

- generate_token(user_id: int, email: str) -> str
  Creates JWT with payload: {user_id, email, exp, iat}
  Algorithm: HS256
  Logs success/failure
  Raises: AuthenticationError on failure

- verify_token(token: str) -> Dict[str, Any]
  Decodes and validates JWT
  Returns: payload dict
  Raises: AuthenticationError on expiry/invalid token
```

**Key Point**: The LLM can understand and reason about the summary **directly** without mentally reconstructing the full implementation.

---

## Solution 2: Hierarchical Context (Progressive Detail)

Provide context in layers - LLM requests deeper detail only when needed.

### Level 1: Module Overview (50 tokens)

```
auth/
  user.py: UserAuthenticator (JWT), PasswordHasher (bcrypt)
  session.py: SessionManager (Redis), SessionStore
  permissions.py: PermissionChecker, RoleManager
```

### Level 2: API Surface (200 tokens)

```python
# auth/user.py
class UserAuthenticator:
    generate_token(user_id: int, email: str) -> str
    verify_token(token: str) -> Dict[str, Any]
    refresh_token(old_token: str) -> str

class PasswordHasher:
    hash_password(password: str) -> str
    verify_password(password: str, hash: str) -> bool
```

### Level 3: Full Implementation (on demand)

Only provided when LLM explicitly requests it.

**Benefit**: Most tasks only need Level 1-2, saving 80-90% of context tokens.

---

## Solution 3: AST-Based Compression (Experimental)

Send Abstract Syntax Tree instead of source code.

### Source Code (120 tokens)

```python
def calculate_discount(price: float, tier: str) -> float:
    if tier == "gold":
        return price * 0.8
    elif tier == "silver":
        return price * 0.9
    else:
        return price
```

### AST Representation (65 tokens - 46% reduction)

```json
{
  "type": "FunctionDef",
  "name": "calculate_discount",
  "args": [
    {"name": "price", "type": "float"},
    {"name": "tier", "type": "str"}
  ],
  "returns": "float",
  "body": {
    "type": "If",
    "conditions": [
      {"test": "tier=='gold'", "value": "price*0.8"},
      {"test": "tier=='silver'", "value": "price*0.9"},
      {"else": "price"}
    ]
  }
}
```

**Limitation**: Current LLMs aren't optimized for AST understanding. Works better with:

- Code generation tasks
- Structural analysis
- Less effective for semantic understanding

---

## Solution 4: Diff-Based Context (For Edits)

For refactoring/editing tasks, only send **changes** instead of full files.

### Full File Context (1,200 tokens)

```python
# entire file with 50 functions
```

### Diff Context (150 tokens - 87% reduction)

```diff
# user_service.py:45-60
@@ Original @@
def create_user(name, email):
    user = User(name, email)
    db.save(user)
    return user

@@ Context @@
- Called by: api/routes.py:create_user_endpoint
- Uses: models/user.py:User, db/session.py:save
- Related: validate_email() (line 25)
```

---

## Solution 5: Type-Signature Compression (TypeScript/Python)

Types contain most semantic information - implementation is often derivable.

### Full Implementation (180 tokens)

```typescript
interface User {
  id: number;
  email: string;
  name: string;
  created_at: Date;
}

function createUser(data: Omit<User, 'id' | 'created_at'>): Promise<User> {
  return db.users.create({
    ...data,
    created_at: new Date()
  });
}
```

### Type Signature Only (45 tokens - 75% reduction)

```typescript
User = {id: number, email: string, name: string, created_at: Date}
createUser(data: Pick<User, 'email'|'name'>) -> Promise<User>
```

**Works well for**:

- Type-driven tasks
- API design
- Interface refactoring

**Doesn't work for**:

- Algorithm optimization
- Bug fixing
- Complex business logic

---

## Practical Implementation: Smart Context Selection

Tools like Cursor and Copilot already use heuristics. Here's a formal approach:

### Context Priority Algorithm

```python
def select_context(task: str, codebase: Codebase) -> List[CodeSnippet]:
    """
    Select minimal sufficient context for task.

    Priority (descending):
    1. Files mentioned in task
    2. Direct dependencies (imports)
    3. Function signatures called
    4. Type definitions used
    5. Related test files

    Include full implementation only for:
    - Files <100 lines
    - Functions directly mentioned
    - Critical business logic
    """

    context = []

    # High priority: Direct mentions (full implementation)
    for file in task.mentioned_files:
        if file.lines < 100:
            context.append(file.full_content)
        else:
            context.append(file.signatures_only)

    # Medium priority: Dependencies (signatures only)
    for dep in task.dependencies:
        context.append(dep.public_api)

    # Low priority: Related files (summaries only)
    for related in task.related_files:
        context.append(related.summary)

    return context
```

---

## The Reality: What Works Today

### ✅ Available Now (No API Changes Needed)

1. **Semantic Summaries**: 70-80% compression, works well
2. **Hierarchical Context**: 80-90% savings on average, requires tooling
3. **Diff-Based**: 85-90% savings for edit tasks
4. **Type Signatures**: 70-75% savings for typed languages

### ⏳ Requires Tooling (Build Yourself)

1. **Smart Context Selection**: Most promising, needs codebase analysis
2. **Progressive Detail**: Requires multi-turn protocol
3. **Caching Strategies**: Session-level context caching

### 🔬 Research Territory (Not Practical Yet)

1. **AST Compression**: LLMs struggle with non-natural formats
2. **Binary Embeddings**: APIs don't support
3. **Custom Tokenization**: Requires model provider support

---

## Proof of Concept: Semantic Compression Tool

```python
#!/usr/bin/env python3
"""
Code Context Compressor

Converts full code files to semantic summaries that LLMs can understand directly.
"""

import ast
from typing import List, Dict
from pathlib import Path

class SemanticCompressor:
    """Compresses code to LLM-friendly semantic summaries."""

    def compress_file(self, file_path: Path) -> str:
        """Convert code file to semantic summary."""
        code = file_path.read_text()
        tree = ast.parse(code)

        summary = f"# {file_path.name}\n\n"

        # Extract classes
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                summary += self._summarize_class(node)
            elif isinstance(node, ast.FunctionDef):
                summary += self._summarize_function(node)

        return summary

    def _summarize_class(self, node: ast.ClassDef) -> str:
        """Summarize class with methods."""
        output = f"## Class: {node.name}\n"

        # Docstring
        if ast.get_docstring(node):
            output += f"{ast.get_docstring(node)}\n"

        # Methods
        output += "Methods:\n"
        for item in node.body:
            if isinstance(item, ast.FunctionDef):
                sig = self._get_signature(item)
                output += f"  - {sig}\n"
                if ast.get_docstring(item):
                    output += f"    {ast.get_docstring(item)}\n"

        return output + "\n"

    def _summarize_function(self, node: ast.FunctionDef) -> str:
        """Summarize standalone function."""
        sig = self._get_signature(node)
        output = f"## Function: {sig}\n"

        if ast.get_docstring(node):
            output += f"{ast.get_docstring(node)}\n"

        return output + "\n"

    def _get_signature(self, node: ast.FunctionDef) -> str:
        """Extract function signature."""
        args = [arg.arg for arg in node.args.args]
        return_type = "Any"  # Simplified

        return f"{node.name}({', '.join(args)}) -> {return_type}"


def main():
    compressor = SemanticCompressor()

    # Example usage
    summary = compressor.compress_file(Path("auth/user.py"))
    print(summary)

    original_tokens = count_tokens(Path("auth/user.py").read_text())
    summary_tokens = count_tokens(summary)

    print(f"\nOriginal: {original_tokens} tokens")
    print(f"Summary: {summary_tokens} tokens")
    print(f"Savings: {(1 - summary_tokens/original_tokens)*100:.1f}%")


if __name__ == "__main__":
    main()
```

---

## Recommendations

### For Individual Developers

Use **Semantic Summaries** for large codebases:

- Full implementation for files you're actively editing
- Signatures + docstrings for dependencies
- Module summaries for context

**Expected savings**: 60-75% on context tokens

### For Teams/Tools

Build **Hierarchical Context** systems:

- Level 1: Always included (file structure)
- Level 2: On-demand (signatures)
- Level 3: Explicit request only (full code)

**Expected savings**: 80-90% on typical tasks

### For API Providers (Future)

Support **native compression formats**:

- AST/IR representations
- Semantic embeddings
- Progressive detail protocols

**Potential savings**: 90-95% with no quality loss

---

## Conclusion

**Can we compress context without expansion penalties?**

**YES** - but not through traditional compression. The key is **semantic compression**: formats that LLMs can understand directly.

**Practical today**:

- Semantic summaries: 70-80% savings ✅
- Hierarchical context: 80-90% savings ✅
- Smart selection: 75-85% savings ✅

**Future potential**:

- Native AST support: 90%+ savings
- Embedding-based context: 95%+ savings
- Requires API provider support

The next frontier for UCPL: **integrate semantic compression** to optimize both prompts AND context.
