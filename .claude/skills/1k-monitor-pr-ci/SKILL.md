---
name: 1k-monitor-pr-ci
description: Monitors a PR's CI checks and review comments until all pass and issues are resolved. Auto-fixes CI failures, addresses inline review comments, replies, and resolves threads. Use when watching CI status, waiting for checks to pass, fixing CI errors, or resolving review feedback on a pull request.
disable-model-invocation: true
argument-hint: "<PR number or URL> [polling interval]"
---

# Monitor PR CI & Reviews

Monitor a pull request's CI checks and review comments. Auto-fix CI failures, address inline review comments, reply to reviewers, and resolve threads.

## Usage

```
/1k-monitor-pr-ci https://github.com/OneKeyHQ/app-monorepo/pull/10717 3m
/1k-monitor-pr-ci 10717 5m
/1k-monitor-pr-ci https://github.com/OneKeyHQ/app-monorepo/pull/10717
/1k-monitor-pr-ci 10717
/1k-monitor-pr-ci
```

## Input

`$ARGUMENTS` — Two parts, space-separated:
1. **PR identifier** (required if no current branch PR): PR number, GitHub PR URL
2. **Polling interval** (optional, default `60s`): e.g. `30s`, `1m`, `2m`, `3分钟`, `5min`

If `$ARGUMENTS` is empty, auto-detect PR from current branch and use default 60s interval.

## Step 0: Initial Setup

1. **Parse arguments**: Split `$ARGUMENTS` into PR identifier and polling interval.
   - PR identifier: a number or a URL like `https://github.com/{owner}/{repo}/pull/{number}`
   - Polling interval: any token matching a time pattern (digits + time unit). Recognize: `s`/`sec`/`秒`, `m`/`min`/`分钟`/`分`. Default: `60s`
   - If `$ARGUMENTS` is empty, detect PR from current branch:
     ```bash
     gh pr list --head "$(git branch --show-current)" --json number --jq '.[0].number'
     ```
   - If no PR found and no argument provided, ask the user for the PR link

2. **Resolve owner/repo**:
   - If a full GitHub URL was provided, extract owner and repo from it
   - Otherwise, detect from local repo:
     ```bash
     gh repo view --json owner,name --jq '"\(.owner.login)/\(.name)"'
     ```

3. **Confirm and start** (no further questions needed):
   ```
   Monitoring PR #10717 (OneKeyHQ/app-monorepo)
   Polling interval: 3m
   Starting...
   ```

## Step 1: Poll Loop

Each iteration (`[Check N/30]`):

**MUST run ALL three commands in parallel on every iteration** (missing any one may cause review comments to be silently ignored):

   ```bash
   # 1. CI check status
   gh pr checks <PR_NUMBER>

   # 2. PR-level reviews and general comments
   gh pr view <PR_NUMBER> --json reviews,comments,reviewDecision

   # 3. Inline review comments (e.g. from Devin, human reviewers)
   gh api repos/{owner}/{repo}/pulls/<PR_NUMBER>/comments \
     --jq '.[] | {user: .user.login, body: .body, path: .path, line: .original_line, created_at: .created_at}'
   ```

   > **Why all three?** `gh pr checks` only returns CI status. `gh pr view --json reviews` returns PR-level reviews but NOT inline file comments. `gh api .../pulls/.../comments` is the ONLY way to get inline code review comments (the kind that appear on specific lines in the diff). Skipping it means inline comments from bots like Devin or human reviewers will be completely invisible.

### 1b. Fetch unresolved review threads

**Primary: GraphQL** (provides thread IDs needed for resolving):

```bash
gh api graphql -f query='
query($owner: String!, $repo: String!, $pr: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $pr) {
      id
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          diffSide
          comments(first: 20) {
            nodes {
              id
              databaseId
              body
              author {
                login
              }
              createdAt
            }
          }
        }
      }
    }
  }
}' -f owner="OWNER" -f repo="REPO" -F pr=PR_NUMBER
```

**Fallback: REST API** (if GraphQL fails, e.g. token permission issues):

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments \
  --jq '.[] | {id: .id, body: .body, path: .path, line: .original_line, user: .user.login, in_reply_to_id: .in_reply_to_id, created_at: .created_at}'
```

> **Note**: REST fallback can fetch comments and reply to them, but **cannot resolve threads** (GitHub only supports this via GraphQL). When using REST fallback, skip the resolve step (Step 3d) and log a warning that threads must be resolved manually.

Filter to only **unresolved** threads (`isResolved: false`). Skip threads where the last comment is from the current `gh` user (already replied).

### 1c. Display status summary

```
[Check 3/30]

CI Status:
| Check            | Status  | Duration |
|------------------|---------|----------|
| lint (24.x)      | pass    | 5m34s    |
| unittest (24.x)  | pending | -        |

Unresolved threads: 3
- src/views/Example.tsx:42 (@reviewer): "Consider using useCallback here"
- src/utils/format.ts:15 (@reviewer): "This should handle null case"
- src/components/Card.tsx:88 (@reviewer): "Typo in variable name"
```

### 1d. Decide next action

| CI Status | Unresolved Threads | Action |
|-----------|-------------------|--------|
| Any fail | - | **Auto-fix** CI failure (Step 2) |
| Any pending | Has threads | **Address threads** (Step 3), keep waiting for CI |
| Any pending | No threads | Wait, re-check |
| All pass | Has threads | **Address threads** (Step 3) |
| All pass | No threads | **Done** (Step 4) |

## Step 2: Auto-fix CI Failures

For each failed check:

1. Get failure log:
   ```bash
   gh run view <RUN_ID> --log-failed 2>&1 | tail -100
   ```

2. Analyze the failure and determine the cause.

3. **Fixable** (lint error, type error, test failure from our changes):
   - Fix the code
   - Commit: `fix: resolve CI <check-name> failure`
   - Push to PR branch
   - Wait 30s, return to Step 1

4. **Not fixable** (infra issue, flaky test, unrelated failure):
   - Report failure details to user
   - Suggest actions (re-run, skip, manual fix)
   - Ask user how to proceed

## Step 3: Address Review Threads

For each unresolved thread:

### 3a. Categorize the comment

Read the comment body and the relevant code context. Categorize:

- **Code fix needed** — requires file modification → **auto-fix**
- **Question** — requires explanation only, no code change → **auto-reply**
- **Disagree/Won't fix** — **MUST ask user** before responding. Never auto-resolve disagreements.

Display a one-line log per thread of what will be done, then proceed to fix immediately. Do NOT wait for user confirmation — only pause for disagree/won't-fix cases.

### 3b. Fix the code

For each thread that needs a code fix:

1. Read the file at the specified path and line
2. Make the fix using the Edit tool
3. Verify the fix doesn't break lint/types if quick to check

### 3c. Reply to the comment

Reply explaining what was done, using the REST API:

```bash
gh api --method POST \
  repos/{owner}/{repo}/pulls/{pr_number}/comments/{comment_database_id}/replies \
  -f body='Fixed: [concise explanation of the change]'
```

For questions (no code change needed):
```bash
gh api --method POST \
  repos/{owner}/{repo}/pulls/{pr_number}/comments/{comment_database_id}/replies \
  -f body='[answer to the question]'
```

Keep replies concise. Explain **what** was changed and **why**.

### 3d. Resolve the thread

After replying, resolve the thread via GraphQL:

```bash
gh api graphql -f query='
mutation($threadId: ID!) {
  resolveReviewThread(input: {threadId: $threadId}) {
    thread {
      isResolved
    }
  }
}' -f threadId="THREAD_NODE_ID"
```

> **Note**: Resolve thread requires GraphQL — there is no REST API equivalent. If Step 1b fell back to REST, skip this step and log a warning: "Thread resolve skipped (GraphQL unavailable). Please resolve manually."

### 3e. Commit and push

After all threads are addressed in this iteration:

1. Stage changed files: `git add <specific files>`
2. Commit with a descriptive message:
   ```bash
   git commit -m "fix: address PR review feedback

   - [list each fix made]"
   ```
3. Push: `git push`

### 3f. Request re-review

After pushing fixes, request re-review from the reviewers who left comments:

1. Get reviewers who left the comments (collected from Step 1b thread data, `author.login` fields)
2. Request re-review:
   ```bash
   gh pr edit <PR_NUMBER> --add-reviewer <reviewer1>,<reviewer2>
   ```
   Or via API if `--add-reviewer` doesn't trigger re-review:
   ```bash
   gh api --method POST \
     repos/{owner}/{repo}/pulls/{pr_number}/requested_reviewers \
     -f 'reviewers[]=reviewer1' -f 'reviewers[]=reviewer2'
   ```

3. Return to Step 1 (wait for CI to re-run)

## Step 4: Final Report

When all CI checks pass and no unresolved threads remain:

```
All CI checks passed! All review threads resolved.

CI:
| Check            | Status | Duration |
|------------------|--------|----------|
| lint (24.x)      | pass   | 5m34s    |
| unittest (24.x)  | pass   | 4m42s    |

Review threads: 5 resolved, 0 remaining
PR: <URL>
Status: Ready for re-review / Ready to merge
```

## Polling Rules

- Default **60 seconds** between checks (user can customize in Step 0)
- **30 seconds** after fix+push to allow CI restart
- **Maximum 30 iterations**, then ask user to continue or stop
- Always show `[Check N/30]`

## Important Notes

- CI failures: auto-fix without asking
- Review comments: **auto-fix without asking** — display a brief summary of what will be done, then proceed immediately
- **Disagree/Won't fix**: ALWAYS ask user before replying or resolving — this is the ONLY case that requires user input
- Never force-push or amend commits
- Each fix round is a new commit
- Fix multiple CI failures in one commit when possible
- Do NOT re-run checks automatically (only if user requests `gh run rerun`)
- Do NOT include "Co-Authored-By" or "Generated with" in commit messages
- Track which threads have been addressed to avoid duplicate work across iterations

## Error Handling

- **Non-blocking errors**: If any individual step fails (resolve thread, reply to comment, request re-review), log a warning and continue with the next thread/step. Never abort the entire loop due to a single thread failure.
- **GraphQL unavailable**: Fall back to REST API for fetching comments. Skip resolve step, log warning.
- **Reply fails**: Log warning with thread path/line, continue to next thread. The code fix is still committed.
- **Resolve fails**: Log warning, continue. The thread stays open but the fix is pushed.
- **Re-review request fails**: Log warning, continue. The reviewer can still see the push notification.
- **Blocking errors**: Abort the loop if:
  - `gh` CLI is not authenticated
  - The PR does not exist
  - The PR is already closed or merged (check via `gh pr view <PR_NUMBER> --json state --jq '.state'` each iteration — if `CLOSED` or `MERGED`, stop and inform the user)
