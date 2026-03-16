# Diff Check Workflow

Pre-release validation with two checks: (1) verify the release branch is a strict subset of `x`, and (2) display the changeset since the last release so the team knows exactly what's shipping.

## Pre-flight Checks

### 1. On a release branch

```bash
current_branch=$(git branch --show-current)
# Must match: release/v*
```

### 2. Extract version

```bash
app_version=$(echo "$current_branch" | sed 's|release/||')
```

## Diff 1: Subset Verification

This is the most important check. The release branch must be a pure subset of `x` — no commits should exist on release that aren't on `x`.

```bash
git log release/$app_version --not x --oneline
```

**If empty → ✅ Pass**

```
✅ Subset check passed — all release branch commits exist on x
```

**If not empty → ❌ Fail**

```
❌ Subset check FAILED — release branch has commits not on x:

  abc1234 fix: conflict resolution for swap component
  def5678 chore: merge artifact cleanup

These must be reverse cherry-picked to x before publishing.
```

Explain to the user that these commits need to be cherry-picked to `x` first (they were likely created during conflict resolution on the release branch). After the user resolves this, they should re-run diff-check.

## Diff 2: Changeset Since Last Release

Shows what's changed since the last published release, so the team can scope smoke testing and write release notes.

### Get the baseline commit

Read `RELEASES.json` from the release branch root:

```bash
cat RELEASES.json
```

Parse the JSON and get the `commit` field from the entry with the highest `seq`.

If the file doesn't exist or is empty (first release for this branch), fall back to the App Shell tag:

```bash
base_sha=$(git rev-parse $app_version)
```

### Show the changeset

```bash
# Commit history
git log $base_sha..release/$app_version --oneline

# File change statistics
git diff --stat $base_sha..release/$app_version
```

### Generate GitHub compare link

Build a compare URL so the team can review the full diff in the browser:

```bash
# Derive GitHub repo URL from remote
repo_url=$(git remote get-url origin | sed 's/git@github.com:/https:\/\/github.com\//' | sed 's/\.git$//')

# Compare link: base_sha...release branch HEAD
echo "${repo_url}/compare/${base_sha}...release/${app_version}"
```

This produces a link like: `https://github.com/OneKeyHQ/app-monorepo/compare/abc1234...release/v5.20.0`

If the baseline is an App Shell tag (first release), prefer using the tag name for readability:

```
https://github.com/OneKeyHQ/app-monorepo/compare/v5.20.0...release/v5.20.0
```

### Identify included PRs

Cherry-pick commits created with `-x` contain "(cherry picked from commit ...)" in their message. Extract those original commit SHAs and cross-reference with `gh` to get PR numbers:

```bash
# Extract original commit SHAs from cherry-pick messages
git log $base_sha..release/$app_version --grep="cherry picked from" --format="%b" | grep -oP '(?<=cherry picked from commit )[a-f0-9]+'
```

## Supplementary: What's on `x` but NOT in release

This helps the team understand what was intentionally left out:

```bash
git log x --not release/$app_version --oneline
```

Generate a compare link for this direction too:

```
${repo_url}/compare/release/${app_version}...x
```

Cross-reference with PRs:
- **No `release-ready` label** → intentionally excluded, expected
- **Has `release-ready` label but not cherry-picked** → might be an oversight, flag it:

```
⚠️  PRs with 'release-ready' label NOT in this release:
  - #1280 — feat: add new chain support (merged 2026-03-14, not cherry-picked)
```

## Output Summary

```
=== Release Diff Check Report ===

📋 Subset verification: ✅ Pass
📦 Changes since last release (seq #2, sha: def5678):
   - 3 commits, 8 files changed
   - PRs included: #1270, #1275, #1278
   - 🔗 Compare: https://github.com/OneKeyHQ/app-monorepo/compare/def5678...release/v5.20.0

📋 Content on x not in this release:
   - 12 commits without 'release-ready' label (expected)
   - 1 commit with 'release-ready' label pending ⚠️
   - 🔗 Compare: https://github.com/OneKeyHQ/app-monorepo/compare/release/v5.20.0...x

Conclusion: ✅ Ready for /1k-bundle-release publish
```

Or if issues found:

```
Conclusion: ❌ Issues found — resolve before publishing
  - Subset check failed (2 commits need reverse cherry-pick to x)
  - 1 labeled PR not cherry-picked (#1280)
```
