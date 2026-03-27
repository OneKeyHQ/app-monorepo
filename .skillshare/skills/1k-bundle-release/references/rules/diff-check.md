# Diff Check Workflow

Pre-release validation: displays the changeset since the last release so the team knows exactly what's shipping, and checks sync status with `x`.

## Pre-flight Checks

### 1. Detect release branch

Use the **Release Branch Detection** logic from SKILL.md:

1. If already on a `release/v*` branch → use it directly
2. Otherwise → find the latest `release/v*` from remote (excluding `mock` branches)
3. Confirm with the user before proceeding

If not on the release branch, offer to switch:

> "You're on `$current_branch`, but the release branch is `$RELEASE_BRANCH`. Switch now? (y/n)"

If yes, run `git checkout $RELEASE_BRANCH`.

### 2. Fetch latest

```bash
git fetch origin "$RELEASE_BRANCH" x
```

## Check 1: Changeset Since Last Release

Shows what changed since the last published release for smoke testing scope and release notes.

### Determine baselines

Two baselines are needed to show both full and incremental views:

1. **App Shell tag** — the starting point of this release branch:

```bash
# Extract version from RELEASE_BRANCH (e.g., "release/v6.1.0" → "6.1.0")
VERSION="${RELEASE_BRANCH#release/v}"
tag_sha=$(git rev-parse "v${VERSION}")
```

2. **Last bundle release** — read `RELEASES.json` from the release branch:

```bash
git show "$RELEASE_BRANCH:RELEASES.json" 2>/dev/null
```

Parse the JSON and get the `commit` field from the entry with the highest `seq`. If the file doesn't exist or is empty (first bundle release), `last_release_sha` is the same as `tag_sha`.

### Show the changeset

Display both views — full (since tag) and incremental (since last bundle release):

```bash
# === Full changeset (tag → HEAD) ===
git log $tag_sha..$RELEASE_BRANCH --oneline
git diff --stat $tag_sha..$RELEASE_BRANCH

# === Incremental changeset (last release → HEAD) ===
# Only show if last_release_sha != tag_sha (i.e., not the first release)
git log $last_release_sha..$RELEASE_BRANCH --oneline
git diff --stat $last_release_sha..$RELEASE_BRANCH
```

### Generate GitHub compare links

```bash
repo_url=$(git remote get-url origin | sed 's/git@github.com:/https:\/\/github.com\//' | sed 's/\.git$//')

# Full: tag → release branch
echo "${repo_url}/compare/${tag_sha}...${RELEASE_BRANCH}"

# Incremental: last release → release branch (only if different from full)
if [ "$last_release_sha" != "$tag_sha" ]; then
  echo "${repo_url}/compare/${last_release_sha}...${RELEASE_BRANCH}"
fi

# Sync gap: what's on release but not yet on x
echo "${repo_url}/compare/x...${RELEASE_BRANCH}"
```

### Identify included PRs

Since PRs are merged directly to the release branch, extract PR numbers from commit messages. GitHub uses two formats depending on merge strategy:
- Merge commit: `Merge pull request #1234 from user/branch`
- Squash merge: `feat: description (#1234)`

Extract from both ranges:

```bash
# Full (all PRs since tag)
git log $tag_sha..$RELEASE_BRANCH --format="%s" | grep -oE '#[0-9]+' | sort -u

# Incremental (new PRs since last release, only if applicable)
if [ "$last_release_sha" != "$tag_sha" ]; then
  git log $last_release_sha..$RELEASE_BRANCH --format="%s" | grep -oE '#[0-9]+' | sort -u
fi
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

IMPORTANT: Do NOT put compare URLs inside code blocks — they must be rendered as clickable markdown links. Use this format:

---

=== Release Diff Check Report ===

📦 **Full changeset** (tag v$VERSION → $RELEASE_BRANCH):
- $full_commit_count commits, $full_file_count files changed
- PRs included: #1270, #1275, #1278
- 🔗 Compare: $full_compare_url

📦 **Incremental changeset** (seq #$last_seq → $RELEASE_BRANCH):
*Only shown when last_release_sha ≠ tag_sha (i.e., not the first bundle release)*
- $incr_commit_count new commits, $incr_file_count files changed
- New PRs: #1290, #1292
- 🔗 Compare: $incr_compare_url

🔄 **Sync gap** ($RELEASE_BRANCH vs x):
- 🔗 Compare: $sync_compare_url

ℹ️ Sync status: $unsync_count commit(s) pending sync to x

Conclusion: ✅ Ready for `/1k-bundle-release publish`

💡 Tip: Run `/1k-bundle-release audit` for a full security audit before publishing.
