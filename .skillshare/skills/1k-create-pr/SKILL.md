---
name: 1k-create-pr
description: Creates a Pull Request from current changes for OneKey app-monorepo. Use when user wants to create PR, submit changes, or merge feature branch. Handles branch creation, commit, push, and PR creation with conversation context extraction for code review AI.
disable-model-invocation: true
---

# Create OneKey App PR

Automates the complete PR creation workflow for OneKey app-monorepo changes.

## Quick Reference

| Step | Action | Commands |
|------|--------|----------|
| 1 | Check status | `git status`, `git branch --show-current` |
| 2 | Determine base branch | Auto-detect or ask user |
| 3 | Create branch (if on x or release/*) | `git checkout -b <branch-name>` |
| 4 | Lint fix | `yarn lint --fix` |
| 5 | Stage & commit | `git add .`, `git commit -m "type: description"` |
| 6 | Push to remote | `git push -u origin <branch-name>` |
| 7 | Extract context | Analyze conversation for intent, decisions, risks |
| 8 | Create PR | `gh pr create --base <base> --title "..." --body "..."` |
| 9 | Enable auto-merge | `gh pr merge <number> --auto --squash` |

## Workflow

### 1. Check Current Branch Status

```bash
git status
git branch --show-current
```

### 2. Determine Base Branch

The PR base branch depends on where the current branch was created from.

**Auto-detection logic:**

```bash
VERSION=$(grep -E '^VERSION=' .env.version | cut -d '=' -f 2)
RELEASE_BRANCH="release/v${VERSION}"

# Compare distance to both candidate base branches
# (--is-ancestor would give false positives when release branch just forked from x)
release_distance=$(git rev-list --count "origin/$RELEASE_BRANCH"..HEAD 2>/dev/null || echo 999999)
x_distance=$(git rev-list --count origin/x..HEAD 2>/dev/null || echo 999999)

if [ "$release_distance" -lt "$x_distance" ]; then
  BASE="$RELEASE_BRANCH"
else
  BASE="x"
fi
```

If on `x` or `release/*` directly (not a feature branch), auto-detection is ambiguous. In this case, **ask the user before creating the feature branch**:

> "You're on `$current_branch` directly. Where should the PR target?"
> - `x` — normal development (non-bundle)
> - `$RELEASE_BRANCH` — bundle release
>
> This determines which branch to base your feature branch on.

### 3. Branch Handling

**If on `x` or `release/*` branch (not a feature branch):**
- Ask user for PR target (step 2 above) if not already determined
- Analyze current changes (staged and unstaged)
- Generate descriptive branch name based on changes:
  - `feat/` - new features
  - `fix/` - bug fixes
  - `refactor/` - refactoring
  - `chore/` - maintenance tasks
- Create and switch: `git checkout -b <branch-name>`
  - If base is `x`, branch from current `x`
  - If base is `release/*`, fetch latest and branch from `origin/$RELEASE_BRANCH`

**If already on feature branch:** Skip branch creation, use auto-detected base

### 4. Run Lint Fix

```bash
yarn lint --fix
```

Fix any remaining lint errors before committing.

### 5. Stage and Commit Changes

```bash
git add .
git commit -m "<type>: <description>"
```

**Commit format:**
- Follow conventional commits
- Do NOT add Claude signatures or Co-Authored-By

### 6. Push to Remote

```bash
git push -u origin <branch-name>
```

### 7. Extract Context and Intent (CRITICAL)

Before creating the PR, analyze the full conversation history to extract:

- **Intent**: Why were these changes made? What problem was being solved?
- **Root Cause**: If this is a bug fix, what was the root cause?
- **Design Decisions**: What approaches were considered? Why was this approach chosen?
- **Trade-offs**: Any compromises or known limitations?
- **Risk Areas**: Which parts of the change are riskiest or most complex?
- **Platform Impact**: Which platforms are affected (desktop/mobile/web/extension)?
- **Related Issues**: Any `OK-{number}` issue IDs mentioned in conversation

**Context extraction guidelines:**

1. **User's original request** - What did the user ask for? Quote key phrases if helpful.
2. **Problem diagnosis** - How was the problem identified and understood?
3. **Implementation rationale** - Why was this specific approach taken over alternatives?
4. **Constraints discussed** - Any constraints or requirements the user mentioned.
5. **Edge cases considered** - Any edge cases discussed during development.
6. **Security considerations** - Any security implications discussed.
7. **Performance considerations** - Any performance trade-offs discussed.

### 8. Create Pull Request with Context

```bash
gh pr create --base $BASE --title "<title>" --body "<description>"
```

Use the `$BASE` determined in step 2 (either `x` or `release/v{X.Y.Z}`).

**Issue ID handling:**
- Extract `OK-{number}` from commit summary/description and conversation history
- Append to PR title: `fix: description(OK-49185)`
- No space before opening parenthesis

**PR Body Template:**

The PR body MUST use this template. Omit sections that don't apply (don't write "N/A").

```markdown
## Summary
<1-3 bullet points describing WHAT changed>

## Intent & Context
<WHY these changes were made. What problem was being solved? What was the user's original request or the bug report that triggered this work?>

## Root Cause
<For bug fixes: What was the root cause? How was it diagnosed?>

## Design Decisions
<Key decisions made during implementation and WHY. Alternatives considered and reasons for the chosen approach.>

## Changes Detail
<Brief description of each significant file change and its purpose>

## Risk Assessment
- **Risk Level**: Low / Medium / High
- **Affected Platforms**: Extension / Mobile / Desktop / Web
- **Risk Areas**: <Which parts of the change are riskiest?>

## Test plan
- [ ] <Testing steps to verify the changes>
```

### 9. Enable Auto-Merge

```bash
gh pr update-branch <PR_NUMBER>
gh pr merge <PR_NUMBER> --auto --squash
```

### 10. Return PR URL

Display PR URL to user and open in browser:
```bash
open <PR_URL>
```

## Important Notes

- Base branch is auto-detected: `release/*` for bundle release branches, `x` for everything else. When on `x` or `release/*` directly, ask the user which target to use before creating the feature branch.
- Use conventional commit format: `type: description`
- Extract and append issue IDs (OK-{number}) to PR title
- **Context extraction is mandatory**: The PR description MUST reflect the conversation context. Do NOT create generic descriptions. The code review AI relies on this context to understand the intent behind changes.
- **All PR content MUST be in English**: title, body (summary, changes, test plan), branch name, and commit messages. Never use Chinese or other languages.
