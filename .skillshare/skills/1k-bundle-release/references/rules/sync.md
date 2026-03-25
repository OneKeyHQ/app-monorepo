# Sync Workflow

Syncs release branch changes to `x` via rebase after a bundle release. Creates a sync branch from `x`, rebases release commits onto it, then pushes and creates a PR.

## Pre-flight Checks

### 1. Read release branch name

```bash
VERSION=$(grep -E '^VERSION=' .env.version | cut -d '=' -f 2)
RELEASE_BRANCH="release/v${VERSION}"
```

### 2. Confirm latest release is published

Check that `RELEASES.json` exists on the release branch and has at least one entry. Warn if not:

> "No releases recorded in RELEASES.json. Run `/1k-bundle-release publish` first."

### 3. Working tree is clean

```bash
git status --porcelain
```

Must be empty. If not, tell the user to commit or stash first.

### 4. Fetch latest state

```bash
git fetch origin "$RELEASE_BRANCH" x
```

## Step 1: Create sync branch from x

Create a sync branch based on `x`, not on the release branch:

```bash
SYNC_BRANCH="sync/${VERSION}-$(date +%Y%m%d)"
git checkout -b "$SYNC_BRANCH" origin/x
```

## Step 2: Cherry-pick or rebase release commits onto sync branch

Get the list of release-only commits (not yet on x) using patch-id comparison:

```bash
# List commits on release not yet in x (by patch-id)
git cherry origin/x "origin/$RELEASE_BRANCH"
```

Lines starting with `+` are new commits. For each `+` commit, cherry-pick onto the sync branch:

```bash
git cherry-pick <commit-sha>
```

Alternatively, use rebase to replay all release-only commits at once:

```bash
# Create a temp branch at release HEAD, rebase onto sync branch
git checkout -b temp-rebase "origin/$RELEASE_BRANCH"
git rebase "$SYNC_BRANCH"
git checkout "$SYNC_BRANCH"
git merge --ff-only temp-rebase
git branch -d temp-rebase
```

`git rebase` uses patch-id matching to automatically skip commits that have already been applied to `x` from previous syncs. Repeated syncs are safe — only new commits are replayed.

**On success:** Continue to Step 3.

**On conflict:** Enter conflict resolution mode (below).

## Conflict Resolution

When a conflict occurs:

### 1. Show what's conflicting

```bash
git diff --name-only --diff-filter=U
```

Read each conflicting file to show the conflict markers.

### 2. Analyze the cause

- **release side**: This is verified, released code. Its semantic intent should be preserved.
- **x side**: This may contain newer code that changed the surrounding context.

The goal: integrate the release change into x's current state, preserving the release change's behavior.

### 3. Suggest resolution

Propose a resolution based on the analysis. For each conflict:
- Show both versions side-by-side
- Recommend resolution, explaining which parts to keep from each side

### 4. User chooses

| Option | Action |
|--------|--------|
| **a) Accept suggestion** | Apply the resolution, `git add` conflicting files, `git rebase --continue` |
| **b) Manual edit** | User edits files, then confirm → `git add` + `git rebase --continue` |
| **c) Skip this commit** | `git rebase --skip`, add to skipped list, continue |
| **d) Abort entire sync** | `git rebase --abort`, clean up sync branch, exit |

## Step 3: Push sync branch and create PR

```bash
git push -u origin "$SYNC_BRANCH"

gh pr create \
  --base x \
  --head "$SYNC_BRANCH" \
  --title "chore: sync release/v${VERSION} to x" \
  --body "Sync bundle release changes from release/v${VERSION} to x."
```

## Step 4: Output

```
=== Sync PR Created ===

Release branch: $RELEASE_BRANCH
Sync branch: $SYNC_BRANCH
PR: $PR_URL

Commits synced:
  - abc1234 fix: resolve swap page crash (#1234)
  - def5678 feat: add token search (#1256)

⏭️  Skipped (if any):
  - ghi9012 fix: discovery banner width (#1260) — conflict, needs manual resolution

Review and merge the PR to complete the sync.
```
