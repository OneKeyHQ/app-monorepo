# Checkout Workflow

Creates a development branch from the latest release branch. Reads VERSION from `.env.version` to determine the release branch automatically.

## Pre-flight Checks

### 1. Read release branch name

```bash
VERSION=$(grep -E '^VERSION=' .env.version | cut -d '=' -f 2)
RELEASE_BRANCH="release/v${VERSION}"
```

If `.env.version` doesn't exist or VERSION is empty, stop:

> "Cannot read VERSION from .env.version. Ensure the file exists and contains a VERSION= line."

### 2. Working tree is clean

```bash
git status --porcelain
```

If not empty, stop:

> "You have uncommitted changes. Please commit or stash them before switching branches."

### 3. Verify release branch exists on remote

```bash
git ls-remote --heads origin "$RELEASE_BRANCH"
```

If empty, stop:

> "Release branch `$RELEASE_BRANCH` does not exist on origin. Has the App Shell been released and the branch created?"

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
