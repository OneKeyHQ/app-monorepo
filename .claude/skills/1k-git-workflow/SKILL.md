---
name: 1k-git-workflow
description: Git workflow and conventions — branching, commit messages, and PR creation.
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

**Option 1: Use /commit command (Recommended)**
```bash
/commit
```
The `/commit` command automatically runs pre-commit checks (`yarn lint:staged` and `yarn tsc:staged`) and creates a well-formatted commit message.

**Option 2: Manual commit with pre-checks**
```bash
# Stage your changes
git add .

# Run pre-commit checks (MANDATORY)
yarn lint:staged
yarn tsc:staged

# If checks pass, commit
git commit -m "feat: add user profile page"
```

**IMPORTANT**:
- NEVER commit code that fails linting or TypeScript compilation
- Pre-commit checks are mandatory as specified in CLAUDE.md
- The `/commit` command handles this automatically

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
