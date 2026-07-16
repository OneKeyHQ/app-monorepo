# Swap Test Map

Use `yarn jest <explicit files> --runInBand`. Do not use the ambiguous root
`yarn test` alias. Add a focused test beside the changed owner when the required
transition is not covered.

## Incremental SSE Provider Readiness

```bash
yarn jest \
  packages/kit/src/states/jotai/contexts/swap/quoteSessionV2.test.ts \
  packages/kit-bg/src/services/ServiceSwapQuoteSession.test.ts \
  packages/kit/src/states/jotai/contexts/swap/quoteCommittedState.test.ts \
  packages/kit/src/states/jotai/contexts/swap/quoteProgress.test.ts \
  packages/kit/src/states/jotai/contexts/swap/actions.test.tsx \
  packages/kit/src/views/Swap/hooks/useSwapState.test.ts \
  packages/kit/src/views/Swap/components/SwapQuoteResultRate.test.tsx \
  packages/kit/src/views/Swap/pages/components/SwapQuoteResult.test.tsx \
  packages/kit/src/views/Swap/utils/swapProviderQuoteAvailability.test.ts \
  packages/shared/src/utils/swapQuoteSortUtils.test.ts \
  packages/kit/src/views/Swap/utils/buildSwapReviewState.test.ts \
  packages/kit/src/views/Swap/utils/swapExecutionSnapshotGuard.test.ts \
  --runInBand
```

Required cases:

- no actionable candidate keeps the picker unavailable
- first actionable current-request candidate opens the picker and pins
  display/execution once; Review can open before `done` after its remaining
  safety gates pass
- same-provider streaming cannot change economic fields; explicit manual intent
  can change provider, terminal settlement can update at most once, and neither
  transition can mutate a frozen Review
- actionability rejects provider errors, non-finite/non-positive output, and
  malformed or violated min/max using `fromAmount` in BUY and SELL
- while streaming, effective AUTO keeps early Review closed until its
  recommendation arrives, while effective CUSTOM and the provider picker do
  not inherit that wait
- the AUTO/CUSTOM gate uses the effective session override rather than a stale
  persisted global mode, and `supportPreBuild` stays false while SSE is active
- manual provider intent can precede that provider's event and is rebound to
  its active candidate by provider identity
- stale, duplicate, non-actionable, cancelled, and invalidated candidates cannot
  unlock selection or execution
- retained same-intent display remains visible but is not executable until the
  replacement request returns an actionable candidate
- Stock quote-before-total ordering unlocks Review only after exact live balance
  and the remaining Stock execution gates are ready
- real runtime proof opens Review before `done`, then confirms later provider
  events and terminal settlement do not mutate the frozen snapshot

## Stock Channel, Quote Settlement, And Persistence

```bash
yarn jest \
  packages/kit/src/states/jotai/contexts/swap/quoteProgress.test.ts \
  packages/kit/src/views/Swap/hooks/swapStockChannelUtils.test.ts \
  packages/kit/src/views/Swap/hooks/swapStockQuoteUtils.test.ts \
  packages/kit/src/views/Swap/hooks/swapStockPayTokenUtils.test.ts \
  packages/kit/src/views/Swap/utils/stockTokenDetailFreshness.test.ts \
  packages/kit/src/views/Swap/pages/components/SwapStockTradeAlert.utils.test.ts \
  packages/kit/src/views/Swap/utils/swapHistoryIdentity.test.ts \
  packages/kit-bg/src/dbs/simple/entity/SimpleDbEntitySwapHistory.test.ts \
  --runInBand
```

Required cases for a new provider/broker channel:

- early non-actionable error, later actionable quote
- manual provider selection remains stable until invalidated
- buy/sell amount ownership and Stock/pay-token identity
- background/restart restores the Stock pair without ordinary Swap overwrite
- order id/txid history identity, terminal replacement, and replay repair
- market closed/unavailable and final-unknown states

Composite runtime acceptance (run as one uninterrupted scenario):

1. cold-start into Stock and capture restored Stock/pay owner plus `swapType`
2. emit one early provider error, then a later actionable quote; only the latter
   becomes the review owner
3. submit the broker order and capture review/build/order ids
4. background the App long enough to cross the affected readiness window
5. resume and confirm the Stock pair, selected quote state, and pending row
6. restart and reconcile the same persisted order through provider status
7. verify ordinary Swap/Bridge/Limit state and history were not overwritten

## Stock Display Snapshot, Chart, And Execution Balance

```bash
yarn jest \
  packages/kit/src/hooks/useIdentityScopedSilentRefresh.test.tsx \
  packages/kit/src/views/Swap/hooks/swapStockDisplaySnapshotUtils.test.ts \
  packages/kit/src/views/Swap/hooks/swapStockDisplaySnapshotStorage.test.ts \
  packages/kit/src/views/Swap/hooks/useSwapStockDisplaySnapshot.test.tsx \
  packages/kit/src/views/Swap/hooks/useSwapStockTradeInputs.test.ts \
  packages/kit/src/views/Swap/hooks/swapStockExecutionBalanceUtils.test.ts \
  packages/kit/src/views/Swap/hooks/swapStockChannelUtils.test.ts \
  packages/kit/src/views/Swap/pages/components/SwapStockDesktopContainer.utils.test.ts \
  --runInBand
```

Required cases:

- account physical slots are isolated; token detail, balance, chart, amount,
  and selection each accept only their documented region owner, and an old
  async patch cannot enter a new owner
- malformed, future-dated, version-mismatched, and expired data is rejected;
  token detail, balance, and chart TTLs expire independently
- token projection strips execution gates such as live market-open state and
  description
- storage isolates account slots, evicts least-recently-used entries after
  eight accounts, flushes the latest aggregate, and self-heals corrupt data
- chart restores from the exact owner, keeps `visibleRange` separate from a
  pending `requestedRange`, replaces silently on live success, retains on
  failure, settles exact empty, and downsamples to 500 points while preserving
  endpoints
- cached amount and balance are display-only; amount input is non-editable and
  cannot seed quote/Max/percentage/Review until the canonical live Stock owner
  is ready
- ordinary Swap -> Stock and Stock -> non-Stock transitions clear shared
  amounts/balances synchronously before the destination first frame, then
  restore only matching display regions
- only exact live account/token/display-scope balance and its matching shared
  atom publication enable Max, percentage actions, balance validation, or Review
- bounded retry stops at its budget, cancels stale scopes/generations, and the
  explicit UI retry predicate appears only for the current failed scope

Runtime acceptance must cover `STOCK-DISPLAY-RESTORE-001`,
`STOCK-DISPLAY-ISOLATION-001`, `STOCK-BALANCE-FAIL-CLOSED-001`, and
`STOCK-SWAP-BOUNDARY-001`. Capture the first restored frame, each independent
live replacement, skeleton transition count, both cross-surface switch frames,
retry result, and the exact moment Review becomes enabled.

## Cold Start And Account Readiness

```bash
yarn jest \
  packages/kit/src/views/Swap/utils/swapColdStartTokenCacheUtils.test.ts \
  packages/shared/src/utils/swapColdStartCacheSnapshotUtils.test.ts \
  packages/kit/src/views/Swap/hooks/useSwapColdStartDisplayTokens.test.ts \
  packages/kit/src/views/Swap/utils/swapNoWalletWarningGuard.test.ts \
  packages/kit/src/states/jotai/contexts/accountSelector/actions.test.tsx \
  --runInBand
```

## Disconnect: Hide Without Delete

```bash
yarn jest \
  packages/kit/src/views/Swap/utils/swapNoWalletWarningGuard.test.ts \
  packages/kit-bg/src/dbs/simple/entity/SimpleDbEntitySwapHistory.test.ts \
  packages/kit-bg/src/services/ServiceAccountSelector.test.ts \
  packages/kit/src/states/jotai/contexts/accountSelector/actions.test.tsx \
  --runInBand
```

The runtime check must still prove connected -> disconnect -> disconnected
restart -> reconnect while the persisted row count and identities remain
unchanged.

## Receive DeFi-Token Filter Ownership

```bash
yarn jest packages/shared/src/utils/tokenSelectorFilterUtils.test.ts --runInBand
```

If route composition changes, add a focused Receive -> AssetSelector render
test. Protect ordinary Receive, ordinary Swap selector, DeFi-toggle on/off, and
the handoff from Receive into Swap.

Receive runtime recipe:

1. Open Receive from a connected account and open its token selector.
2. Toggle DeFi-token visibility on and off; capture the exact token identities.
3. Close and reopen Receive to prove persisted filter behavior.
4. Open the ordinary Swap selector and prove its list/state is unchanged.
5. Use a valid Receive-to-Swap handoff and prove filtering stops being the owner
   once `SwapMainLand` mounts.

## Review, Build, And Market Speed-Swap

```bash
yarn jest \
  packages/kit/src/views/Swap/utils/buildSwapReviewState.test.ts \
  packages/kit/src/views/Swap/pages/components/SwapReviewDialog.test.tsx \
  packages/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketBuildExecutionUtils.test.ts \
  packages/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/marketReviewExecutionUtils.test.ts \
  packages/kit/src/views/Market/MarketDetailV2/components/SwapPanel/hooks/useSpeedSwapActions.test.tsx \
  --runInBand
```

## Runtime Evidence

Choose the owning surface and capture all relevant layers:

- first frame and settled frame
- route/handoff params
- quote request/events/selected quote
- frozen review/build payload
- send/order result and pending row
- logical service status/log evidence and persisted row
- restart/reconnect or account-switch result when persistence is involved

Element existence alone is not proof. A pass requires active state, real
content, correct identity, and no protected-surface regression.
