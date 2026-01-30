---
name: 1k-dev-workflows
description: Development workflow helpers for OneKey. Use when fixing lint warnings, creating test version branches, or performing pre-commit/pre-release tasks. Covers oxlint fixes, spellcheck, unused variables, and upgrade testing workflows.
---

# Development Workflows

Common development workflows and automation helpers for the OneKey monorepo.

## Quick Reference

| Task | Command | Description |
|------|---------|-------------|
| Lint all files | `yarn lint:only` | Full project lint |
| Lint staged files | `yarn lint:staged` | Pre-commit: only modified files |
| Type check | `yarn tsc:only` | Full project type check |
| Type check (staged) | `yarn tsc:staged` | Pre-commit type check |
| Create test version | See [upgrade-test-version.md](references/rules/upgrade-test-version.md) | Manual workflow |

## Lint Commands

See: [references/rules/fix-lint.md](references/rules/fix-lint.md)

### Lint All Files
```bash
yarn lint:only
```

### Lint Staged Files (Pre-commit)
```bash
# Only lint files that are staged for commit - fast!
yarn lint:staged
```

### Type Check
```bash
# Full project type check
yarn tsc:only

# Same as above, for pre-commit use
yarn tsc:staged
```

**Note:** TypeScript requires full project context and cannot check individual files.

## Common Lint Fixes

```typescript
// Unused variable → prefix with _
const { used, unused: _unused } = obj;

// Unused parameter → prefix with _
function foo(used: string, _unused: number) {}
```

## Pre-commit Workflow

Before committing:
1. `yarn lint:staged` - Lint only modified files (fast)
2. `yarn tsc:staged` - Type check (if needed)
3. Ensure changes are properly staged

For quick pre-commit validation:
```bash
# Quick: lint only
yarn lint:staged && git commit -m "your message"

# Thorough: lint + type check
yarn lint:staged && yarn tsc:staged && git commit -m "your message"
```

## Test Version Creation

See: [references/rules/upgrade-test-version.md](references/rules/upgrade-test-version.md)

For QA upgrade testing with version pattern `9XXX.YY.Z`.

**Build number formula:**
```bash
DATE=$(date +%Y%m%d)
BUILD_NUMBER=$((${DATE}00 + 30))
```

**Files to modify:**
- `.env.version`
- `.github/actions/shared-env/action.yml`
- `.github/workflows/release-android.yml`
- `apps/mobile/android/app/build.gradle`

## Key Files

| Purpose | File |
|---------|------|
| Lint config | `.oxlintrc.json` |
| Spellcheck skip list | `development/spellCheckerSkipWords.txt` |
| Version config | `.env.version` |
| Build config | `apps/mobile/android/app/build.gradle` |

## Related Skills

- `/1k-git-workflow` - Git branching and commit conventions
- `/1k-coding-patterns` - Code style and patterns
