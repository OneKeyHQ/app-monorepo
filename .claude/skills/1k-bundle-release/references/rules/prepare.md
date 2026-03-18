# Prepare Workflow

Prepares the release branch for bundle CI by writing `BUILD_NUMBER` to `.env.version`, then commits and pushes after user confirmation.

## Pre-flight Checks

### 1. On a release branch

```bash
current_branch=$(git branch --show-current)
# Must match: release/*
```

If not on a `release/*` branch, **stop immediately**:

> "You must be on a `release/*` branch to run this command. Current branch: `$current_branch`"

### 2. Working tree clean

```bash
git status --porcelain
```

Must be empty. If not, tell the user to commit or stash first.

### 3. Remote is up to date

```bash
git fetch origin $current_branch
git log HEAD..origin/$current_branch --oneline
```

If remote has new commits, warn the user and suggest pulling first.

## Step 1: Get BUILD_NUMBER from user

Ask the user for the `BUILD_NUMBER` value (the native App Shell build number this bundle targets).

Validate:
- Non-empty, digits only
- Typical format: `1026MMDD##` (e.g., `1026031801`)

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

BUILD_NUMBER=1026031801

# Will auto add BUILD_NUMBER and BUNDLE_VERSION variable at CI job. Must give an empty line at end of this file.
```

## Step 3: Show diff and confirm

Show the diff and target branch, then wait for user confirmation:

```
=== Prepare Bundle Release ===

Branch: release/v6.1.0
BUILD_NUMBER: 1026031801

Diff:
  (git diff .env.version output)

Proceed with commit and push to origin/release/v6.1.0? (y/n)
```

Do NOT proceed without explicit user confirmation.

## Step 4: Commit and push

```bash
git add .env.version
git commit -m "chore: set BUILD_NUMBER=$BUILD_NUMBER for bundle release"
git push origin $current_branch
```

## Step 5: Output

```
=== Bundle Release Prepared ===

Branch: release/v6.1.0
BUILD_NUMBER: 1026031801
Commit: abc1234

.env.version updated and pushed.
Next step: trigger release-app-bundles workflow via workflow_dispatch on this branch.
```
