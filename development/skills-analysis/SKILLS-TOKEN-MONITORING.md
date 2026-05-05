# Skills Token Monitoring

This guide explains how to monitor and optimize Claude Code Skills token consumption.

## Why Monitor Token Consumption?

Claude Code loads skills on-demand based on trigger words. Large skills cause:
- **Higher token usage** on every load
- **Slower response times** (more content to process)
- **Unnecessary context** (loading unrelated topics)

**Goal**: Keep skills focused and under 5,000 tokens for optimal performance.

## Monitoring Tool

### Quick Start

```bash
# Basic analysis (sorted by name)
python3 development/skills-analysis/analyze-skills-tokens.py

# Sort by size (largest first)
python3 development/skills-analysis/analyze-skills-tokens.py --sort-by-size

# Detailed breakdown per file
python3 development/skills-analysis/analyze-skills-tokens.py --detailed
```

### Understanding the Output

```
Skill Name                         Tokens       Size   Files Recommendation
----------------------------------------------------------------------------------------------------
react-best-practices               14,345      56.1K      45 🚨 URGENT: Split immediately (>10k tokens)
1k-sentry-analysis                  9,394      37.9K       1 ⚠️  CONSIDER: Should be split (>5k tokens)
1k-feature-guides                   8,493      34.4K       4 ⚠️  CONSIDER: Should be split (>5k tokens)
1k-performance                      6,267      24.7K       1 ⚠️  CONSIDER: Should be split (>5k tokens)
1k-code-quality                     3,732      14.7K       2 👀 MONITOR: Watch for growth (>2k tokens)
```

**Recommendation levels:**
- 🚨 **URGENT** (>10k tokens): Split immediately
- ⚠️ **CONSIDER** (5-10k tokens): Should be split if topics are independent
- 👀 **MONITOR** (2-5k tokens): Watch for growth, split if reaches 5k
- ✅ **OK** (<2k tokens): Reasonable size

## Token Savings from Recent Splits

| Split | Before | After (per scenario) | Savings |
|-------|--------|---------------------|---------|
| `1k-coding-patterns` → 6 skills | 15 KB always loaded | 3-5 KB per task | **47-53%** |
| `1k-dev-workflows` → 3 skills | 43 KB always loaded | 5-9 KB per task | **80%** |

## When to Split

### Decision Criteria

**SPLIT if ANY of these apply:**
- ✅ File size >10 KB or >1000 lines
- ✅ Topics used in different scenarios (low correlation)
- ✅ Independent workflows that don't share patterns
- ✅ Distinct trigger words that rarely overlap

**KEEP TOGETHER if:**
- ✅ High correlation (>50% of uses need both topics)
- ✅ Shared concepts, terminology, or workflows
- ✅ All files <5 KB each
- ✅ User thinks of topics as naturally related

### Token Savings Formula

```
Savings = (Skill_Size × Probability_Not_Needed) - Split_Overhead

Where:
- Skill_Size: Total tokens in skill
- Probability_Not_Needed: % of tasks that don't need this topic
- Split_Overhead: ~500-1000 tokens (new SKILL.md + metadata)
```

**Example:**
- Skill: 10,000 tokens
- Topic used in 20% of cases → 80% don't need it
- Savings: 10,000 × 0.8 - 1,000 = **7,000 tokens (70% reduction)**

## Splitting Workflow

See detailed workflow in: [.claude/skills/1k-new-skill/SKILL.md](../.claude/skills/1k-new-skill/SKILL.md#splitting-workflow)

**Quick steps:**
1. Run analysis to identify split candidates
2. Analyze file sizes: `ls -lh .claude/skills/<skill>/references/rules/`
3. Identify independent topics with distinct trigger words
4. Create new skill directories
5. Move files (git tracks as rename)
6. Create SKILL.md for each new skill
7. Update cross-references
8. Commit with descriptive message

## Monitoring Schedule

**Recommended:**
- 📅 **Monthly**: Run basic analysis to track growth
- 📅 **After major additions**: Run detailed analysis
- 📅 **Before releases**: Ensure no skills >10k tokens
- 🆕 **After creating/modifying skills**: REQUIRED - Run analysis before committing

**Add to your workflow:**
```bash
# Required: After creating or modifying any skill
python3 development/skills-analysis/analyze-skills-tokens.py --sort-by-size

# Check specific skill
python3 development/skills-analysis/analyze-skills-tokens.py --detailed | grep -A 5 "your-skill-name"

# Pre-release checklist
python3 development/skills-analysis/analyze-skills-tokens.py --sort-by-size
```

### Required: Post-Creation Self-Check

**ALWAYS run after creating or modifying skills:**

1. **Create/modify skill** - Write SKILL.md and reference files
2. **Run analysis** - `python3 development/skills-analysis/analyze-skills-tokens.py --sort-by-size`
3. **Verify results** - Check token count and recommendations
4. **Take action** - Split if needed, or document justification for size
5. **Commit** - Only after verification passes

**Acceptance criteria:**
- ✅ New skill <5k tokens (ideal) OR
- ✅ 5-10k tokens with documented high correlation (>50% usage together) OR
- ✅ >10k tokens split into focused skills before committing

**Example workflow:**
```bash
# 1. Create new skill
mkdir -p .claude/skills/1k-my-feature/references/rules
# ... write SKILL.md and rules ...

# 2. REQUIRED: Run analysis
python3 development/skills-analysis/analyze-skills-tokens.py --sort-by-size

# 3. Check your skill
python3 development/skills-analysis/analyze-skills-tokens.py --detailed | grep -A 10 "1k-my-feature"

# 4. If >10k tokens, split before proceeding
# If 5-10k tokens, document why topics are correlated

# 5. Only then commit
git add .claude/skills/1k-my-feature/
git commit -m "feat: add 1k-my-feature skill (X tokens, verified)"
```

This ensures all new skills are optimized from day one.

## Current Status

As of 2026-01-30:
- **Total skills**: 23
- **Total tokens**: 76,200 (303 KB)
- **Average per skill**: 3,313 tokens
- **Urgent splits needed**: 1 (react-best-practices)
- **Consider splitting**: 3 (1k-sentry-analysis, 1k-feature-guides, 1k-performance)

## Related Documentation

- [Creating Skills Best Practices](./.claude/skills/1k-new-skill/SKILL.md)
- [Token Optimization Guidelines](./.claude/skills/1k-new-skill/SKILL.md#token-optimization-considerations)
- [Splitting Workflow](./.claude/skills/1k-new-skill/SKILL.md#splitting-workflow)

## FAQs

### Why 4 chars per token?

This is a conservative estimate. Actual ratio varies by content:
- English prose: ~4 chars/token
- Code: ~3-3.5 chars/token
- Markdown: ~4-5 chars/token

We use 4 as a middle ground for mixed content.

### Should I split skills that are "OK" (< 2k tokens)?

Generally no. Small skills have overhead (metadata, cross-references). Only split if:
- Topics are completely unrelated
- You're adding significant new content
- Usage patterns show they're never used together

### What about skills with many small files?

Many small files (< 1 KB each) are fine if:
- They're related topics (shared concepts)
- Used together frequently
- Total skill size < 5k tokens

Example: `react-best-practices` has 45 files but could be split by category (rendering, async, bundle, etc.)
