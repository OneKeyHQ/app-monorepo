---
name: 1k-create-pr
description: Creates a Pull Request from current changes for OneKey app-monorepo. Use when user wants to create PR, submit changes, or merge feature branch. Handles branch creation, commit, push, and PR creation workflow.
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
| 5 | Create PR | `gh pr create --base x --title "..." --body "..."` |
| 6 | Enable auto-merge | `gh pr merge <number> --auto --squash` |

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

### 5. Create Pull Request

```bash
gh pr create --base x --title "<title>" --body "<description>"
```

**Issue ID handling:**
- Extract `OK-{number}` from commit summary/description
- Append to PR title: `fix: description(OK-49185)`
- No space before opening parenthesis

### 6. Enable Auto-Merge

```bash
gh pr update-branch <PR_NUMBER>
gh pr merge <PR_NUMBER> --auto --squash
```

### 7. Return PR URL

Display PR URL to user and optionally open in browser:
```bash
open <PR_URL>
```

## Important Notes

- Always target `x` as base branch
- Use conventional commit format: `type: description`
- Extract and append issue IDs (OK-{number}) to PR title
