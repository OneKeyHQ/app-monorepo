---
name: 1k-monitor-pr-ci
description: Monitors a PR's CI checks and review comments until all pass and issues are resolved. Use when watching CI status, waiting for checks to pass, or fixing CI errors on a pull request.
disable-model-invocation: true
argument-hint: [PR number or URL]
---

# Monitor PR CI & Reviews

Monitor a pull request's CI checks and review comments. Auto-fix CI failures, prompt user for review feedback.

## Input

`$ARGUMENTS` - PR number, PR URL, or omit to auto-detect from current branch.

## Workflow

### Step 1: Resolve PR number

Determine the PR to monitor:

- If `$ARGUMENTS` is a number, use it directly
- If `$ARGUMENTS` is a GitHub URL, extract the PR number
- If `$ARGUMENTS` is empty, detect from current branch:
  ```bash
  gh pr list --head "$(git branch --show-current)" --json number --jq '.[0].number'
  ```
- If no PR found, stop and inform the user

### Step 2: Poll loop

Each iteration (`[Check N/30]`):

1. **Fetch CI status**:
   ```bash
   gh pr checks <PR_NUMBER>
   ```

2. **Fetch review comments** (every iteration):
   ```bash
   gh pr view <PR_NUMBER> --json reviews,comments,reviewDecision
   gh api repos/{owner}/{repo}/pulls/<PR_NUMBER>/comments --jq '.[] | {user: .user.login, body: .body, path: .path, line: .original_line, created_at: .created_at}'
   ```

3. **Display status summary**:
   ```
   [Check 3/30]

   CI Status:
   | Check            | Status  | Duration |
   |------------------|---------|----------|
   | lint (24.x)      | pass    | 5m34s    |
   | unittest (24.x)  | pending | -        |

   Reviews: 1 new comment from @reviewer
   ```

4. **Decide next action** based on priority:

   | CI Status | Reviews | Action |
   |-----------|---------|--------|
   | Any fail | - | **Auto-fix** CI failure (Step 3) |
   | Any pending | New comments | Show comments to user, keep waiting |
   | Any pending | No new comments | Wait 60s, re-check |
   | All pass | New comments | Show comments to user (Step 4) |
   | All pass | No new comments | Done (Step 5) |

### Step 3: Auto-fix CI failures

For each failed check:

1. Get failure log:
   ```bash
   gh run view <RUN_ID> --log-failed 2>&1 | tail -100
   ```
   Extract the run ID from the check URL.

2. Analyze the failure and determine the cause.

3. **Fixable** (lint error, type error, test failure from our changes):
   - Fix the code
   - Commit: `fix: resolve CI <check-name> failure`
   - Push to PR branch
   - Wait 30s, return to Step 2

4. **Not fixable** (infra issue, flaky test, unrelated failure):
   - Report failure details to user
   - Suggest actions (re-run, skip, manual fix)
   - Ask user how to proceed

### Step 4: Handle review comments

When new review comments are detected:

1. **Display each comment clearly**:
   ```
   New review comment from @reviewer:
   File: src/views/Example.tsx:42
   > Consider using useCallback here to prevent re-renders

   Review decision: CHANGES_REQUESTED
   ```

2. **Prompt the user**:
   - Show all unresolved comments
   - Ask: "Do you want me to address these review comments?"
   - If user says yes: fix the code, commit, push, return to Step 2
   - If user says no/later: continue monitoring CI only

3. **Track comment state**: Remember which comments have been shown to avoid repeating them in subsequent iterations.

### Step 5: Final report

When all CI checks pass and no new unhandled comments:

```
All CI checks passed!

| Check            | Status | Duration |
|------------------|--------|----------|
| lint (24.x)      | pass   | 5m34s    |
| unittest (24.x)  | pass   | 4m42s    |
| CodeQL           | pass   | 2m7s     |

Review status: approved / no reviews / changes requested
PR: <URL>
```

- All CI passed + approved → ready to merge
- All CI passed + no review → waiting for review
- All CI passed + changes requested → needs to address comments

## Polling Rules

- **60 seconds** between checks when pending
- **30 seconds** after fix+push to allow CI restart
- **Maximum 30 iterations** (~30 min), then ask user to continue or stop
- Always show `[Check N/30]`

## Important Notes

- CI failures: auto-fix without asking
- Review comments: always show to user, ask before fixing
- Never force-push or amend commits
- Each fix is a new commit
- Fix multiple CI failures in one commit when possible
- Do NOT re-run checks automatically (only if user requests `gh run rerun`)
