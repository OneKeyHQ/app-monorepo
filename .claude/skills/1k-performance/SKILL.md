---
name: 1k-performance
description: Performance optimization guidelines for OneKey React/React Native applications. Use when optimizing app performance, fixing UI freezes/lag, reducing re-renders, handling concurrent operations, or analyzing performance bottlenecks. Triggers on performance, optimization, optimize, slow, lag, freeze, hang, jank, stutter, memory, leak, concurrent, batching, batch, memoization, memo, bridge, windowSize, contentVisibility, FlashList, re-render, fps, tti, bundle.
allowed-tools: Read, Grep, Glob
---

# OneKey Performance Optimization

Performance optimization patterns and best practices for React/React Native applications in the OneKey monorepo.

## Quick Reference

| Category | Key Optimization | When to Use |
|----------|------------------|-------------|
| **Concurrent Requests** | Limit to 3-5, use `executeBatched` | Multiple API calls, network-heavy operations |
| **Bridge Optimization** | Minimize crossings, batch data | React Native bridge overhead, iOS/Android |
| **List Rendering** | FlashList, windowSize={5}, content-visibility | Lists with 100+ items |
| **Memoization** | memo, useMemo, useCallback | Expensive computations, prevent re-renders |
| **Heavy Operations** | InteractionManager, setTimeout | UI blocking operations |

## Critical Performance Rules

### ❌ FORBIDDEN: Too Many Concurrent Requests

```typescript
// ❌ BAD - Can freeze UI with 15+ requests
const requests = items.map(item => fetchData(item));
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
    const batchResults = await Promise.allSettled(
      batch.map((task) => task()),
    );
    results.push(...batchResults);
  }
  return results;
}

const tasks = items.map(item => () => fetchData(item));
await executeBatched(tasks, 3); // Max 3 concurrent
```

## 🚨 Built-in Optimizations

**Already Optimized - NO ACTION NEEDED:**

| Component | Optimization | Details |
|-----------|--------------|---------|
| `ListView` | `windowSize={5}` | Auto-limits visible items |
| `Tabs` | `contentVisibility: 'hidden'` | Hides inactive tabs |
| `Dialog` | `contentVisibility: 'hidden'` | Hides when closed |

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
- `/1k-sentry-analysis` - Sentry error analysis (includes performance issues)
- `/react-native-best-practices` - React Native specific optimizations
