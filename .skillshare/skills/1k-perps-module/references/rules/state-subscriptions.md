# Perps Market Data and Subscriptions

Use for L2/BBO, instrument/aggregation switching, reconnection, market freshness or tick performance. Account-only state belongs in [account state](positions-account-state.md); pure dimensions/scrolling in [layout](layout-interactions.md).

## Follow the current data path

| Stage | Starting anchors |
| --- | --- |
| UI intent and active target | `packages/kit/src/views/Perp/components/PerpsGlobalEffects.tsx`, `packages/kit/src/views/Perp/utils/subscriptionPlanner.ts`, Hyperliquid context `actions.ts` |
| Reconcile and subscribe | `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidSubscription.ts`; its `utils/SubscriptionConfig.ts`, `utils/SubscriptionMutationQueue.ts`, `utils/SubscriptionReconcileQueue.ts` |
| Reconstruct/normalize | `packages/kit-bg/src/services/ServiceHyperLiquid/utils/FastL2Book.ts`, `packages/kit-bg/src/services/ServiceHyperLiquid/utils/l2Book.ts` |
| Context merge | `packages/kit/src/states/jotai/contexts/hyperliquid/actions.ts`, `packages/kit/src/states/jotai/contexts/hyperliquid/utils/l2BookUtils.ts` |
| Display and interaction | `packages/kit/src/views/Perp/components/PerpOrderBook.tsx`, `packages/kit/src/views/Perp/hooks/usePerpMarketData.ts` (`useL2Book`), `packages/kit/src/views/Perp/utils/l2BookFreshness.ts`, `packages/kit/src/views/Perp/hooks/useCoinOrderBookTop.ts` |
| Recovery snapshots | `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidCache.ts`, `packages/shared/src/consts/perpCache.ts` |

The background active target owns which socket data is relevant; UI intent and rendered instrument must converge on that target. Inspect stale asynchronous writes, not just visual latency. When changing switching order, preserve the target update before slow cleanup where the current race protection relies on it.

## Fast L2 and lifecycle

The current service prefers Fast L2 with target-specific recovery/fallback to `l2Book`; older branches may only have `l2Book`. Verify the configured strategy before applying these details.

`FastL2Book` accepts snapshot, delta and compressed frames, reconstructs a normalized book, and validates coin, frame shape, ordering and book invariants. An update without its initial snapshot does not establish readiness. Preserve parsing/decompression limits and stale-target handling when changing the parser.

The service manages snapshot timeout, recovery attempts/generation and fallback. Work started for an old target or lifecycle must not overwrite the new target or revive a disposed subscription. Read current constants rather than copying retry timings into consumers.

Two queues serve different purposes: `PerKeyMutationQueue` serializes keyed create/destroy work; `LatestSubscriptionReconcileQueue` coalesces pending desired-state reconciliation. A socket open event alone does not prove current market subscriptions were reconciled, especially when main/bg state synchronization lags. Check listeners, pending timers, queued tasks and cleanup together when changing lifecycle behavior.

## Display validity versus interaction validity

- `isL2BookForTarget` checks coin and aggregation options (`nSigFigs`/`mantissa`). Account-scoped positions and public orderbook data do not automatically share the same cache key dimensions.
- A matching cold/SWR snapshot can paint the book. `isPerpsL2BookInteractive` rejects cached snapshots and checks live freshness; BBO has its own timestamp/eligibility path. Visible rows or a recovered ticker do not prove clicks are safe.
- Freshness can expire without another tick. Preserve the refresh-delay/timer path as well as checks performed on a new frame.
- `PerpOrderBook` filters the candidate book at render time. Its current bridge reports interaction state on boolean transitions; blindly resetting local `renderL2Book`/`isOrderBookInteractive` during a switch can lose synchronization. Follow the producer/consumer protocol when changing it instead of applying a universal clear-on-switch rule.
- Wrong-target data must not be shown as the new instrument. Valid same-target caches can be retained with their display/interaction distinction; clearing or retaining state is an implementation choice governed by those contracts.

## Tick cost and persistence

Mobile-layout visual snapshots are scheduled separately from incoming data by `packages/kit/src/views/Perp/utils/orderBookVisualScheduler.ts`; inspect the actual layout predicate rather than assuming all native/web targets use the same cadence. Aggregation/render helpers live in `packages/kit/src/views/Perp/components/OrderBook/` (`useAggregatedBook.tsx`, `useRafCoalesced.ts`, `useTickOptions.ts`).

Trace hot atom writes and consumers before adding memoization: `usePerpsMidByCoin` narrows allMids reads; live/display/disabled price sources serve different consumers. Look for broad page subscriptions, repeated row formatting/BN work, token-selector sorting on every tick, or hot-path logging. Use `$1k-performance` when the task needs deeper performance analysis; apply the runtime distinctions in [ownership map](code-map.md) before estimating bridge/heap costs.

Preferences belong in existing perps atom/simpleDb settings. Recovery caches intentionally persist some market snapshots; preserve target, age and cached-status metadata. New transient persistence needs a recovery purpose rather than automatically making every websocket payload durable.

## Select validation

Existing tests in `packages/kit-bg/src/services/ServiceHyperLiquid/` include `ServiceHyperliquidSubscription.test.ts`, `ServiceHyperliquidCache.test.ts` and `utils/FastL2Book.test.ts`, `utils/SubscriptionMutationQueue.test.ts`, `utils/SubscriptionReconcileQueue.test.ts`, `utils/SubscriptionConfig.test.ts`, `utils/l2Book.test.ts`.

UI tests include `packages/kit/src/views/Perp/utils/l2BookFreshness.test.ts`, `packages/kit/src/views/Perp/utils/subscriptionPlanner.test.ts`, `packages/kit/src/views/Perp/utils/orderBookVisualScheduler.test.ts`, `packages/kit/src/views/Perp/utils/perpsMarketDataFreshness.test.ts`, `packages/kit/src/views/Perp/components/OrderBook/tickSizeUtils.test.ts`, `packages/kit/src/views/Perp/components/OrderBook/useRafCoalesced.test.ts` and `packages/kit/src/states/jotai/contexts/hyperliquid/utils/l2BookUtils.test.ts`.

Choose cases for the changed layer: snapshot-before-delta, stale/invalid frames and recovery; rapid coin/aggregation switches; perp/spot switches when supported; account change during updates; disconnect/foreground/restart; cached display with disabled clicks followed by fresh interactivity and later expiry. Keep chart readiness verification separate from socket/book recovery.
