#!/usr/bin/env python3
"""
Complete Token Comparison: All Approaches

Compares token usage across:
1. Natural language (baseline)
2. UCPL + full UUIP (current)
3. UCPL + cached UUIP (optimization 1)
4. UCPL → Structured Schema (optimization 2)
5. Cached UUIP + Structured Schema (optimal hybrid)
"""

import sys
import json
import subprocess
from pathlib import Path

try:
    import tiktoken
    HAS_TIKTOKEN = True
except ImportError:
    HAS_TIKTOKEN = False


def count_tokens(text: str) -> int:
    """Count tokens."""
    if HAS_TIKTOKEN:
        encoder = tiktoken.encoding_for_model("gpt-4")
        return len(encoder.encode(text))
    return len(text) // 4


def main():
    if len(sys.argv) < 2:
        print("Usage: python compare_all_approaches.py <ucpl_file>")
        sys.exit(1)

    ucpl_file = Path(sys.argv[1])
    uuip_file = Path("CLAUDE.md")

    if not ucpl_file.exists():
        print(f"Error: {ucpl_file} not found")
        sys.exit(1)

    if not uuip_file.exists():
        uuip_file = Path("../CLAUDE.md")

    # Read files
    with open(ucpl_file) as f:
        ucpl_content = f.read()

    with open(uuip_file) as f:
        uuip_content = f.read()

    # Get structured schema
    result = subprocess.run(
        ["python", "scripts/ucpl_to_schema.py", str(ucpl_file), "--output", "compact"],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print("Error generating schema")
        sys.exit(1)

    # Parse output (first line is JSON, second is token estimate)
    lines = result.stdout.strip().split('\n')
    schema_json = lines[0] if lines else "{}"
    schema = json.loads(schema_json)

    # Token counts
    ucpl_tokens = count_tokens(ucpl_content)
    uuip_tokens = count_tokens(uuip_content)
    schema_tokens = count_tokens(schema_json)

    # Estimate verbose natural language (2x UCPL for conservative estimate)
    verbose_tokens = ucpl_tokens * 2

    print("\n" + "="*80)
    print(f"TOKEN COMPARISON: {ucpl_file.name}")
    print("="*80 + "\n")

    approaches = [
        {
            "name": "1. Verbose Natural Language (Baseline)",
            "description": "Traditional hand-written prompt",
            "tokens": verbose_tokens,
            "breakdown": f"Authored: {verbose_tokens}",
            "is_baseline": True,
        },
        {
            "name": "2. UCPL + Full UUIP (Current)",
            "description": "UCPL with UUIP interpreter every time",
            "tokens": uuip_tokens + verbose_tokens,
            "breakdown": f"UUIP: {uuip_tokens} + Expanded: {verbose_tokens}",
            "is_baseline": False,
        },
        {
            "name": "3. UCPL + Cached UUIP",
            "description": "UUIP cached, only process expanded form",
            "tokens": verbose_tokens,
            "breakdown": f"UUIP: 0 (cached) + Expanded: {verbose_tokens}",
            "is_baseline": False,
        },
        {
            "name": "4. UCPL → Structured Schema",
            "description": "Convert to JSON schema, no UUIP needed",
            "tokens": schema_tokens,
            "breakdown": f"Schema: {schema_tokens}",
            "is_baseline": False,
        },
        {
            "name": "5. 🏆 OPTIMAL: Cached UUIP + Structured Schema",
            "description": "Best of both worlds",
            "tokens": schema_tokens,
            "breakdown": f"UUIP: 0 (cached) + Schema: {schema_tokens}",
            "is_baseline": False,
        },
    ]

    baseline_tokens = verbose_tokens

    for i, approach in enumerate(approaches, 1):
        print(f"{approach['name']}")
        print(f"  {approach['description']}")
        print(f"  {approach['breakdown']}")
        print(f"  Total: {approach['tokens']} tokens", end="")

        if not approach['is_baseline']:
            diff = approach['tokens'] - baseline_tokens
            pct = (diff / baseline_tokens * 100)

            if diff < 0:
                symbol = "✅"
                print(f"  {symbol} {diff} tokens ({pct:.1f}%) SAVINGS")
            elif diff > 0:
                symbol = "⚠️ "
                print(f"  {symbol} +{diff} tokens (+{pct:.1f}%) OVERHEAD")
            else:
                print(f"  ≈ Same as baseline")
        else:
            print()

        print()

    # Summary
    optimal_tokens = schema_tokens
    savings = baseline_tokens - optimal_tokens
    savings_pct = (savings / baseline_tokens * 100)

    print("="*80)
    print("📊 SUMMARY")
    print("="*80 + "\n")
    print(f"Baseline (natural language):     {baseline_tokens:>6} tokens")
    print(f"Current (UCPL + UUIP):           {uuip_tokens + verbose_tokens:>6} tokens  (+{((uuip_tokens + verbose_tokens) / baseline_tokens * 100) - 100:.0f}% overhead)")
    print(f"Optimal (Cached UUIP + Schema):  {optimal_tokens:>6} tokens  ({savings_pct:.1f}% savings)")
    print()
    print(f"✨ Net savings: {savings} tokens ({savings_pct:.0f}%)")
    print()

    # Recommendations
    print("="*80)
    print("💡 RECOMMENDATIONS")
    print("="*80 + "\n")

    if savings_pct > 50:
        print("✅ EXCELLENT: Optimal approach saves >50% tokens")
        print("   Implement prompt caching + structured schema immediately")
    elif savings_pct > 30:
        print("✅ GOOD: Optimal approach saves >30% tokens")
        print("   Worthwhile to implement for production use")
    elif savings_pct > 10:
        print("⚠️  MODEST: Optimal approach saves >10% tokens")
        print("   Consider for high-volume use cases")
    else:
        print("❌ LOW IMPACT: Limited token savings")
        print("   Focus on authoring efficiency benefits instead")

    print()

    # Next steps
    print("🚀 NEXT STEPS:")
    print("   1. Enable Claude API prompt caching for UUIP")
    print("   2. Implement UCPL → Schema converter in production")
    print("   3. Update CLAUDE.md to accept schema format")
    print("   4. Benchmark end-to-end performance")
    print()


if __name__ == "__main__":
    main()
