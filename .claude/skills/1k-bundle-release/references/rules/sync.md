# Sync Workflow

Syncs release branch changes to `x` via rebase after a bundle release. Creates a temporary branch, rebases onto `x`, then fast-forward merges.

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

## Step 1: Create temporary sync branch

```bash
git checkout -b sync-to-x "origin/$RELEASE_BRANCH"
```

## Step 2: Rebase onto x

```bash
git rebase origin/x
```

`git rebase` uses patch-id matching to automatically skip commits that have already been applied to `x` from previous syncs. This means repeated syncs are safe — only new commits are replayed.

**On success:** All release-only commits are now replayed on top of `x`. Continue to Step 3.

**On conflict:** Enter conflict resolution mode (below).

## Conflict Resolution

When `git rebase` reports a conflict:

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
| **d) Abort entire sync** | `git rebase --abort`, clean up, exit |

## Step 3: Fast-forward merge to x

```bash
git checkout x
git merge --ff-only sync-to-x
```

If `--ff-only` fails (x has moved since fetch), re-fetch and retry:

```bash
git fetch origin x
git rebase origin/x
git checkout x
git pull origin x
git merge --ff-only sync-to-x
```

## Step 4: Clean up and push

```bash
git branch -d sync-to-x
git push origin x
```

## Step 5: Output

```
=== Sync Complete ===

Release branch: $RELEASE_BRANCH
Synced to: x

Commits synced:
  - abc1234 fix: resolve swap page crash (#1234)
  - def5678 feat: add token search (#1256)

⏭️  Skipped (if any):
  - ghi9012 fix: discovery banner width (#1260) — conflict, needs manual resolution

x branch is up to date with all released changes.
```
