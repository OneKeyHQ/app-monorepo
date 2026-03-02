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
| 2 | Create branch (if on x) | `git checkout -b <branch-name>` |
| 3 | Stage & commit | `git add .`, `git commit -m "type: description"` |
| 4 | Push to remote | `git push -u origin <branch-name>` |
| 5 | Extract context | Analyze conversation for intent, decisions, risks |
| 6 | Create PR | `gh pr create --base x --title "..." --body "..."` |
| 7 | Enable auto-merge | `gh pr merge <number> --auto --squash` |

## Workflow

### 1. Check Current Branch Status

```bash
git status
git branch --show-current
```

### 2. Branch Handling

**If on `x` branch:**
- Analyze current changes (staged and unstaged)
- Generate descriptive branch name based on changes:
  - `feat/` - new features
  - `fix/` - bug fixes
  - `refactor/` - refactoring
  - `chore/` - maintenance tasks
- Create and switch: `git checkout -b <branch-name>`

**If already on feature branch:** Skip branch creation

### 3. Stage and Commit Changes

```bash
git add .
git commit -m "<type>: <description>"
```

**Commit format:**
- Follow conventional commits
- Do NOT add Claude signatures or Co-Authored-By

### 4. Push to Remote

```bash
git push -u origin <branch-name>
```

### 5. Extract Context and Intent (CRITICAL)

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

### 6. Create Pull Request with Context

```bash
gh pr create --base x --title "<title>" --body "<description>"
```

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

### 7. Enable Auto-Merge

```bash
gh pr update-branch <PR_NUMBER>
gh pr merge <PR_NUMBER> --auto --squash
```

### 8. Return PR URL

Display PR URL to user and open in browser:
```bash
open <PR_URL>
```

## Important Notes

- Always target `x` as base branch
- Use conventional commit format: `type: description`
- Extract and append issue IDs (OK-{number}) to PR title
- **Context extraction is mandatory**: The PR description MUST reflect the conversation context. Do NOT create generic descriptions. The code review AI relies on this context to understand the intent behind changes.
