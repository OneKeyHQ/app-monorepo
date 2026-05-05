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

## Example

5 cases: 3 BigNumber (NaN/precision/division), 1 cleanup, 1 stale closure.
→ BigNumber = NEW (3 hits) → Add one-line check to Section 1.
