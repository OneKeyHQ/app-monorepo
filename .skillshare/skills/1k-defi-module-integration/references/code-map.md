# Code Map

Use these anchors to orient in the current repository. Prefer nearby patterns over parallel abstractions. The executable anchor map was reviewed at `ec605542881e`; run the readiness script before relying on it.

## Routes And Hosts

- `packages/shared/src/routes/staking.ts`
- `packages/shared/src/routes/tabEarn.ts`
- `packages/kit/src/routes/Tab/Earn/router.ts`
- `packages/kit/src/routes/Tab/Discovery/router.ts`
- `packages/kit/src/views/Earn/earnUtils.ts`
- `packages/kit/src/views/Discovery/pages/Browser/Browser.native.tsx`

Important anchor:

- `safePushToEarnRoute`

Entry-specific anchors:

- `safePushToEarnRoute` targets `ETabRoutes.Discovery` on native and
  `ETabRoutes.Earn` on desktop/web.
- Native `EarnHome` is not a pushed Discovery stack route; the code switches
  Discovery to the Earn sub-tab and optionally emits `SwitchEarnTab`.
- Non-home Earn routes on native are pushed into the Discovery stack before
  switching tabs to avoid combined selected-page and children updates.
- `EarnNavigation.popToEarnHome` has separate native and desktop/web paths;
  do not reuse one path as proof for the other platform.

## Earn Home, List, And Detail

- `packages/kit/src/views/Earn/EarnHome.tsx`
- `packages/kit/src/views/Earn/EarnProvider.tsx`
- `packages/kit/src/views/Earn/EarnProviderMirror.tsx`
- `packages/kit/src/views/Earn/components/Recommended.tsx`
- `packages/kit/src/views/Earn/components/RecommendedSection.tsx`
- `packages/kit/src/views/Earn/components/ProtocolsTabContent.tsx`
- `packages/kit/src/views/Earn/components/AvailableAssetsTabViewList.tsx`
- `packages/kit/src/views/Earn/hooks/useEarnPortfolio.ts`
- `packages/kit/src/views/Earn/hooks/useStakingPendingTxs.ts`
- `packages/kit/src/states/jotai/contexts/earn/actions.ts`
- `packages/kit/src/views/Home/components/EarnListView/EarnListView.tsx`
- `packages/kit/src/views/Earn/pages/EarnProtocols/index.tsx`
- `packages/kit/src/views/Earn/pages/EarnProtocolDetails/index.tsx`
- `packages/kit/src/views/Earn/pages/EarnProtocolDetails/hooks/useProtocolDetailData.ts`

Important anchors:

- `Recommended` and `RecommendedSection` for recommendation-card data and display.
- `AvailableAssetsTabViewList` for available-assets fetch, filters, and search.
- `ProtocolsTabContent` and `EarnMainTabs` for active-tab propagation.
- `useEarnActions.triggerRefresh` for available-assets refresh ownership.
- `EarnListView` for Home -> Earn entry; it is a source entry, not the owner
  of Earn home/list/detail refresh after navigation.

## DeFi Portfolio Actions And AssetDetails Modal

- `packages/kit/src/views/Home/components/DeFiListBlock/Protocol.tsx`
- `packages/kit/src/views/Home/components/DeFiListBlock/ProtocolPositionCell.tsx`
- `packages/kit/src/views/AssetDetails/pages/DeFiProtocolDetails.tsx`
- `packages/kit/src/views/AssetDetails/pages/DeFiProtocolAction.tsx`
- `packages/shared/src/routes/assetDetails.ts`
- `packages/kit/src/components/DeFi/ProtocolPositionActionButton.tsx`
- `packages/kit/src/components/DeFi/ProtocolPositionActionDialog.tsx`
- `packages/kit/src/components/DeFi/ProtocolLendingActionDialog.ts`
- `packages/kit/src/components/DeFi/ProtocolLendingActionDialogContent.tsx`
- `packages/kit-bg/src/services/ServiceDeFi.ts`

Important anchors:

- `EModalAssetDetailRoutes.DeFiProtocolDetails`
- `EModalAssetDetailRoutes.DeFiProtocolAction`
- `actionPresentation: 'dialog' | 'modal-route'`
- `renderMode: 'dialog' | 'page'`
- `serviceDeFi.fetchSupportedDeFiProtocols`
- `serviceDeFi.refreshAccountDeFiPositionsAfterAction`
- route params and protocol payload fields carrying `accountId` and
  `indexedAccountId`

AssetDetails modal pages are separate route hosts from Home tab content. When
an action needs account identity, pass it through the route or protocol payload
rather than reading Home-only context from the modal.

Native uses the `DeFiProtocolAction` modal route with page rendering. Extension
and desktop can use the in-page dialog. Keep the host decision separate from
the shared typed action content.

## Action, Order, Permit, And Error Anchors

- `packages/kit/src/components/DeFi/ProtocolPositionActionDialog.tsx`
- `packages/kit/src/components/DeFi/DeFiActionTxConfirmResult.tsx`
- `packages/kit/src/components/DeFi/protocolPositionActionPercentUtils.ts`
- `packages/kit-bg/src/services/ServiceDeFi.ts`
- `packages/kit-bg/src/services/ServiceStaking.ts`
- `packages/kit/src/views/Borrow/hooks/useUniversalBorrowHooks.ts`
- `packages/kit/src/views/Borrow/hooks/useUniversalBorrowWithdrawRepayHooks.ts`
- `packages/kit/src/views/Borrow/components/ManagePosition/hooks/useBorrowApproveAndSubmit.ts`
- `packages/shared/src/utils/defiActionUtils.ts`
- `packages/shared/src/utils/defiPositionMetadataUtils.ts`
- `packages/shared/src/utils/defiPermitUtils.ts`
- `packages/shared/types/defi.ts`

Important anchors:

- `normalizeDeFiBuildTransactionResp`
- `fetchSupportedDeFiProtocols`
- `/earn/v1/defi/build-transaction`
- `refreshAccountDeFiPositionsAfterAction`
- `syncBorrowOrder`
- `attachBorrowOrderId`
- `handleBorrowSuccess`
- `useBorrowApproveAndSubmit`
- `showDeFiActionTxConfirmDialog`
- `addEarnOrder`
- `validateLidoWithdrawPermitTypedData`

Use these paths for build response shape, `orderId` tracking, approval/permit
handling, duplicate-submit prevention, operation-level error diagnostics, and
post-action refresh.

The current lending sequence must preserve approval handoff, business confirm,
all success/fail/cancel terminals, `orderId` attachment after broadcast, settle,
and refresh. Percent/max input is part of execution correctness, not layout.

## Portfolio Refresh, Events, And Persistence

- `packages/kit/src/views/Home/components/DeFiListBlock/DeFiListBlock.tsx`
- `packages/kit/src/states/jotai/contexts/deFiList/atoms.ts`
- `packages/kit/src/states/jotai/contexts/deFiList/actions.ts`
- `packages/shared/src/eventBus/appEventBus.ts`
- `packages/shared/src/eventBus/appEventBusNames.ts`
- `packages/kit-bg/src/services/ServiceDeFi.ts`
- `packages/kit-bg/src/dbs/simple/entity/SimpleDbEntityDeFi.ts`
- `packages/kit-bg/src/dbs/simple/base/SimpleDbEntityBase.ts`

Important anchors:

- `currentOwnerKey` and `loadedOwnerKey`
- `AccountDataUpdate` and `DeFiPositionRefreshed`
- `_runDeFiForceRefresh`
- `refreshAccountDeFiPositionsAfterAction`
- `consumeManualForceRefreshQuota`
- account/network-keyed immediate plus 40s/80s refresh

`DeFiListBlock` is the `main` reconciliation owner. `ServiceDeFi` and
`SimpleDbEntityDeFi` are `bg` owners. The underlying storage persists, but the
UI, service, entity wrapper, and event payload are separate JS objects.
`SimpleDbEntityDeFi.enableCache` is `false`, so it reads persistent storage
instead of keeping a reusable `cachedRawData` copy.

## External Discovery Boundary

- `packages/kit/src/states/jotai/contexts/discovery/actions.ts`
- `packages/kit/src/views/Discovery/pages/Browser/Browser.native.tsx`
- `packages/kit/src/views/Discovery/components/DiscoveryBrowserProviderMirror.tsx`
- `packages/kit/src/views/Discovery/components/WebContent/WebContent.native.tsx`
- `packages/kit/src/views/Discovery/components/WebContent/WebContent.desktop.tsx`
- `packages/kit/src/views/Discovery/hooks/useDiscoveryMessageHandler.ts`
- `packages/kit-bg/src/services/ServiceDApp.ts`
- `packages/kit/src/views/SignatureConfirm/router/index.tsx`
- `packages/shared/src/routes/signatureConfirm.ts`

Important anchors:

- `useBrowserAction`
- `handleOpenWebSite`
- `ServiceDApp.openSignAndSendTransactionModal`
- `EModalSignatureConfirmRoutes.TxConfirmFromDApp`

Opening an external protocol page does not create an App-owned DeFi action.
Before a website sends a chain RPC, no internal build, confirm, pending row,
order, or portfolio refresh should be introduced.

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
