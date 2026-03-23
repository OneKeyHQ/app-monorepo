# Diff Check Workflow

Pre-release validation: displays the changeset since the last release so the team knows exactly what's shipping, and checks sync status with `x`.

## Pre-flight Checks

### 1. Read release branch

```bash
VERSION=$(grep -E '^VERSION=' .env.version | cut -d '=' -f 2)
RELEASE_BRANCH="release/v${VERSION}"
current_branch=$(git branch --show-current)
```

If current branch is not the expected release branch, offer to switch:

> "You're on `$current_branch`, but the release branch is `$RELEASE_BRANCH`. Switch now? (y/n)"

If yes, run `git checkout $RELEASE_BRANCH`.

### 2. Fetch latest

```bash
git fetch origin "$RELEASE_BRANCH" x
```

## Check 1: Changeset Since Last Release

Shows what changed since the last published release for smoke testing scope and release notes.

### Get the baseline commit

Read `RELEASES.json` from the release branch root:

```bash
cat RELEASES.json
```

Parse the JSON and get the `commit` field from the entry with the highest `seq`.

If the file doesn't exist or is empty (first release for this branch), fall back to the App Shell tag:

```bash
base_sha=$(git rev-parse "v${VERSION}")
```

### Show the changeset

```bash
# Commit history
git log $base_sha..$RELEASE_BRANCH --oneline

# File change statistics
git diff --stat $base_sha..$RELEASE_BRANCH
```

### Generate GitHub compare link

```bash
repo_url=$(git remote get-url origin | sed 's/git@github.com:/https:\/\/github.com\//' | sed 's/\.git$//')
echo "${repo_url}/compare/${base_sha}...${RELEASE_BRANCH}"
```

### Identify included PRs

Since PRs are merged directly to the release branch, extract PR numbers from commit messages. GitHub uses two formats depending on merge strategy:
- Merge commit: `Merge pull request #1234 from user/branch`
- Squash merge: `feat: description (#1234)`

Extract all PR numbers with:

```bash
git log $base_sha..$RELEASE_BRANCH --format="%s" | grep -oE '#[0-9]+' | sort -u
```

## Check 2: Sync Status (Informational)

Show commits on the release branch that have not yet been synced to `x`. This is informational — it does NOT block publishing.

```bash
# Commits on release not reachable from x
# Note: after rebase sync, patch-ids match but SHAs differ,
# so use git cherry for patch-level comparison
git cherry x "$RELEASE_BRANCH" | grep '^+' | wc -l
```

If count > 0:

```
ℹ️  $count commit(s) on $RELEASE_BRANCH not yet synced to x.
   Run /1k-bundle-release sync after publishing.
```

## Output Summary

```
=== Release Diff Check Report ===

📦 Changes since last release (seq #$last_seq, sha: $base_sha):
   - $commit_count commits, $file_count files changed
   - PRs included: #1270, #1275, #1278
   - 🔗 Compare: $compare_url

ℹ️  Sync status: $unsync_count commit(s) pending sync to x

Conclusion: ✅ Ready for /1k-bundle-release publish
```
