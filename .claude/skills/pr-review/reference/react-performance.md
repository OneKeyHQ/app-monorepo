# React performance checklist

- Look for unstable props:
  - inline objects/arrays/functions passed to memoized children
- Hook dependencies:
  - missing deps => stale closures / incorrect behavior
  - extra deps => effect churn / render loops
- Parent/child boundaries:
  - avoid lifting state too high; consider memoizing children or moving state closer
- Expensive render work:
  - derived data -> useMemo (verify deps)
  - heavy lists -> virtualization / windowing when needed
- Subscriptions/listeners:
  - ensure cleanup in useEffect return
