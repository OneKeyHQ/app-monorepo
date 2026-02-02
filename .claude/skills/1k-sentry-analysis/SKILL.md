---
name: 1k-sentry-analysis
description: Analyze and fix production errors from Sentry crash reports. Use when investigating AppHang, ANR, crashes, or production errors. Includes complete workflow from JSON analysis to bug fix implementation with evidence-based methodology. Triggers on sentry, crash, AppHang, ANR, error analysis, production error, bug analysis, crash report, freeze, hang, not responding, stacktrace, breadcrumbs, exception.
allowed-tools: Read, Grep, Glob, Write, Edit, Bash
disable-model-invocation: true
---

# Sentry Error Analysis & Fixes

Complete workflow for analyzing and fixing production errors from Sentry crash reports.

## Workflow Overview

```
1. Obtain Sentry JSON log
   ↓
2. Analyze error
   ↓
3. Identify root cause
   ↓
4. Generate bug analysis log
   ↓
🚨 WAIT FOR USER CONFIRMATION 🚨
   ↓
5. Implement fix (only after approval)
   ↓
6. Test & verify
   ↓
7. Create PR
```

## Critical Requirements

**MUST follow these rules:**

1. ✅ **Always create a bug analysis log** in `node_modules/.cache/bugs/` before implementing fixes
2. 🚨 **MUST wait for user confirmation** before starting any code changes
3. ✅ **Bug analysis must be complete** with all sections filled
4. ✅ **Use evidence-based methodology** (环环相扣，逐步递进)

## Quick Reference

### Common Error Types

| Type | Description | Common Causes |
|------|-------------|---------------|
| AppHang | iOS app frozen >5s | Too many concurrent requests, main thread blocking |
| ANR | Android Not Responding | Heavy operations on main thread, deadlocks |
| Crash | App terminated | Null pointer, memory issues, unhandled exceptions |
| Exception | Handled error | Network failures, validation errors, state issues |

### Analysis Methodology

Use **6 types of proof** to establish causation:

1. **Stack Trace Evidence** - Error location in code
2. **Breadcrumbs Evidence** - User actions leading to error
3. **Code Logic Evidence** - Why the code causes the issue
4. **Timing Evidence** - When and how often it occurs
5. **Device/Platform Evidence** - Affected platforms/devices
6. **Fix Verification** - Testing confirms fix works

### Common Fix Patterns

```typescript
// Pattern 1: Concurrent request control
async function executeBatched<T>(
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

// Pattern 2: Main thread offloading (React Native)
import { InteractionManager } from 'react-native';

InteractionManager.runAfterInteractions(() => {
  // Heavy operation here
});

// Pattern 3: Error boundary
<ErrorBoundary fallback={<ErrorFallback />}>
  <Component />
</ErrorBoundary>
```

## Detailed Guide

For comprehensive Sentry error analysis workflow, see [fix-sentry-errors.md](references/rules/fix-sentry-errors.md).

Topics covered:
- Obtaining Sentry JSON logs
- Python-based quick analysis
- Bug analysis log template
- 6 types of proof methodology
- Root cause identification
- Common fix patterns (AppHang, ANR, Crashes)
- Real-world case studies
- Testing and verification
- PR creation workflow

## Key Files

| Purpose | Location |
|---------|----------|
| Bug analysis logs | `node_modules/.cache/bugs/` |
| Sentry config | `packages/shared/src/modules/sentry/` |
| Error boundaries | `packages/kit/src/components/ErrorBoundary/` |

## When to Use This Skill

- Analyzing iOS AppHang errors (5+ second freezes)
- Fixing Android ANR (Application Not Responding)
- Investigating crash reports with stack traces
- Understanding user actions before crashes (breadcrumbs)
- Creating evidence-based bug analysis reports
- Implementing fixes for production errors

## Related Skills

- `/1k-performance` - Performance optimization patterns
- `/1k-error-handling` - Error handling best practices
- `/1k-sentry` - Sentry configuration and filtering
- `/1k-code-quality` - Lint fixes and code quality
