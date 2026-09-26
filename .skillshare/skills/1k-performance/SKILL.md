---
name: 1k-performance
description: Performance optimization for React/React Native — re-renders, memoization, FlashList, memory leaks, and bundle size.
allowed-tools: Read, Grep, Glob
---

# OneKey Performance Optimization

Performance optimization patterns and best practices for React/React Native applications in the OneKey monorepo.

## Quick Reference

| Category                | Key Optimization                              | When to Use                                  |
| ----------------------- | --------------------------------------------- | -------------------------------------------- |
| **Concurrent Requests** | Limit to 3-5, use `executeBatched`            | Multiple API calls, network-heavy operations |
| **Bridge Optimization** | Minimize crossings, batch data                | React Native bridge overhead, iOS/Android    |
| **List Rendering**      | FlashList, windowSize={5}, content-visibility | Lists with 100+ items                        |
| **Memoization**         | memo, useMemo, useCallback                    | Expensive computations, prevent re-renders   |
| **Heavy Operations**    | InteractionManager, setTimeout                | UI blocking operations                       |

## Account Selector Render Baseline

Use the repository's cross-branch A/B harness when changing Account Selector
rendering, selection synchronization, or related provider/effect behavior:

```bash
yarn test:e2e:web:render-baseline:compare
```

The command compares the current merge-base of committed `HEAD` and `origin/x`
with `HEAD` (or `RENDER_BASELINE_CANDIDATE_COMMIT`). It runs three balanced
ABBA/BAAB groups by default, aggregates six adjacent candidate/baseline ratios
with median, MAD and IQR, and applies the regression gate. Product code comes
from the exact commits. The current worktree harness is copied byte-identical
into both clones and its SHA-256 is stored in the summary, so a corrected
harness can fairly remeasure historical product commits.

Use the pinned long-term baseline only for trend analysis:

```bash
yarn test:e2e:web:render-baseline:compare:trend
```

Use the one-group core workload only for harness smoke checks, not final PR
evidence. This command disables the regression gate:

```bash
yarn test:e2e:web:render-baseline:compare:quick
```

The browser harness measures four layers:

- React work: commits, rendered composite components, max fan-out per commit,
  and `actualDuration`, with both a next-paint checkpoint and a complete
  operation-to-hard-quiescence window.
- Data churn: reload calls and reload duration for each no-op `AccountUpdate`;
  a dropped or failed reload fails the sample.
- Responsiveness: selection/active-state to Provider commit and next paint in
  the full Account Selector E2E trace.
- Retention and scale: forced-GC JS heap, DOM node and event-listener growth
  across selector cycles; account-list breadth is configurable from 2 to 100
  accounts per wallet.
- Scene matrix: Home num 0, Swap nums 0/1, Discover with 1/2/8 enabled nums,
  and two Discover origins with two enabled nums per origin.

The default A/B gate fails when the paired median ratio for rendered
components, commits, max rendered in one commit, or background reload fan-out
exceeds `1.3x`. Missing phases/required metrics, quiescence timeouts, and
environment or workload mismatches are measurement failures rather than
warnings. Duration, paint and retained-resource metrics warn because they are
more sensitive to machine noise. Each metric is also classified as improvement,
regression, unchanged, or inconclusive from its paired robust interval; do not
claim a small optimization when the result is inconclusive.

Before running:

- Commit product changes. Uncommitted product changes are excluded; uncommitted
  harness changes are intentionally included on both sides and hash-recorded.
- Refresh `origin/x` before a final PR comparison so merge-base resolution uses
  the current remote-tracking ref.
- Keep the machine otherwise idle for every group.
- Allow enough time and disk space for the disposable baseline/candidate
  clones and their dependencies.

Primary files:

- `apps/web/e2e/render-baseline-compare.e2e.js`: A/B driver, pinned baseline,
  merge-base/trend target resolution, clone preparation, and orchestration.
- `apps/web/e2e/render-baseline-protocol.js`: balanced schedule, strict
  comparability, paired aggregation, and regression gate.
- `apps/web/e2e/render-commit-baseline.e2e.js`: browser measurement harness and
  per-phase render, reload, retention, and scale metrics.
- `apps/web/e2e/account-selector-perf-metrics.js`: trace timing, hook execution,
  and unique-consumer fan-out summaries used by the full functional E2E.

Both files carry their full methodology, environment knobs, and re-pinning
policy in their header comments; there is no separate prose document to consult
or keep in sync. Both sides of a comparison are measured live in every run, so
no baseline artifact is stored in the repo.

Results and per-run logs are written under `.tmp/render-baseline/`. Prefer the
one-command comparison over running the measurement harness directly when the
goal is to decide whether a candidate regressed against the same-run baseline.

Fast deterministic checks (no browser):

```bash
yarn test:performance:account-selector
```

Larger account-list comparison:

```bash
yarn test:e2e:web:render-baseline:scale
```

Useful knobs:

- `RENDER_BASELINE_BASE_MODE=pr|trend` (default `pr`)
- `RENDER_BASELINE_GROUPS` (default `3`)
- `RENDER_BASELINE_SCENARIO_PROFILE=core|matrix` (default `matrix`)
- `RENDER_BASELINE_ACCOUNTS_PER_WALLET=2..100`
- `RENDER_BASELINE_WALLET_COUNT=1..3`
- `RENDER_BASELINE_RETENTION_ITERATIONS` (default `7`)
- `RENDER_BASELINE_CHURN_EMITS` (default `11`)

## Critical Performance Rules

### ❌ FORBIDDEN: Too Many Concurrent Requests

```typescript
// ❌ BAD - Can freeze UI with 15+ requests
const requests = items.map((item) => fetchData(item));
await Promise.all(requests);
```

### ✅ CORRECT: Batched Execution with Concurrency Limit

```typescript
async function executeBatched<T>(
  tasks: Array<() => Promise<T>>,
  concurrency = 3,
): Promise<Array<PromiseSettledResult<T>>> {
  const results: Array<PromiseSettledResult<T>> = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map((task) => task()));
    results.push(...batchResults);
  }
  return results;
}

const tasks = items.map((item) => () => fetchData(item));
await executeBatched(tasks, 3); // Max 3 concurrent
```

## 🚨 Built-in Optimizations

**Already Optimized - NO ACTION NEEDED:**

| Component  | Optimization                  | Details                   |
| ---------- | ----------------------------- | ------------------------- |
| `ListView` | `windowSize={5}`              | Auto-limits visible items |
| `Tabs`     | `contentVisibility: 'hidden'` | Hides inactive tabs       |
| `Dialog`   | `contentVisibility: 'hidden'` | Hides when closed         |

## Detailed Guide

For comprehensive performance optimization strategies, see [performance.md](references/rules/performance.md).

Topics covered:

- Concurrent request control
- React Native bridge optimization
- Heavy operations offloading
- List rendering (windowSize, FlashList, content-visibility)
- Memoization & callbacks
- State updates optimization
- Image optimization
- Async operations & race conditions
- Real-world iOS AppHang case study

## Related Skills

- `/1k-coding-patterns` - General coding patterns and conventions
- `/1k-sentry` - Sentry error analysis (includes performance issues)
