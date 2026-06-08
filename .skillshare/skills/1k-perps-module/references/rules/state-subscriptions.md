# Perps State and Subscriptions

Open this for account switching, active token changes, L2/BBO/orderbook issues, stale data, performance, or background subscription bugs.

## State owner model

Common owners:

- Background service: SDK/API calls, subscriptions, account binding, cache, signing/session.
- Hyperliquid context actions: UI-triggered actions, atom writes, submit/cancel orchestration.
- Context atoms: current UI/runtime market/account/orderbook state.
- Persisted perps atom/simpleDb: durable preferences and settings.
- Component state: temporary interaction only.
- TradingView iframe: chart-ready and chart-line internals.

Do not fix owner bugs with downstream display patches.

## Account/dex/asset scoping

- Scope Perps data by account, dex, and asset type where relevant.
- On account switch, clear or merge only the data that is valid for the next account.
- Do not show previous account positions, open orders, TWAP, or balances during transition.
- Token selector, orderbook, ticker, and chart may transition at different speeds; the slowest surface should not inherit old data.

Key anchors:
- `contexts/hyperliquid/utils/accountSwitchCleanup.ts`.
- `views/Perp/utils/accountScopedData.ts`.
- `contexts/hyperliquid/actions.ts` cleanup and merge paths.

## Subscription target rule

- Background active subscription target is the source of truth for websocket data.
- On symbol switch, push the new BG target before slow UI cleanup when stale subscription races are possible.
- Create/destroy subscription mutations must be serialized by key; stale create must not overwrite active maps.
- Treat UI/BG target mismatch as a correctness bug, not just a latency bug.

Key anchors:
- `ServiceHyperliquidSubscription.ts`.
- `utils/SubscriptionMutationQueue.ts`.
- `utils/SubscriptionConfig.ts` and tests.
- `views/Perp/utils/subscriptionPlanner.ts`.

## L2/BBO/orderbook

- Clear old L2/BBO on asset/dex/account switch if the new target has not produced fresh data.
- Ticker recovery does not prove L2/BBO/orderbook recovery.
- BBO freshness and L2 freshness are separate checks.
- Cached L2 can improve cold start, but it must not display as fresh for the wrong target.
- Aggregation, tick options, and row rendering are hot-path code; prefer memoized derived data and narrow atom reads.

Key anchors:
- `contexts/hyperliquid/actions.ts` L2/BBO handlers.
- `contexts/hyperliquid/utils/l2BookUtils.ts`.
- `views/Perp/utils/l2BookFreshness.ts`.
- `components/OrderBook/useAggregatedBook.tsx`.
- `ServiceHyperliquidCache.ts` L2 snapshot cache.

## Performance rule

Repeated Perps performance regressions usually come from broad atom writes and broad consumers, not from a missing `memo` in one row.

Check before optimizing:

1. Which atom is written on every tick?
2. How many components subscribe to that atom?
3. Is derived formatting computed per row/per render?
4. Does the component need all fields or one selected slice?
5. Are native and web doing the same amount of JS work?

Use `/1k-performance` when the change touches render hot paths, websocket tick volume, list virtualization, or expensive derived data.

## Persistence boundaries

Persist preferences such as display settings, favorite/tick options, or panel visibility only through existing atom/simpleDb paths.
Do not persist transient websocket data, active orderbook snapshots, or pending UI-only state unless there is an explicit recovery requirement.
