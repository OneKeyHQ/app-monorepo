# Prepare Workflow

Prepares the release branch for bundle CI by writing `BUILD_NUMBER` to `.env.version`, then commits and pushes after user confirmation.

## Pre-flight Checks

### 1. Detect release branch

Use the **Release Branch Detection** logic from SKILL.md:

1. If already on a `release/v*` branch → use it directly
2. Otherwise → find the latest `release/v*` from remote (excluding `mock` branches)
3. Confirm with the user before proceeding

If not on the release branch, offer to switch:

> "You're on `$current_branch`, but the release branch is `$RELEASE_BRANCH`. Switch now? (y/n)"

If yes, run `git checkout $RELEASE_BRANCH`.

### 2. Working tree clean

```bash
git status --porcelain
```

Must be empty. If not, tell the user to commit or stash first.

### 3. Remote is up to date

```bash
git fetch origin $RELEASE_BRANCH
git log HEAD..origin/$RELEASE_BRANCH --oneline
```

If remote has new commits, warn the user and suggest pulling first.

## Step 1: Get BUILD_NUMBER from user

Ask the user for the `BUILD_NUMBER` value (the native App Shell build number this bundle targets).

Validate:
- Non-empty, digits only
- Format: `YYYYMMDD##` (e.g., `2026031801`)

If invalid, explain the expected format and ask again.

## Step 2: Write to .env.version

Read `.env.version`. Append `BUILD_NUMBER=<value>` before the trailing comment line. If `BUILD_NUMBER=` already exists, replace it.

Before:
```
# VERSION: https://semver.org/

VERSION=6.1.0

# Will auto add BUILD_NUMBER and BUNDLE_VERSION variable at CI job. Must give an empty line at end of this file.
```

After:
```
# VERSION: https://semver.org/

VERSION=6.1.0

BUILD_NUMBER=2026031801

# Will auto add BUILD_NUMBER and BUNDLE_VERSION variable at CI job. Must give an empty line at end of this file.
```

## Step 3: Show diff and confirm

Show the diff and target branch, then wait for user confirmation:

```
=== Prepare Bundle Release ===

Branch: $RELEASE_BRANCH
BUILD_NUMBER: 2026031801

Diff:
  (git diff .env.version output)

Proceed with commit and push to origin/$RELEASE_BRANCH? (y/n)
```

Do NOT proceed without explicit user confirmation.

## Step 4: Commit and push

```bash
git add .env.version
git commit -m "chore: set BUILD_NUMBER=$BUILD_NUMBER for bundle release"
git push origin $RELEASE_BRANCH
```

## Step 5: Output

```
=== Bundle Release Prepared ===

Branch: $RELEASE_BRANCH
BUILD_NUMBER: 2026031801
Commit: abc1234

.env.version updated and pushed.
Next step: trigger release-app-bundles workflow via workflow_dispatch on this branch.
```
