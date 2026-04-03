---
name: 1k-worktree-clean
description: Use when the user wants to audit local git worktrees against origin/x, choose by number or A, and decide whether stale worktree directories, already-merged worktrees, or no-delta worktrees can be cleaned up. Triggers on "worktree clean", "worktree 合并到 x", "检测哪些 worktree 已进 x".
allowed-tools: Bash, Read
---

# Worktree Clean Check

Use this skill to list local worktrees, surface clean or dirty state, and judge whether selected committed branch code has already landed in `origin/x` by actual code content, not by merge commits alone.

## Rules

- Always start by listing every local worktree with numeric choices.
- Ask the user to reply with `1`, `2,4`, or `A`.
- Always fetch the latest `origin/x` before running the check.
- Use commit graph data only to locate branch-side candidate files. Final judgment must come from content equality between the selected worktree snapshot and `origin/x`.
- Surface metadata that helps cleanup decisions: last commit time, upstream branch, PR status, and whether the worktree is nested under another linked worktree.
- PR status is best-effort only. Use `gh` when available; if auth or network is unavailable, report that explicitly and continue the local git-based check.
- If a worktree is dirty, report that separately and make it clear the committed-branch result does not cover uncommitted local edits.
- After the check result, always surface cleanup candidates:
  - stale directories that exist under `.worktree/` but are no longer registered by `git worktree list`
  - selected worktrees that are `MERGED_TO_ORIGIN_X_BY_CODE` or `NO_BRANCH_CODE_DELTA_FROM_COMMON_BASE`, `clean`, and are neither the main worktree nor the current worktree
- After surfacing cleanup candidates, always ask whether the user wants to remove stale directories, removable worktrees, both, or neither.
- Never auto-delete anything before the user explicitly confirms the cleanup action.

## Step 1: List Local Worktrees

Run:

```bash
rtk proxy bash .skillshare/skills/1k-worktree-clean/scripts/1k-worktree-clean.sh list
```

Then present the choices to the user and append:

```text
请回复编号，例如 `1`、`2,4` 或 `A`。
```

List output should include, for each worktree:

- path
- branch
- clean/dirty state
- upstream branch
- last commit time
- PR status
- nested worktree status

## Step 2: Sync Remote X

Run:

```bash
rtk git fetch origin x
```

If sandboxing blocks the fetch, request approval and rerun it.

## Step 3: Check Selected Worktrees

Run one of:

```bash
rtk proxy bash .skillshare/skills/1k-worktree-clean/scripts/1k-worktree-clean.sh check 1
rtk proxy bash .skillshare/skills/1k-worktree-clean/scripts/1k-worktree-clean.sh check 1,3
rtk proxy bash .skillshare/skills/1k-worktree-clean/scripts/1k-worktree-clean.sh check A
```

## Step 4: Surface Cleanup Candidates And Ask

Run the matching cleanup-candidate command with the same selection:

```bash
rtk proxy bash .skillshare/skills/1k-worktree-clean/scripts/1k-worktree-clean.sh cleanup-candidates 1
rtk proxy bash .skillshare/skills/1k-worktree-clean/scripts/1k-worktree-clean.sh cleanup-candidates 1,3
rtk proxy bash .skillshare/skills/1k-worktree-clean/scripts/1k-worktree-clean.sh cleanup-candidates A
```

Then summarize:

- stale directory count and paths
- removable worktrees with the reason (`MERGED_TO_ORIGIN_X_BY_CODE` or `NO_BRANCH_CODE_DELTA_FROM_COMMON_BASE`)
- skipped removable worktrees with the reason when applicable
- For removable/skipped worktrees, keep the metadata visible: upstream, last commit time, PR status, and nested worktree status

If there is at least one cleanup candidate, append:

```text
如需继续清理，请回复：
`stale`：只删残留目录
`merged 2,4`：只删这些可移除且 clean 的 worktree
`all`：两类都清理
`no`：不清理
```

If there are no cleanup candidates, say so explicitly.

## Step 5: Delete Only After Confirmation

If the user confirms cleanup:

- Remove removable worktrees with:

```bash
rtk git worktree remove <path>
```

- Remove stale directories with:

```bash
rtk proxy rm -rf <path>
```

- If sandboxing blocks either command, request approval and rerun it.
- When deleting removable worktrees, keep reporting path, branch, and removable reason so the user can verify scope before the command runs.

## How To Interpret The Result

- `MERGED_TO_ORIGIN_X_BY_CODE`: every branch-side candidate file now matches `origin/x`.
- `NOT_FULLY_MERGED_TO_ORIGIN_X_BY_CODE`: at least one branch-side candidate file still differs from `origin/x`.
- `NO_BRANCH_CODE_DELTA_FROM_COMMON_BASE`: the worktree has no committed branch-only code delta relative to the common base with `origin/x`. If it is also `clean` and is neither the main worktree nor the current worktree, treat it as a removable cleanup candidate.
- `Working tree: dirty`: show the dirty files and state that current local edits still need separate review.

## Output Contract

- Give a short summary first for all selected worktrees: merged, not merged, or no delta.
- For each worktree, include path, branch, clean/dirty state, upstream branch, last commit time, PR status, nested/non-nested status, candidate file count, and the unmatched file list when present.
- When the result is merged, explicitly say `已合并到远端 x（按代码内容判断）`.
- When the result is `NO_BRANCH_CODE_DELTA_FROM_COMMON_BASE`, explicitly say it has no committed branch delta relative to `origin/x`, and that it is removable when it is also `clean` and not the main/current worktree.
- After the check summary, give a cleanup follow-up: stale directories, removable worktrees, and whether the user wants to delete them.
- If PR status cannot be determined, say that clearly instead of guessing.
- Never conclude purely from “this commit was merged” or “this branch is ahead/behind”.
