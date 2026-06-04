# Code Map

Use these anchors to orient in the current repository. Prefer nearby patterns over parallel abstractions.

## Routes And Hosts

- `packages/shared/src/routes/staking.ts`
- `packages/shared/src/routes/tabEarn.ts`
- `packages/kit/src/routes/Tab/Earn/router.ts`
- `packages/kit/src/routes/Tab/Discovery/router.ts`
- `packages/kit/src/views/Earn/earnUtils.ts`
- `packages/kit/src/views/Discovery/pages/Browser/Browser.native.tsx`

Important anchor:

- `safePushToEarnRoute`

## Earn Home, List, And Detail

- `packages/kit/src/views/Earn/EarnHome.tsx`
- `packages/kit/src/views/Earn/EarnProvider.tsx`
- `packages/kit/src/views/Earn/EarnProviderMirror.tsx`
- `packages/kit/src/views/Earn/hooks/useEarnPortfolio.ts`
- `packages/kit/src/views/Earn/hooks/useStakingPendingTxs.ts`
- `packages/kit/src/views/Earn/pages/EarnProtocols/index.tsx`
- `packages/kit/src/views/Earn/pages/EarnProtocolDetails/index.tsx`
- `packages/kit/src/views/Earn/pages/EarnProtocolDetails/hooks/useProtocolDetailData.ts`

## Staking Operation Stack

- `packages/kit/src/views/Staking/pages/ManagePosition/index.tsx`
- `packages/kit/src/views/Staking/pages/ManagePosition/components/ManagePositionContent.tsx`
- `packages/kit/src/views/Staking/hooks/useUniversalHooks.ts`
- `packages/kit/src/views/Staking/hooks/useQuoteRefresh.ts`
- `packages/kit/src/views/Staking/hooks/useEarnPermitApprove.ts`
- `packages/kit/src/views/Staking/hooks/useEarnAccount.ts`
- `packages/kit/src/views/Staking/hooks/useHandleSwap.ts`
- `packages/kit/src/views/Staking/utils/utils.ts`
- `packages/kit/src/views/Staking/components/StakingActivityIndicator/index.tsx`
- `packages/kit/src/views/Staking/pages/HistoryList/index.tsx`

## Borrow

- `packages/kit/src/views/Borrow/pages/BorrowHome.tsx`
- `packages/kit/src/views/Borrow/BorrowProvider.tsx`
- `packages/kit/src/views/Borrow/components/BorrowDataGate.tsx`
- `packages/kit/src/views/Borrow/borrowUtils.ts`
- `packages/kit/src/views/Borrow/pages/ReserveDetails/index.tsx`
- `packages/kit/src/views/Borrow/pages/ReserveDetails/index.native.tsx`
- `packages/kit/src/views/Borrow/hooks/useBorrowMarkets.ts`
- `packages/kit/src/views/Borrow/hooks/useBorrowReserves.ts`
- `packages/kit/src/views/Borrow/hooks/useUniversalBorrowHooks.ts`
- `packages/kit/src/views/Borrow/pages/BorrowManagePosition/index.tsx`
- `packages/kit/src/views/Borrow/pages/BorrowHistoryList.tsx`

## Shared Contracts

- `packages/shared/types/staking.ts`
- `packages/shared/src/utils/earnUtils.ts`
- `packages/shared/src/logger/scopes/staking/`
- `packages/kit-bg/src/services/ServiceStaking.ts`

Shared contracts are high blast-radius. Changes here require existing Earn, Borrow, Staking, pending, and history regression reasoning.

## Cross-Surface Helpers

- `packages/kit/src/views/Staking/components/TradeOrBuy.tsx`
- `packages/kit/src/views/Staking/components/ProtocolDetails/EarnSwapRoute.tsx`
- `packages/kit/src/views/Staking/hooks/useHandleSwap.ts`
- `packages/kit/src/views/Earn/pages/EarnAssetSearch/index.tsx`

When these paths hand off to Trade/Swap or Buy, validate both the source route and target route state.

## Package Boundaries

Respect the repository import hierarchy:

- `shared` cannot import from other OneKey packages.
- `components` can import only from `shared`.
- `kit-bg` can import only from `shared` and `core`.
- `kit` can import from `shared`, `components`, and `kit-bg`.
