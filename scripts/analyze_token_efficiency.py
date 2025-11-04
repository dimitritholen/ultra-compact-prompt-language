#!/usr/bin/env python3
"""
Token Efficiency Analyzer for UCPL

Compares token usage between:
1. Natural language prompts (baseline)
2. UCPL compact form (authoring cost)
3. UCPL expanded + UUIP (LLM processing cost)
4. Amortized cost over multiple uses

Validates the claim: "UCPL usage means spending less tokens"
"""

import sys
from pathlib import Path
from typing import Dict, Tuple
import re

try:
    import tiktoken
    HAS_TIKTOKEN = True
except ImportError:
    HAS_TIKTOKEN = False
    print("⚠️  Warning: tiktoken not installed. Using approximate token counts (4 chars ≈ 1 token)")
    print("   Install with: pip install tiktoken\n")


class TokenAnalyzer:
    """Analyzes token efficiency of UCPL vs natural language."""

    def __init__(self):
        if HAS_TIKTOKEN:
            # Use Claude tokenizer approximation (similar to GPT-4)
            self.encoder = tiktoken.encoding_for_model("gpt-4")
        else:
            self.encoder = None

    def count_tokens(self, text: str) -> int:
        """Count tokens in text using tiktoken or approximation."""
        if self.encoder:
            return len(self.encoder.encode(text))
        else:
            # Rough approximation: 1 token ≈ 4 characters
            return len(text) // 4

    def extract_ucpl_content(self, file_path: Path) -> str:
        """Extract UCPL content (excluding YAML header)."""
        content = file_path.read_text(encoding='utf-8')

        # Remove comment line
        content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)

        # Find YAML delimiters
        matches = list(re.finditer(r'^---\s*$', content, re.MULTILINE))

        if len(matches) >= 2:
            # Extract content after second delimiter
            return content[matches[1].end():].strip()

        return content.strip()

    def expand_ucpl_simple(self, ucpl: str) -> str:
        """
        Simple UCPL expansion for estimation.
        Real expansion would be more verbose.
        """
        lines = ucpl.split('\n')
        expanded = []

        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                continue

            # Directives
            if line.startswith('@role:'):
                role = line.split(':', 1)[1]
                expanded.append(f"You are a {role}.")

            elif line.startswith('@task:'):
                task = line.split(':', 1)[1]
                parts = task.split('|')
                if len(parts) > 1:
                    expanded.append(f"Your task is to {parts[0]} with focus on {', '.join(parts[1:])}.")
                else:
                    expanded.append(f"Your task is to {task}.")

            elif line.startswith('@scope:'):
                scope = line.split(':', 1)[1]
                expanded.append(f"Limit your work to {scope}.")

            elif line.startswith('@out:'):
                out = line.split(':', 1)[1].replace('+', ' and ')
                expanded.append(f"Output format: {out}.")

            elif line.startswith('@principles:'):
                principles = line.split(':', 1)[1].replace('+', ', ')
                expanded.append(f"Follow these principles: {principles}.")

            # Constraints
            elif line.startswith('!'):
                constraint = line[1:]
                expanded.append(f"MUST: {constraint}")

            elif line.startswith('?'):
                optional = line[1:]
                expanded.append(f"OPTIONAL: {optional}")

            elif line.startswith('~'):
                avoid = line[1:]
                expanded.append(f"AVOID: {avoid}")

            # Macros
            elif line.startswith('@def '):
                macro_name = line.split()[1].rstrip(':')
                expanded.append(f"Define a reusable function called '{macro_name}' that:")

            elif line.startswith('@use '):
                macro_name = line.split()[1]
                expanded.append(f"Execute the {macro_name} function.")

            # Workflows
            elif line.startswith('@workflow:'):
                expanded.append("Execute the following workflow:")

            elif line.startswith('@chain:'):
                expanded.append("Run these steps in sequence:")

            # Conditionals
            elif '@if ' in line:
                condition = line.split('@if ')[1].split(':')[0]
                expanded.append(f"If {condition}, then:")

            elif '@loop:' in line:
                expanded.append("Repeat the following:")

            elif '@until ' in line:
                condition = line.split('@until ')[1]
                expanded.append(f"Continue until {condition}.")

            # Variables
            elif '> $' in line:
                var = line.split('> $')[1]
                expanded.append(f"Store the result in variable ${var}.")

            # Tool invocations
            elif line.startswith('@@'):
                tool_match = re.match(r'@@(\w+):(\w+)(?:\[(.*?)\])?', line)
                if tool_match:
                    category, subcategory, params = tool_match.groups()
                    expanded.append(
                        f"MUST: Use available {category} tool (subcategory: {subcategory}) "
                        f"with parameters: {params or 'none'}."
                    )

            # Default: add as instruction
            elif line.strip():
                expanded.append(line)

        return '\n'.join(expanded)

    def analyze_file(self, ucpl_file: Path, uuip_file: Path) -> Dict:
        """Analyze token efficiency for a UCPL file."""

        # Read files
        ucpl_content = self.extract_ucpl_content(ucpl_file)
        uuip_content = uuip_file.read_text(encoding='utf-8')

        # Expand UCPL
        expanded_content = self.expand_ucpl_simple(ucpl_content)

        # Count tokens
        ucpl_tokens = self.count_tokens(ucpl_content)
        uuip_tokens = self.count_tokens(uuip_content)
        expanded_tokens = self.count_tokens(expanded_content)

        # Total LLM processing cost (UUIP + expanded UCPL)
        llm_processing_tokens = uuip_tokens + expanded_tokens

        # Natural language equivalent (expanded form is the baseline)
        natural_tokens = expanded_tokens

        # Calculate savings
        authoring_savings = natural_tokens - ucpl_tokens
        authoring_savings_pct = (authoring_savings / natural_tokens * 100) if natural_tokens > 0 else 0

        # LLM processing overhead
        processing_overhead = llm_processing_tokens - natural_tokens
        processing_overhead_pct = (processing_overhead / natural_tokens * 100) if natural_tokens > 0 else 0

        # Break-even point (uses needed for UUIP overhead to be worth it)
        if authoring_savings > 0 and processing_overhead > 0:
            break_even_uses = processing_overhead / authoring_savings
        else:
            break_even_uses = 0

        return {
            'file': ucpl_file.name,
            'ucpl_tokens': ucpl_tokens,
            'natural_tokens': natural_tokens,
            'uuip_tokens': uuip_tokens,
            'expanded_tokens': expanded_tokens,
            'llm_processing_tokens': llm_processing_tokens,
            'authoring_savings': authoring_savings,
            'authoring_savings_pct': authoring_savings_pct,
            'processing_overhead': processing_overhead,
            'processing_overhead_pct': processing_overhead_pct,
            'break_even_uses': break_even_uses,
        }

    def print_analysis(self, results: Dict):
        """Print detailed analysis results."""

        print(f"\n{'='*70}")
        print(f"Token Analysis: {results['file']}")
        print(f"{'='*70}\n")

        print("📝 Token Counts:")
        print(f"  UCPL (compact form):           {results['ucpl_tokens']:>6} tokens")
        print(f"  Natural language equivalent:   {results['natural_tokens']:>6} tokens")
        print(f"  UUIP interpreter overhead:     {results['uuip_tokens']:>6} tokens")
        print(f"  Expanded UCPL:                 {results['expanded_tokens']:>6} tokens")
        print(f"  LLM processing (UUIP+expanded): {results['llm_processing_tokens']:>6} tokens")

        print("\n💰 Savings Analysis:")
        print(f"  Authoring savings:             {results['authoring_savings']:>+6} tokens ({results['authoring_savings_pct']:>+6.1f}%)")
        print(f"  Processing overhead:           {results['processing_overhead']:>+6} tokens ({results['processing_overhead_pct']:>+6.1f}%)")

        if results['break_even_uses'] > 0:
            print(f"\n📊 Break-even Analysis:")
            print(f"  Break-even point:              {results['break_even_uses']:>6.1f} uses")
            print(f"  (UUIP overhead amortizes after ~{int(results['break_even_uses'])} prompt uses)")

        print("\n✅ Verdict:")
        if results['authoring_savings'] > 0:
            print(f"  ✓ UCPL saves {results['authoring_savings_pct']:.1f}% tokens for authoring")

        if results['break_even_uses'] <= 1:
            print(f"  ✓ Immediate net savings (no UUIP overhead)")
        elif results['break_even_uses'] <= 5:
            print(f"  ✓ Net savings after ~{int(results['break_even_uses'])} uses (low overhead)")
        elif results['break_even_uses'] <= 20:
            print(f"  ~ Net savings after ~{int(results['break_even_uses'])} uses (moderate overhead)")
        else:
            print(f"  ⚠ High overhead: needs ~{int(results['break_even_uses'])} uses to break even")

        # Overall recommendation
        print("\n💡 Recommendation:")
        if results['authoring_savings_pct'] > 50:
            print("  UCPL provides SIGNIFICANT authoring efficiency")
        elif results['authoring_savings_pct'] > 30:
            print("  UCPL provides GOOD authoring efficiency")
        else:
            print("  UCPL provides MODEST authoring efficiency")

        if results['break_even_uses'] <= 10:
            print("  UUIP overhead is REASONABLE for reusable prompts")
        else:
            print("  UUIP overhead is HIGH - consider inline expansion for one-off prompts")


def main():
    """Main entry point."""

    if len(sys.argv) < 2:
        print("Usage: python analyze_token_efficiency.py <ucpl_file> [uuip_file]")
        print("\nAnalyzes token efficiency of UCPL vs natural language prompts.")
        print("\nIf uuip_file is not provided, uses CLAUDE.md as default.")
        sys.exit(1)

    ucpl_file = Path(sys.argv[1])

    if len(sys.argv) > 2:
        uuip_file = Path(sys.argv[2])
    else:
        # Default to CLAUDE.md in current directory or parent
        uuip_file = Path("CLAUDE.md")
        if not uuip_file.exists():
            uuip_file = Path("../CLAUDE.md")
        if not uuip_file.exists():
            print("Error: CLAUDE.md (UUIP) not found. Please specify path.")
            sys.exit(1)

    if not ucpl_file.exists():
        print(f"Error: UCPL file not found: {ucpl_file}")
        sys.exit(1)

    if not uuip_file.exists():
        print(f"Error: UUIP file not found: {uuip_file}")
        sys.exit(1)

    analyzer = TokenAnalyzer()
    results = analyzer.analyze_file(ucpl_file, uuip_file)
    analyzer.print_analysis(results)


if __name__ == "__main__":
    main()
