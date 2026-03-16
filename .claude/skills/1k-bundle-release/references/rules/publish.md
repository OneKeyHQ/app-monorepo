# Publish Workflow

Finalizes a release by recording it in `RELEASES.json` and committing the tracking file. This creates the audit trail and provides the commit SHA for triggering CI.

## Pre-flight Checks

### 1. On a release branch

```bash
current_branch=$(git branch --show-current)
# Must match: release/v*
```

### 2. Subset check passes

```bash
result=$(git log $current_branch --not x --oneline)
```

Must be empty. If not, tell the user to run `/1k-bundle-release diff-check` first.

### 3. Working tree clean

```bash
git status --porcelain
```

Only `RELEASES.json` may have changes (or nothing — both are fine).

## Step 1: Collect Release Information

### Current HEAD

```bash
commit_sha=$(git rev-parse HEAD)
short_sha=$(git rev-parse --short HEAD)
```

### Included PRs

Determine the baseline (last release commit or App Shell tag), then list what's new:

```bash
# Read RELEASES.json for last release SHA, or fall back to tag
git log $base_sha..$commit_sha --oneline
```

Extract PR numbers from cherry-pick messages.

### Sequence number

If `RELEASES.json` exists and has entries: `seq = last_entry.seq + 1`
If first release: `seq = 1`

### Release notes

Ask the user:

> "Please provide release notes, or press Enter to auto-generate from PR titles:"

If the user skips, auto-generate by joining PR titles:

```
Fix swap page crash (#1234), Add token search (#1256)
```

## Step 2: Update RELEASES.json

Read the existing file (or initialize `[]` if first release). Append a new entry:

```json
{
  "seq": 3,
  "commit": "abc1234def5678",
  "date": "2026-03-15T10:30:00Z",
  "prs": ["#1234", "#1256", "#1260"],
  "notes": "Fix swap page crash, add token search, fix discovery banner width"
}
```

- **date**: ISO 8601 UTC
- **commit**: full SHA (not short)
- **prs**: array of PR number strings with `#` prefix
- **notes**: user-provided or auto-generated

Write the updated JSON with 2-space indentation.

## Step 3: Commit

```bash
git add RELEASES.json
git commit -m "chore: release #$seq"
```

## Step 4: Output

```
=== Release #3 Published ===

📦 Commit: abc1234 (release/v6.1.0)
📋 PRs: #1234, #1256, #1260
📝 Notes: Fix swap page crash, add token search, fix discovery banner width

To trigger CI build, use workflow_dispatch with:
  Branch: release/v6.1.0
  Commit: abc1234def5678

Release recorded in RELEASES.json
```
