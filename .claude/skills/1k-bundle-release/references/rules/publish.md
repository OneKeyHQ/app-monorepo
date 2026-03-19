# Publish Workflow

Finalizes a release by recording it in `RELEASES.json` and committing the tracking file. This creates the audit trail and provides the commit SHA for triggering CI.

## Pre-flight Checks

### 1. Read release branch and verify

```bash
VERSION=$(grep -E '^VERSION=' .env.version | cut -d '=' -f 2)
RELEASE_BRANCH="release/v${VERSION}"
current_branch=$(git branch --show-current)
```

If current branch is not the expected release branch, offer to switch:

> "You're on `$current_branch`, but the release branch is `$RELEASE_BRANCH`. Switch now? (y/n)"

If yes, run `git checkout $RELEASE_BRANCH`.

### 2. Working tree clean

```bash
git status --porcelain
```

Only `RELEASES.json` may have changes (or nothing — both are fine).

## Step 1: Collect Release Information

### Record current HEAD (before RELEASES.json commit)

```bash
commit_sha=$(git rev-parse HEAD)
short_sha=$(git rev-parse --short HEAD)
```

This is the last code-change commit. It becomes the `commit` field in RELEASES.json and the baseline for the next diff-check.

### Included PRs

Determine the baseline (last release commit from RELEASES.json, or App Shell tag `v${VERSION}` for first release):

```bash
git log $base_sha..$commit_sha --oneline
```

Extract PR numbers from commit messages (handles both merge and squash formats):

```bash
git log $base_sha..$commit_sha --format="%s" | grep -oE '#[0-9]+' | sort -u
```

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
  "commit": "abc1234def5678...",
  "date": "2026-03-15T10:30:00Z",
  "prs": ["#1234", "#1256", "#1260"],
  "notes": "Fix swap page crash, add token search, fix discovery banner width"
}
```

Field details:
- **seq**: auto-incremented
- **commit**: full SHA of the last code commit (before this RELEASES.json update)
- **date**: ISO 8601 UTC, current time
- **prs**: array of PR number strings with `#` prefix
- **notes**: user-provided or auto-generated

Write the updated JSON with 2-space indentation.

## Step 3: Commit and push

```bash
git add RELEASES.json
git commit -m "chore: release #$seq"
git push origin $RELEASE_BRANCH
```

## Step 4: Output

```
=== Release #$seq Published ===

📦 Commit: $short_sha ($RELEASE_BRANCH)
📋 PRs: #1234, #1256, #1260
📝 Notes: $notes

To trigger CI build, use workflow_dispatch on branch: $RELEASE_BRANCH

Release recorded in RELEASES.json.
Next step: /1k-bundle-release sync (sync changes to x)
```

Note: The `commit` SHA in RELEASES.json refers to a release-branch commit. After sync (rebase), this SHA will NOT exist on `x` — this is expected. All RELEASES.json-based diffs must be run on the release branch.
