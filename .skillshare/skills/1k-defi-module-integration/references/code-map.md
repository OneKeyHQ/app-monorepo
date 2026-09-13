# Earn / DeFi Code Map

Use this as orientation, then confirm current names with `rg`. Directories and
contracts are more durable than a list of exact functions.

## Primary Areas

| Concern                        | Start here                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Earn routes and navigation     | `packages/shared/src/routes/`, `packages/kit/src/routes/Tab/Earn/`, `packages/kit/src/views/Earn/`                                   |
| Native Discovery host          | `packages/kit/src/routes/Tab/Discovery/`, `packages/kit/src/views/Discovery/`, Discovery Jotai context                               |
| Earn portfolio data            | `packages/kit/src/views/Earn/hooks/`, Earn Jotai context, staking/background services                                                |
| Portfolio position UI/actions  | `packages/kit/src/components/DeFi/`, `packages/kit/src/views/Home/components/DeFiListBlock/`, `packages/kit/src/views/AssetDetails/` |
| Borrow                         | `packages/kit/src/views/Borrow/`                                                                                                     |
| Borrow route mode              | `packages/kit/src/views/Borrow/borrowUtils.ts`, `packages/kit/src/views/Earn/earnUtils.ts`, and typed Earn/Borrow routes              |
| Staking operations             | `packages/kit/src/views/Staking/`, `packages/kit-bg/src/services/ServiceStaking.ts`                                                  |
| DeFi build/refresh/persistence | `packages/kit-bg/src/services/ServiceDeFi.ts`, DeFi SimpleDB entity, background API                                                  |
| Shared contracts               | `packages/shared/types/`, `packages/shared/src/utils/`, shared routes and event bus                                                  |
| Borrow approval/collateral     | `packages/kit/src/views/Borrow/components/`, `packages/kit/src/views/Borrow/components/ManagePosition/hooks/`, `packages/kit/src/components/DeFi/ProtocolLendingActionDialogContent.tsx` |
| Borrow pending/history merge   | `packages/kit-bg/src/services/ServiceHistory.ts`, `packages/kit-bg/src/services/ServiceStaking.ts`, `packages/kit/src/views/Borrow/pages/borrowHistoryList.utils.ts` |
| Earn detail/cache/layout       | `packages/kit/src/views/Earn/pages/EarnProtocolDetails/`, its `mobile/PortfolioTab.tsx` and `hooks/useProtocolDetailData.ts`, `packages/kit/src/components/ListView/TableList.tsx`, and `packages/kit/src/views/Earn/pages/EarnProtocolDetails/components/ApyChart.tsx` |
| Market → Earn handoff          | `packages/kit/src/views/Market/MarketDetailV2/layouts/TopCoinsDesktopLayout.tsx` and existing Earn navigation helpers |
| Native bundle ownership        | `apps/mobile/bundle-registry/module-id-registry.json` plus Union Build/module-id tooling |

## Useful Searches

Adapt these to the task instead of trusting a frozen anchor list:

```bash
rg -n "supported.*protocol|build-transaction|orderId|approvalTx|permit" \
  packages/kit packages/kit-bg packages/shared
rg -n "claimSymbol|sourcePositions|positionCategory|accountId|indexedAccountId" \
  packages/kit packages/kit-bg packages/shared
rg -n "refresh.*DeFi|DeFiPosition|AccountDataUpdate" \
  packages/kit packages/kit-bg packages/shared
rg -n "allowance|approval|canBeCollateral|pending|replacedType|stakingInfo|cache|skeleton|extraData" \
  packages/kit packages/kit-bg packages/shared
rg -n "Earn.*detail|protocol.*symbol|native.*wrapped|about" \
  packages/kit/src/views/Market packages/kit/src/views/Earn packages/shared
rg --files packages/kit packages/kit-bg packages/shared | \
  rg '(Earn|DeFi|Borrow|Staking).*(test|spec)\.'
```

When request/response semantics decide the fix, inspect the current service
DTO, handler, and representative payload. Record what the field means, not one
temporary implementation snapshot.

Focused anchors for recent account-scoped/mobile behavior include
`packages/kit/src/views/Earn/pages/EarnProtocolDetails/hooks/useProtocolDetailData.test.tsx`,
`packages/kit/src/views/Earn/pages/EarnProtocolDetails/mobile/mobileDetailTabs.utils.test.ts`,
`packages/kit/src/views/Earn/hooks/useStakingPendingTxs.test.tsx`,
`packages/kit/src/views/Borrow/components/ManagePosition/hooks/useBorrowApproval.test.tsx`,
and `packages/kit/src/views/Borrow/pages/borrowHistoryList.utils.test.ts`.

## Package Boundaries

Keep the repository hierarchy intact: `shared` imports no other OneKey
packages; `components` imports `shared`; `kit-bg` imports `shared` and `core`;
`kit` may import `shared`, `components`, and `kit-bg`.
