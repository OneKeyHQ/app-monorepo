---
name: 1k-retrospective
description: >
  Analyze accumulated bug fix cases and propose updates to the self-testing checklist.
  Use periodically (weekly/monthly) to evolve quality checks based on real issues.
allowed-tools: Read, Grep, Glob, Write, StrReplace
---

# Retrospective: Evolve Self-Testing Rules from Real Cases

## Workflow

### Step 1: Read Cases

Read `.claude/skills/1k-retrospective/references/case-studies.md`. Count cases since the last `<!-- Retrospective completed -->` marker. If fewer than 3 new cases, report "Not enough new cases" and stop.

### Step 2: Analyze Patterns

For each case, extract root cause category and which self-testing section (1-8) could have caught it, or "NEW" if not covered. Aggregate counts per pattern.

### Step 3: Identify Gaps and Weak Spots

- **Gaps**: patterns appearing **2+ times** marked "NEW" → candidates for new check items
- **Weak spots**: patterns appearing **3+ times** already covered → check item needs stronger wording or more specificity

### Step 4: Propose Changes

Output a short report:

```
Retrospective — YYYY-MM-DD
Cases analyzed: N (date range: YYYY-MM-DD to YYYY-MM-DD)
Recurring patterns: [pattern] N (NEW/WEAK), [pattern] N (NEW/WEAK)
Proposed changes: Add [Section N] [one-line check] / Strengthen [Section N] [current → revised]
Housekeeping: archive candidates [list], zero-hit checks [list]
```

### Step 5: Apply Changes (after user confirmation)

Rules when modifying `self-testing.mdc`:
1. **Max 150 lines** — if exceeded, consolidate similar items or move details to `references/patterns.md`
2. **One-liner check items only** — no code examples in the rule file
3. **Keep 9-section structure** — new items go into existing sections, no new sections
4. **Never delete case entries** — mark archived with `[ARCHIVED]` prefix

### Step 6: Update Timestamp

Append to `case-studies.md`:
```
<!-- Retrospective completed: YYYY-MM-DD | Cases analyzed: N | Changes applied: N -->
```

### Step 7: Review-Fix Bloat Gate Calibration (Nash Equilibrium Audit)

During each periodic retrospective, also audit the Review-Fix Bloat Gate (`development/scripts/check-bloat.mjs`) against the latest 30–50 PRs on GitHub:

```bash
yarn check:bloat --benchmark 30
```

1. **Check False-Positive Rate (`bloat-reviewed` bypasses & high-deletion flags)**:
   - Target: `<= 2%` false positives on genuine refactors.
   - If PRs with healthy deletion ratios (`22%–24%`) or `bloat-reviewed` labels are being flagged, propose lowering `THRESHOLDS.minDeletionRatio` (e.g. `0.25 -> 0.22`) or raising `THRESHOLDS.baseComplexityBudget`.
2. **Check Intervention Band & Sub-Cliff Patch-Spinning**:
   - Healthy intervention rate across evaluated PRs is **`10%–25%`**.
   - If `borderlineSpinCandidates` reports PRs slipping just beneath the 120-line / 4-flag cliffs with `< 25%` deletion ratio, propose increasing `THRESHOLDS.stateFlagCostWeight` (e.g. `25 -> 35`) in `development/scripts/check-bloat.mjs`.
3. Include the benchmark summary and any proposed `THRESHOLDS` tuning in the retrospective report before modifying `development/scripts/check-bloat.mjs`.

## Example

5 cases: 3 BigNumber (NaN/precision/division), 1 cleanup, 1 stale closure.
→ BigNumber = NEW (3 hits) → Add one-line check to Section 1.
