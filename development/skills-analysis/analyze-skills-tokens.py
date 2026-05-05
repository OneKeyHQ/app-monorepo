#!/usr/bin/env python3
"""
Analyze Claude Code Skills token consumption

This script analyzes all skills in .claude/skills/ and estimates token usage.
Helps identify skills that should be split to optimize token consumption.

Usage:
    python3 development/skills-analysis/analyze-skills-tokens.py
    python3 development/skills-analysis/analyze-skills-tokens.py --detailed
    python3 development/skills-analysis/analyze-skills-tokens.py --sort-by-size
"""

import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple
import json

# Approximate token estimation: 1 token ≈ 4 characters (conservative estimate)
CHARS_PER_TOKEN = 4

def count_tokens(text: str) -> int:
    """Estimate token count from text."""
    return len(text) // CHARS_PER_TOKEN

def get_file_size_and_tokens(file_path: Path) -> Tuple[int, int]:
    """Get file size in bytes and estimated token count."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            return len(content.encode('utf-8')), count_tokens(content)
    except Exception as e:
        print(f"Error reading {file_path}: {e}", file=sys.stderr)
        return 0, 0

def analyze_skill(skill_dir: Path) -> Dict:
    """Analyze a single skill directory."""
    skill_name = skill_dir.name

    # Get SKILL.md stats
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return None

    skill_md_bytes, skill_md_tokens = get_file_size_and_tokens(skill_md)

    # Get all reference files
    references = []
    references_dir = skill_dir / "references" / "rules"
    if references_dir.exists():
        for ref_file in sorted(references_dir.glob("*.md")):
            bytes_size, tokens = get_file_size_and_tokens(ref_file)
            references.append({
                'name': ref_file.name,
                'bytes': bytes_size,
                'tokens': tokens,
                'kb': bytes_size / 1024
            })

    total_bytes = skill_md_bytes + sum(r['bytes'] for r in references)
    total_tokens = skill_md_tokens + sum(r['tokens'] for r in references)

    return {
        'name': skill_name,
        'skill_md_bytes': skill_md_bytes,
        'skill_md_tokens': skill_md_tokens,
        'references': references,
        'total_bytes': total_bytes,
        'total_tokens': total_tokens,
        'total_kb': total_bytes / 1024,
        'reference_count': len(references)
    }

def get_recommendation(skill: Dict) -> str:
    """Get splitting recommendation based on size."""
    total_kb = skill['total_kb']
    tokens = skill['total_tokens']

    if tokens > 10000:
        return "🚨 URGENT: Split immediately (>10k tokens)"
    elif tokens > 5000:
        return "⚠️  CONSIDER: Should be split (>5k tokens)"
    elif tokens > 2000:
        return "👀 MONITOR: Watch for growth (>2k tokens)"
    else:
        return "✅ OK: Reasonable size"

def print_summary(skills: List[Dict], sort_by_size: bool = False):
    """Print summary of all skills."""
    if sort_by_size:
        skills = sorted(skills, key=lambda s: s['total_tokens'], reverse=True)
    else:
        skills = sorted(skills, key=lambda s: s['name'])

    print("\n" + "="*100)
    print("CLAUDE CODE SKILLS TOKEN ANALYSIS")
    print("="*100)

    total_all_tokens = sum(s['total_tokens'] for s in skills)
    total_all_kb = sum(s['total_kb'] for s in skills)

    print(f"\n📊 OVERALL STATS:")
    print(f"   Total Skills: {len(skills)}")
    print(f"   Total Tokens: {total_all_tokens:,}")
    print(f"   Total Size: {total_all_kb:.1f} KB")
    print(f"   Average per Skill: {total_all_tokens // len(skills):,} tokens")

    print(f"\n{'Skill Name':<30} {'Tokens':>10} {'Size':>10} {'Files':>7} {'Recommendation':<40}")
    print("-" * 100)

    for skill in skills:
        rec = get_recommendation(skill)
        print(f"{skill['name']:<30} {skill['total_tokens']:>10,} {skill['total_kb']:>9.1f}K "
              f"{skill['reference_count']:>7} {rec:<40}")

    print("-" * 100)
    print(f"{'TOTAL':<30} {total_all_tokens:>10,} {total_all_kb:>9.1f}K")

    # Print recommendations
    urgent = [s for s in skills if s['total_tokens'] > 10000]
    consider = [s for s in skills if 5000 < s['total_tokens'] <= 10000]

    if urgent:
        print(f"\n🚨 URGENT SPLITS NEEDED ({len(urgent)} skills):")
        for skill in urgent:
            print(f"   • {skill['name']}: {skill['total_tokens']:,} tokens ({skill['total_kb']:.1f} KB)")
            if skill['references']:
                largest = sorted(skill['references'], key=lambda r: r['tokens'], reverse=True)[:3]
                for ref in largest:
                    print(f"      - {ref['name']}: {ref['tokens']:,} tokens ({ref['kb']:.1f} KB)")

    if consider:
        print(f"\n⚠️  CONSIDER SPLITTING ({len(consider)} skills):")
        for skill in consider:
            print(f"   • {skill['name']}: {skill['total_tokens']:,} tokens ({skill['total_kb']:.1f} KB)")

def print_detailed(skills: List[Dict]):
    """Print detailed analysis for each skill."""
    print("\n" + "="*100)
    print("DETAILED SKILL ANALYSIS")
    print("="*100)

    for skill in sorted(skills, key=lambda s: s['total_tokens'], reverse=True):
        rec = get_recommendation(skill)
        print(f"\n📁 {skill['name']}")
        print(f"   Total: {skill['total_tokens']:,} tokens ({skill['total_kb']:.1f} KB)")
        print(f"   Recommendation: {rec}")
        print(f"   SKILL.md: {skill['skill_md_tokens']:,} tokens")

        if skill['references']:
            print(f"   Reference files ({len(skill['references'])}):")
            for ref in sorted(skill['references'], key=lambda r: r['tokens'], reverse=True):
                print(f"      • {ref['name']:<40} {ref['tokens']:>7,} tokens ({ref['kb']:>6.1f} KB)")

def main():
    """Main entry point."""
    # Check if running from repo root
    skills_dir = Path('.claude/skills')
    if not skills_dir.exists():
        print("Error: .claude/skills directory not found", file=sys.stderr)
        print("Please run this script from the repository root", file=sys.stderr)
        sys.exit(1)

    # Parse arguments
    detailed = '--detailed' in sys.argv
    sort_by_size = '--sort-by-size' in sys.argv

    # Analyze all skills
    skills = []
    for skill_dir in sorted(skills_dir.iterdir()):
        if not skill_dir.is_dir():
            continue

        skill_data = analyze_skill(skill_dir)
        if skill_data:
            skills.append(skill_data)

    if not skills:
        print("No skills found to analyze", file=sys.stderr)
        sys.exit(1)

    # Print results
    print_summary(skills, sort_by_size=sort_by_size)

    if detailed:
        print_detailed(skills)

    # Print usage tips
    print("\n" + "="*100)
    print("USAGE TIPS:")
    print("="*100)
    print("• Run periodically to monitor skill growth")
    print("• Split skills >10k tokens immediately")
    print("• Consider splitting skills >5k tokens if topics are independent")
    print("• Keep related topics together if frequently used together")
    print("• Use --detailed flag for per-file breakdown")
    print("• Use --sort-by-size to see largest skills first")
    print("\nFor splitting guidelines, see: .claude/skills/1k-new-skill/SKILL.md")

if __name__ == '__main__':
    main()
