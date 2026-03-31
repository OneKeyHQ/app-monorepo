# PR Workflow

Creates a PR from the current development branch to the latest release branch. Reads VERSION from `.env.version` to determine the release branch automatically.

## Pre-flight Checks

### 1. Read release branch name

```bash
VERSION=$(grep -E '^VERSION=' .env.version | cut -d '=' -f 2)
RELEASE_BRANCH="release/v${VERSION}"
current_branch=$(git branch --show-current)
```

If `.env.version` doesn't exist or VERSION is empty, stop:

> "Cannot read VERSION from .env.version. Ensure the file exists and contains a VERSION= line."

If `current_branch` is empty, stop:

> "Cannot determine the current branch. Ensure you're not in detached HEAD state."

If `current_branch` is the same as `RELEASE_BRANCH`, stop:

> "You're already on `$RELEASE_BRANCH`. Switch to your feature branch before creating a PR."

### 2. Working tree is clean

```bash
git status --porcelain
```

If not empty, stop:

> "You have uncommitted changes. Please commit or stash them before creating the PR."

### 3. Verify release branch exists and fetch latest remote state

```bash
git ls-remote --heads origin "$RELEASE_BRANCH"
git fetch origin "$RELEASE_BRANCH" "$current_branch"
```

If the release branch does not exist on origin, stop:

> "Release branch `$RELEASE_BRANCH` does not exist on origin. Has the App Shell been released and the branch created?"

### 4. Ensure the current branch is pushed

If `origin/$current_branch` does not exist, or `HEAD` is ahead of `origin/$current_branch`, push the branch first:

```bash
git push -u origin "$current_branch"
```

### 5. Confirm the branch is based on the latest remote release branch

Check whether the latest `origin/$RELEASE_BRANCH` is already contained in the current branch:

```bash
git merge-base --is-ancestor "origin/$RELEASE_BRANCH" HEAD
```

If the check fails, warn:

> "Current branch is not based on the latest origin/$RELEASE_BRANCH. Rebase onto origin/$RELEASE_BRANCH before opening the PR, or continue only if you intentionally want to resolve the drift in the PR."

## Step 1: Check for an existing open PR

```bash
gh pr list --base "$RELEASE_BRANCH" --head "$current_branch" --state open --json url --jq '.[0].url'
```

If a PR already exists, output the URL and stop instead of creating a duplicate.

## Step 2: Create the PR

Use GitHub CLI to create the PR from the current branch to the release branch:

```bash
gh pr create \
  --base "$RELEASE_BRANCH" \
  --head "$current_branch" \
  --fill
```

If the user wants a custom title or body, collect it first and replace `--fill` with explicit `--title` and `--body`.

## Step 3: Output

```
=== Release PR Created ===

Base: $RELEASE_BRANCH
Head: $current_branch
PR: $PR_URL

Reviewers can now validate the change directly on $RELEASE_BRANCH.
```
