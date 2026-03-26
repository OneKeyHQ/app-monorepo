# Checkout Workflow

Creates a development branch from the latest release branch. Reads VERSION from `.env.version` to determine the release branch automatically.

## Pre-flight Checks

### 1. Detect release branch

Use the **Release Branch Detection** logic from SKILL.md:

1. If already on a `release/v*` branch → use it directly
2. Otherwise → find the latest `release/v*` from remote (excluding `mock` branches)
3. Confirm with the user before proceeding

If no release branch is found, stop:

> "No release branch found on origin. Has the App Shell been released and the branch created?"

### 2. Working tree is clean

```bash
git status --porcelain
```

If not empty, stop:

> "You have uncommitted changes. Please commit or stash them before switching branches."

### 3. Verify release branch exists on remote

The detection logic already fetches from origin and validates the branch exists. If the branch was detected from remote listing, this is inherently verified. If the user specified a branch manually, confirm it exists:

```bash
git ls-remote --heads origin "$RELEASE_BRANCH"
```

## Step 1: Get branch name

If the user provided a branch name as argument (e.g., `/1k-bundle-release checkout feat/new-swap`), use it directly.

If no argument, ask:

> "Enter the name for your new branch (e.g., `feat/new-swap`, `fix/swap-crash`):"

## Step 2: Fetch and checkout

```bash
git fetch origin "$RELEASE_BRANCH"
git checkout -b <branch-name> "origin/$RELEASE_BRANCH"
```

## Step 3: Output

```
=== Branch Created ===

Base: origin/$RELEASE_BRANCH (latest)
New branch: <branch-name>

You're now on <branch-name>, based on the latest $RELEASE_BRANCH.
When ready, create a PR targeting $RELEASE_BRANCH.
```
