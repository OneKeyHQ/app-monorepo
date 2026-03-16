# Cherry-Pick Workflow

Collects merged PRs labeled `release-ready`, analyzes file-level dependencies between them, and cherry-picks to the current release branch in topological order. Stops on conflicts to help resolve them interactively.

## Pre-flight Checks

Before starting, verify three things:

### 1. On a release branch

```bash
current_branch=$(git branch --show-current)
```

The branch name must match `release/v*`. If not, list available release branches and ask the user to switch:

```bash
git branch -r | grep 'origin/release/'
```

### 2. Identify the App Shell tag

The release branch name encodes the version — `release/v6.1.0` corresponds to tag `v6.1.0`:

```bash
app_version=$(git branch --show-current | sed 's|release/||')
tag_date=$(git log -1 --format=%aI "$app_version")
```

`tag_date` is used to scope the PR query — only look at PRs merged after the tag was created.

### 3. Working tree is clean

```bash
git status --porcelain
```

Must be empty. Cherry-picking with uncommitted changes risks losing work.

## Step 1: Collect Pending PRs

Query GitHub for merged PRs with the `release-ready` label, merged after the App Shell tag date:

```bash
gh pr list \
  --state merged \
  --label release-ready \
  --search "merged:>$(echo $tag_date | cut -d'T' -f1)" \
  --json number,title,mergeCommit,mergedAt \
  --limit 500
```

From the JSON output, extract for each PR:
- `number` — PR number (for display and tracking)
- `title` — PR title (for the execution plan)
- `mergeCommit.oid` — the merge commit SHA on `x` (this is what gets cherry-picked)
- `mergedAt` — merge timestamp (for ordering)

## Step 2: Filter Already Cherry-Picked

`git cherry` compares two branches by patch content (not commit SHA), so it correctly detects cherry-picks even though they create new commits:

```bash
git cherry release/$app_version x
```

Output lines starting with `+` are not yet cherry-picked; `-` means already applied. Cross-reference the merge commit SHAs from Step 1 — only keep PRs whose commit shows `+`.

If nothing remains, report "No pending cherry-picks" and exit.

## Step 3: Dependency Analysis & Sorting

Cherry-pick order matters because commits that touch the same files can conflict if applied out of order. Sorting by file dependencies reduces avoidable conflicts.

For each pending commit, get its changed files:

```bash
git diff-tree --no-commit-id --name-only -r <commit-sha>
```

Build a dependency graph:
- For each pair of commits (A, B) where A was merged before B:
  - If they modify any of the same files → B depends on A
- Topological sort: dependencies first, then dependents
- Within the same dependency level, sort by `mergedAt` (earliest first)

Present the execution plan:

```
Pending cherry-picks (in execution order):

  1. #1234 — fix: resolve swap page crash (abc1234)
     Files: packages/kit/src/views/Swap/...
  2. #1256 — feat: add token search (def5678)
     Files: packages/kit/src/views/Market/...
  3. #1260 — fix: discovery banner width (ghi9012)
     Files: packages/kit/src/views/Discovery/...
     ⚠️  Depends on #1234 (shared file: packages/kit/src/components/Banner.tsx)

Proceed? (y/n)
```

Wait for user confirmation.

## Step 4: Execute Cherry-Picks

For each commit in sorted order:

```bash
git cherry-pick -x <commit-sha>
```

The `-x` flag appends "(cherry picked from commit ...)" to the message, creating an audit trail.

**On success:** Report progress and continue:
```
✅ [1/3] #1234 — fix: resolve swap page crash
```

**On conflict:** Enter conflict resolution mode (below).

## Conflict Resolution Mode

When `git cherry-pick` reports a conflict:

### 1. Show what's conflicting

```bash
git diff --name-only --diff-filter=U   # list conflicting files
```

Then read each conflicting file to show the conflict markers.

### 2. Analyze the cause

Compare the file on both branches to understand why the conflict occurred:
- **Prior cherry-pick overlap** — a previously cherry-picked commit changed the same area
- **Un-picked divergence** — a commit on `x` that wasn't cherry-picked modified this code
- **Trivial artifact** — import reordering, whitespace, formatting

Understanding the cause helps propose the right resolution.

### 3. Suggest resolution

- For trivial conflicts (import ordering, whitespace): propose auto-resolution
- For semantic conflicts: show both versions side-by-side and recommend which to keep, explaining why

### 4. User chooses

Offer four options:

| Option | Action |
|--------|--------|
| **a) Accept suggestion** | Apply the resolution, `git add` conflicting files, `git cherry-pick --continue` |
| **b) Manual edit** | User edits files, then confirm → `git add` + `git cherry-pick --continue` |
| **c) Skip this PR** | `git cherry-pick --abort`, add to skipped list, continue next |
| **d) Abort entire flow** | `git cherry-pick --abort`, report progress so far, exit |

## Step 5: Completion Report

```
Cherry-pick complete!

✅ Successfully cherry-picked:
  - #1234 — fix: resolve swap page crash
  - #1256 — feat: add token search

⏭️  Skipped:
  - #1260 — fix: discovery banner width (conflict — needs manual resolution)

Next step: /1k-bundle-release diff-check
```
