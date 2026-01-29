---
name: 1k-dev-workflows
description: Development workflow helpers for OneKey. Use when fixing lint warnings, creating test version branches, or performing pre-commit/pre-release tasks. Covers oxlint fixes, spellcheck, unused variables, and upgrade testing workflows.
---

# Development Workflows

Common development workflows and automation helpers for the OneKey monorepo.

## Quick Reference

| Task | Guide | Command |
|------|-------|---------|
| Fix lint warnings | [fix-lint.md](references/rules/fix-lint.md) | `yarn lint:only` |
| Create test version | [upgrade-test-version.md](references/rules/upgrade-test-version.md) | Manual workflow |
| Type check | - | `yarn tsc:only` |

## Lint Fixes

See: [references/rules/fix-lint.md](references/rules/fix-lint.md)

**Quick commands:**
```bash
# Run lint
yarn lint:only 2>&1 | tail -100

# Type check
yarn tsc:only

# Check spellcheck skip list
grep -i "word" development/spellCheckerSkipWords.txt
```

**Common fix patterns:**
```typescript
// Unused variable → prefix with _
const { used, unused: _unused } = obj;

// Unused parameter → prefix with _
function foo(used: string, _unused: number) {}
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

## Pre-commit Checklist

Before committing, ensure:
1. `yarn lint:only` - No lint errors
2. `yarn tsc:only` - No type errors
3. Changes are properly staged

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
