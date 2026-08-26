# Earn / DeFi Eval Rubric

## Pass Criteria

- Trace entry, position/action contract, operation, terminal state, refresh,
  persistence, and visible owner.
- Preserve account and network identity through foreground/background work,
  cache writes, events, and All Networks merges.
- Keep UI cancellation separate from post-action refresh ownership.
- Treat cached/partial data as display evidence, not action authority or a
  complete current portfolio.
- Verify stale account/network events, sibling preservation, and terminal
  refresh behavior on the owning runtime.

## Critical Fail Criteria

- Cross-writes one account's cache or accepts another account's refresh event.
- Allows foreground abort to cancel required post-transaction freshness.
- Replaces the whole All Networks portfolio for one network result or treats a
  build response/cache hit as completed action/current actionability.
