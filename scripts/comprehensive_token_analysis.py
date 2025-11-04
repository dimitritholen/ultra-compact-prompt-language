#!/usr/bin/env python3
"""
Comprehensive Token Analysis for UCPL Efficiency Claims

Tests the claim: "UCPL usage means spending less tokens"

Analyzes multiple scenarios:
1. One-off prompts (must include UUIP)
2. Reusable prompts (UUIP amortizes over multiple uses)
3. System-level UUIP (interpreter pre-loaded in system prompt)
4. Different prompt complexities (simple vs complex)
"""

import sys
from pathlib import Path
from typing import Dict, List
import re

try:
    import tiktoken
    HAS_TIKTOKEN = True
except ImportError:
    HAS_TIKTOKEN = False
    print("⚠️  Warning: tiktoken not installed. Using approximate token counts")
    print("   Install with: pip install tiktoken\n")


class ComprehensiveTokenAnalyzer:
    """Analyzes token efficiency across multiple scenarios."""

    def __init__(self):
        if HAS_TIKTOKEN:
            self.encoder = tiktoken.encoding_for_model("gpt-4")
        else:
            self.encoder = None

    def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        if self.encoder:
            return len(self.encoder.encode(text))
        else:
            return len(text) // 4  # Approximation

    def extract_ucpl_content(self, file_path: Path) -> str:
        """Extract UCPL content (excluding YAML header)."""
        content = file_path.read_text(encoding='utf-8')
        content = re.sub(r'<!--.*?-->', '', content, flags=re.DOTALL)
        matches = list(re.finditer(r'^---\s*$', content, re.MULTILINE))
        if len(matches) >= 2:
            return content[matches[1].end():].strip()
        return content.strip()

    def create_verbose_expansion(self, ucpl_content: str) -> str:
        """
        Create a VERBOSE natural language expansion.
        This simulates what a human would write without UCPL.
        """
        lines = ucpl_content.split('\n')
        sections = []
        current_section = []

        # Estimate verbose expansion by adding context and explanations
        verbose_multiplier = 2.5  # Natural language is ~2.5x more verbose

        for line in lines:
            line = line.strip()
            if not line or line.startswith('#'):
                continue

            # Roles and context
            if line.startswith('@role:'):
                role = line.split(':', 1)[1].replace('_', ' ')
                current_section.append(
                    f"You are acting as a {role}. "
                    f"Please adopt the mindset, expertise, and standards "
                    f"that are expected of someone in this role."
                )

            elif line.startswith('@task:'):
                task = line.split(':', 1)[1]
                parts = task.split('|')
                if len(parts) > 1:
                    current_section.append(
                        f"Your primary task is to {parts[0]}. "
                        f"Please pay special attention to the following aspects: "
                        f"{', '.join(parts[1:])}. Make sure to consider each of these "
                        f"thoroughly in your work."
                    )
                else:
                    current_section.append(
                        f"Your task is to {task}. Please complete this task "
                        f"with careful attention to detail and quality."
                    )

            elif line.startswith('@principles:'):
                principles = line.split(':', 1)[1].split('+')
                current_section.append(
                    f"Please adhere to the following software engineering principles "
                    f"throughout your work: {', '.join(principles)}. "
                    f"These principles should guide all of your design and implementation decisions."
                )

            # Constraints - verbose explanations
            elif line.startswith('!'):
                constraint = line[1:].replace('_', ' ')
                current_section.append(
                    f"IMPORTANT: It is mandatory that you {constraint}. "
                    f"This is a strict requirement and must not be overlooked. "
                    f"Please ensure this is satisfied before proceeding."
                )

            elif line.startswith('?'):
                optional = line[1:].replace('_', ' ')
                current_section.append(
                    f"If possible, it would be beneficial to {optional}. "
                    f"This is optional and not strictly required, but "
                    f"would improve the quality of the output if you can include it."
                )

            elif line.startswith('~'):
                avoid = line[1:].replace('_', ' ')
                current_section.append(
                    f"Please try to avoid {avoid}. While not strictly forbidden, "
                    f"this approach is discouraged and should only be used if "
                    f"absolutely necessary with clear justification."
                )

            # Macros - verbose function definitions
            elif line.startswith('@def '):
                macro_name = line.split()[1].rstrip(':').replace('_', ' ')
                current_section.append(
                    f"\n--- Define Reusable Function: {macro_name} ---\n"
                    f"Please create a reusable function or workflow step called "
                    f"'{macro_name}' that implements the following logic:"
                )

            elif line.startswith('@use '):
                macro_name = line.split()[1].replace('_', ' ')
                current_section.append(
                    f"Now, please execute the '{macro_name}' function that was "
                    f"defined earlier. Make sure to follow all the steps and "
                    f"requirements specified in its definition."
                )

            # Workflows
            elif line.startswith('@workflow:'):
                current_section.append(
                    "\n=== Workflow Execution ===\n"
                    "Please execute the following workflow step by step. "
                    "Each step must be completed fully before moving to the next step. "
                    "Do not skip any steps or change the order of execution."
                )

            elif line.startswith('@chain:'):
                current_section.append(
                    "Execute these steps in sequence, maintaining the exact order:"
                )

            # Conditionals
            elif '@if ' in line:
                condition = line.split('@if ')[1].split(':')[0]
                current_section.append(
                    f"Please check the following condition: {condition}. "
                    f"If this condition evaluates to true, then execute the following actions:"
                )

            elif '@loop:' in line:
                current_section.append(
                    "Please repeat the following steps iteratively. "
                    "Continue repeating until the exit condition is met:"
                )

            elif '@until ' in line:
                condition = line.split('@until ')[1]
                current_section.append(
                    f"Keep repeating the above steps until this condition is satisfied: {condition}. "
                    f"Check the condition after each iteration before continuing."
                )

            # Variables
            elif '> $' in line:
                var = line.split('> $')[1]
                current_section.append(
                    f"Please store the result of this operation in a variable named '{var}'. "
                    f"This variable will be referenced in subsequent steps."
                )

            # Tool invocations
            elif line.startswith('@@'):
                tool_match = re.match(r'@@(\w+):(\w+)(?:\[(.*?)\])?', line)
                if tool_match:
                    category, subcategory, params = tool_match.groups()
                    current_section.append(
                        f"MANDATORY: You must use an available {category} tool. "
                        f"Specifically, use any tool that provides {subcategory} functionality. "
                        f"Configure the tool with these parameters: {params or 'default settings'}. "
                        f"This step cannot be skipped or simulated - actual tool usage is required."
                    )

            # Output formats
            elif line.startswith('@out:'):
                out = line.split(':', 1)[1].replace('+', ' and ').replace('_', ' ')
                current_section.append(
                    f"Please format your output as follows: {out}. "
                    f"Make sure the output is well-structured and follows this format exactly."
                )

        return '\n\n'.join(current_section)

    def analyze_scenarios(self, ucpl_file: Path, uuip_file: Path) -> Dict:
        """Analyze token efficiency across multiple scenarios."""

        # Read files
        ucpl_content = self.extract_ucpl_content(ucpl_file)
        uuip_content = uuip_file.read_text(encoding='utf-8')

        # Create verbose natural language version
        verbose_natural = self.create_verbose_expansion(ucpl_content)

        # Count tokens
        ucpl_tokens = self.count_tokens(ucpl_content)
        uuip_tokens = self.count_tokens(uuip_content)
        verbose_tokens = self.count_tokens(verbose_natural)

        # Scenario analyses
        scenarios = {}

        # Scenario 1: One-off prompt (no UCPL, just natural language)
        scenarios['baseline_natural'] = {
            'name': 'Baseline (Natural Language)',
            'description': 'Traditional verbose prompt writing',
            'authoring_tokens': verbose_tokens,
            'processing_tokens': verbose_tokens,
            'total_tokens': verbose_tokens,
        }

        # Scenario 2: One-off UCPL with inline UUIP
        scenarios['oneoff_ucpl'] = {
            'name': 'One-off UCPL (with UUIP)',
            'description': 'UCPL + UUIP interpreter for single use',
            'authoring_tokens': ucpl_tokens,
            'processing_tokens': uuip_tokens + verbose_tokens,  # LLM sees UUIP + expanded
            'total_tokens': ucpl_tokens + uuip_tokens + verbose_tokens,
        }

        # Scenario 3: Reusable UCPL (5 uses)
        reuse_count_low = 5
        scenarios['reusable_ucpl_5x'] = {
            'name': f'Reusable UCPL ({reuse_count_low} uses)',
            'description': 'UCPL with UUIP loaded once, used 5 times',
            'authoring_tokens': ucpl_tokens * reuse_count_low,
            'processing_tokens': uuip_tokens + (verbose_tokens * reuse_count_low),
            'total_tokens': (ucpl_tokens * reuse_count_low) + uuip_tokens + (verbose_tokens * reuse_count_low),
            'vs_baseline': (verbose_tokens * reuse_count_low) - ((ucpl_tokens * reuse_count_low) + uuip_tokens),
        }

        # Scenario 4: Reusable UCPL (20 uses)
        reuse_count_high = 20
        scenarios['reusable_ucpl_20x'] = {
            'name': f'Reusable UCPL ({reuse_count_high} uses)',
            'description': 'UCPL with UUIP loaded once, used 20 times',
            'authoring_tokens': ucpl_tokens * reuse_count_high,
            'processing_tokens': uuip_tokens + (verbose_tokens * reuse_count_high),
            'total_tokens': (ucpl_tokens * reuse_count_high) + uuip_tokens + (verbose_tokens * reuse_count_high),
            'vs_baseline': (verbose_tokens * reuse_count_high) - ((ucpl_tokens * reuse_count_high) + uuip_tokens),
        }

        # Scenario 5: System-level UUIP (UUIP in system prompt, not counted per-use)
        scenarios['system_uuip'] = {
            'name': 'UCPL with System-level UUIP',
            'description': 'UUIP pre-loaded in system (like CLAUDE.md)',
            'authoring_tokens': ucpl_tokens,
            'processing_tokens': verbose_tokens,  # Only expanded UCPL counted per-use
            'total_tokens': ucpl_tokens + verbose_tokens,
            'uuip_overhead': 0,  # Amortized across all sessions
        }

        # Calculate compression ratios and savings
        for scenario_key, scenario in scenarios.items():
            if scenario_key != 'baseline_natural':
                baseline = scenarios['baseline_natural']['total_tokens']
                scenario['vs_baseline_tokens'] = scenario['total_tokens'] - baseline
                scenario['vs_baseline_pct'] = (scenario['vs_baseline_tokens'] / baseline * 100)

        # Calculate break-even point
        authoring_savings = verbose_tokens - ucpl_tokens
        if authoring_savings > 0:
            break_even = uuip_tokens / authoring_savings
        else:
            break_even = float('inf')

        return {
            'file': ucpl_file.name,
            'ucpl_tokens': ucpl_tokens,
            'verbose_tokens': verbose_tokens,
            'uuip_tokens': uuip_tokens,
            'authoring_savings': authoring_savings,
            'authoring_compression_ratio': verbose_tokens / ucpl_tokens if ucpl_tokens > 0 else 1,
            'break_even_uses': break_even,
            'scenarios': scenarios,
        }

    def print_comprehensive_report(self, results: Dict):
        """Print comprehensive analysis report."""

        print("\n" + "="*80)
        print(f"📊 COMPREHENSIVE TOKEN EFFICIENCY ANALYSIS: {results['file']}")
        print("="*80)

        print("\n📏 Token Measurements:")
        print(f"  UCPL (compact):              {results['ucpl_tokens']:>6} tokens")
        print(f"  Verbose natural language:    {results['verbose_tokens']:>6} tokens")
        print(f"  UUIP interpreter:            {results['uuip_tokens']:>6} tokens")
        print(f"  Authoring savings:           {results['authoring_savings']:>6} tokens ({results['authoring_compression_ratio']:.2f}x compression)")

        print(f"\n⚖️  Break-even Analysis:")
        print(f"  UCPL breaks even after:      {results['break_even_uses']:>6.1f} uses")

        print("\n" + "-"*80)
        print("SCENARIO COMPARISON")
        print("-"*80)

        baseline_tokens = results['scenarios']['baseline_natural']['total_tokens']

        for key, scenario in results['scenarios'].items():
            print(f"\n{scenario['name']}")
            print(f"  {scenario['description']}")
            print(f"  Authoring:   {scenario['authoring_tokens']:>6} tokens")
            print(f"  Processing:  {scenario['processing_tokens']:>6} tokens")
            print(f"  Total:       {scenario['total_tokens']:>6} tokens", end="")

            if key != 'baseline_natural':
                diff = scenario['total_tokens'] - baseline_tokens
                pct = (diff / baseline_tokens * 100)
                symbol = "💰" if diff < 0 else "⚠️"
                print(f"  {symbol} {diff:>+6} tokens ({pct:>+6.1f}%)")
            else:
                print("  (baseline)")

        print("\n" + "="*80)
        print("📋 VERDICT")
        print("="*80)

        compression = results['authoring_compression_ratio']
        print(f"\n✅ Authoring Efficiency:")
        print(f"   UCPL is {compression:.2f}x more compact than natural language")
        print(f"   Saves {results['authoring_savings']} tokens per prompt ({results['authoring_savings'] / results['verbose_tokens'] * 100:.1f}%)")

        print(f"\n💾 Processing Cost:")
        if results['break_even_uses'] <= 1:
            print(f"   ✅ NET SAVINGS even for one-off use")
        elif results['break_even_uses'] <= 5:
            print(f"   ✅ LOW OVERHEAD: breaks even after {int(results['break_even_uses'])} uses")
        elif results['break_even_uses'] <= 20:
            print(f"   ⚠️  MODERATE OVERHEAD: breaks even after {int(results['break_even_uses'])} uses")
        else:
            print(f"   ❌ HIGH OVERHEAD: needs {int(results['break_even_uses'])} uses to break even")

        print(f"\n💡 Recommendations:")

        # System-level scenario
        system_scenario = results['scenarios']['system_uuip']
        if system_scenario['total_tokens'] < baseline_tokens:
            savings_pct = abs(system_scenario['vs_baseline_pct'])
            print(f"   ✅ With system-level UUIP (like CLAUDE.md): {savings_pct:.1f}% token savings")

        # Reusable scenario
        reuse_scenario = results['scenarios']['reusable_ucpl_20x']
        if reuse_scenario['total_tokens'] < results['scenarios']['baseline_natural']['total_tokens'] * 20:
            print(f"   ✅ For reusable prompts: significant savings at scale")

        print("\n🎯 Overall Assessment:")
        if compression >= 2.0:
            print("   UCPL provides EXCELLENT authoring efficiency (2x+ compression)")
        elif compression >= 1.5:
            print("   UCPL provides GOOD authoring efficiency (1.5-2x compression)")
        else:
            print("   UCPL provides MODEST authoring efficiency (<1.5x compression)")

        # Final claim validation
        print("\n" + "="*80)
        print("🔍 CLAIM VALIDATION: 'UCPL usage means spending less tokens'")
        print("="*80)

        system_saves = system_scenario['total_tokens'] < baseline_tokens
        reuse_saves = results['scenarios']['reusable_ucpl_5x']['vs_baseline'] > 0

        if system_saves and reuse_saves:
            print("\n✅ CLAIM VALIDATED:")
            print("   YES - UCPL saves tokens in most practical scenarios:")
            print("   • With system-level UUIP (recommended setup)")
            print("   • For reusable prompts (>5 uses)")
            print("   • Significant authoring time savings in all cases")
        elif system_saves:
            print("\n⚠️  CLAIM PARTIALLY VALIDATED:")
            print("   YES for system-level UUIP (like CLAUDE.md)")
            print("   NO for one-off inline UUIP usage")
            print("   RECOMMENDATION: Use UCPL with system-level interpreter")
        else:
            print("\n❌ CLAIM NOT VALIDATED:")
            print("   Current implementation has high UUIP overhead")
            print("   Consider optimizing UUIP or using for complex prompts only")

        print("\n")


def main():
    """Main entry point."""

    if len(sys.argv) < 2:
        print("Usage: python comprehensive_token_analysis.py <ucpl_file> [uuip_file]")
        print("\nPerforms comprehensive token efficiency analysis across multiple scenarios.")
        sys.exit(1)

    ucpl_file = Path(sys.argv[1])

    if len(sys.argv) > 2:
        uuip_file = Path(sys.argv[2])
    else:
        uuip_file = Path("CLAUDE.md")
        if not uuip_file.exists():
            uuip_file = Path("../CLAUDE.md")

    if not ucpl_file.exists():
        print(f"Error: UCPL file not found: {ucpl_file}")
        sys.exit(1)

    if not uuip_file.exists():
        print(f"Error: UUIP file not found: {uuip_file}")
        sys.exit(1)

    analyzer = ComprehensiveTokenAnalyzer()
    results = analyzer.analyze_scenarios(ucpl_file, uuip_file)
    analyzer.print_comprehensive_report(results)


if __name__ == "__main__":
    main()
