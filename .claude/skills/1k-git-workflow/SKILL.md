---
name: 1k-git-workflow
description: Git workflow and conventions for OneKey development. Use when creating branches, committing code, or creating PRs. Triggers on git, branch, commit, PR, pull request, merge, workflow.
allowed-tools: Bash, Read
---

# OneKey Git Usage Guidelines

## Branch Management
- **Main branch**: `x` - This is the primary development branch
- **Workflow**: `x` → create feature branch → develop → PR back to `x`
- Do not use `onekey`, `master`, or `main` as the base branch - always use `x`
- **NEVER** work directly on the `x` branch → ALWAYS create feature branches

## Branch Naming
- Feature branches: `feat/description` or `feature/description`
- Bug fixes: `fix/description`
- Refactoring: `refactor/description`

## Commit Message Format
Use Conventional Commits format:
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring
- `perf:` / `optimize:` - Performance improvements
- `chore:` - Build, version, or non-code changes
- `docs:` - Documentation only

**Format**: `type: short description`
- Use lowercase
- Keep first line under 72 characters
- Include issue number if applicable: `fix: resolve login bug OK-12345`

**IMPORTANT - Claude Code commits**:
- Do NOT include "Generated with Claude Code" link
- Do NOT include "Co-Authored-By: Claude" signature
- Commit message should be indistinguishable from human-written commits

## PR Naming Convention
Follow the same format as commit messages:
- `feat: add dark mode support`
- `fix: resolve authentication timeout issue`
- `refactor: simplify payment processing logic`

## Common Git Commands

### Creating a Feature Branch
```bash
git checkout x
git pull origin x
git checkout -b feat/my-new-feature
```

### Committing Changes
```bash
git add .
git commit -m "feat: add user profile page"
```

### Pushing and Creating PR
```bash
git push -u origin feat/my-new-feature
# Then create PR via GitHub UI or gh CLI
```

### Rebasing on Latest x
```bash
git fetch origin
git rebase origin/x
```
