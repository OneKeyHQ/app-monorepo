---
name: 1k-dev-workflows
description: Development workflow helpers for OneKey. Use when fixing lint warnings, creating test version branches, performing pre-commit/pre-release tasks, or analyzing and fixing Sentry errors. Covers oxlint fixes, spellcheck, unused variables, upgrade testing workflows, and Sentry crash report analysis.
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
| Fix Sentry errors | See [fix-sentry-errors.md](references/rules/fix-sentry-errors.md) | Analyze and fix crash reports |

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

## Fix Sentry Errors

See: [references/rules/fix-sentry-errors.md](references/rules/fix-sentry-errors.md)

Workflow for analyzing and fixing production errors from Sentry crash reports.

### Quick Start

1. **Obtain Sentry JSON log file** from crash report
2. **Analyze error** using Python scripts to extract key info:
   - Error type (AppHang, ANR, Crash, etc.)
   - Device and OS information
   - Stack traces and threads
   - User actions (breadcrumbs)
3. **Identify root cause** from stack traces and breadcrumbs
4. **Implement fix** following common patterns:
   - Concurrent request control
   - Main thread offloading
   - Error boundaries
   - Memory optimization
5. **Verify fix** with linting and testing
6. **Create PR** with detailed analysis

### Common Fix Patterns

```typescript
// Concurrent request control - prevent UI blocking
private async executeBatched<T>(
  tasks: Array<() => Promise<T>>,
  concurrency = 3,
): Promise<Array<PromiseSettledResult<T>>> {
  const results: Array<PromiseSettledResult<T>> = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map((task) => task()),
    );
    results.push(...batchResults);
  }
  return results;
}
```

### When to Use

- Analyzing iOS AppHang errors (5+ second freezes)
- Fixing Android ANR (Application Not Responding)
- Investigating crash reports with stack traces
- Understanding user actions before crashes

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
