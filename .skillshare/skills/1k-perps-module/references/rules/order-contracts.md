# Perps Orders and Execution Prices

Use for order behavior, validation, order-mode controls or execution prices. A row's spacing or label-only change can stay in the UI; it does not require rechecking every order contract below.

## Starting points

- UI form/confirmation: `packages/kit/src/views/Perp/components/TradingPanel/`, `packages/kit/src/views/Perp/hooks/useOrderConfirm.ts`.
- Orchestration: `packages/kit/src/states/jotai/contexts/hyperliquid/actions.ts` (`placeOrderByCoin`, `amendChartOrder`, `chaseOrder`, `cancelChartOrder`).
- SDK adapter: `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidExchange.ts` (`placeOrderByCoin`, `amendOrderPriceByOid`, `modifyOrder`, `placeScaleOrder`, `twapOrder`, `twapCancel`).
- Payload helpers: `packages/kit-bg/src/services/ServiceHyperLiquid/utils/coinScopedOrder.ts`, `packages/kit-bg/src/services/ServiceHyperLiquid/utils/orderAmend.ts`.
- Position actions: modals under `packages/kit/src/views/Perp/components/OrderInfoPanel/`; helpers `packages/kit/src/views/Perp/components/OrderInfoPanel/utils/addPosition.ts` and `packages/kit/src/views/Perp/components/OrderInfoPanel/utils/positionTpslSnapshot.ts`.
- Shared precision/contracts: `packages/shared/src/utils/perpsUtils.ts`, `packages/shared/src/utils/hyperliquidScaleOrderUtils.ts`, `packages/shared/types/hyperliquid/`.

When changing wire semantics, confirm the working branch's SDK, patches and narrowed types using [source index](source-index.md). Product controls may deliberately expose fewer capabilities than the SDK.

## Order-mode boundaries

| Mode | Current contract and common mistake |
| --- | --- |
| Limit / TIF | `tif` belongs to the `limit` variant. OneKey user choices are narrowed by `views/Perp/utils/timeInForce.ts`; internal market TIF such as `FrontendMarket` is not a user limit option. Spot scale currently uses `Gtc`; perp scale can use normalized user limit TIF. |
| Market | User limit TIF controls do not apply. Check the actual reference price and slippage path rather than treating the display price as a guaranteed execution price. |
| Trigger / TP-SL | Trigger has its own payload, not a limit `tif`. TP/SL relationships depend on `order` grouping. Preserve trigger/limit distinctions during modify and list/chart rendering. |
| TWAP | Native `twapOrder` / `twapCancel`, not an ordinary open order. The base TWAP payload has no limit price or TIF. Check the installed schema for duration and any extensions; do not transplant ordinary TP/SL controls without a supported contract. Cancel with assetId/twapId, not oid. |
| Scale | OneKey builds child limit orders locally and submits ordinary batch `order`; there is no native scale group in this implementation. Validate child precision, min notional and size as well as the aggregate. Mixed statuses and thrown child errors are possible. |

TWAP active state comes from `twapStates` / `webData2.twapStates`; history and fills from `userTwapHistory` / `userTwapSliceFills`. Preserve slice labeling and partial-fill/underfill behavior. Recheck fee support before promising it.

For scale, use the shared leg builders/validators, preserve intentional rounding remainder and distribution handling, and do not assume grouping metadata survives across devices. A successful batch request does not establish success for every leg.

Reduce-only validation uses the intended account's current position, side and size. Check aggregate and per-leg implications for scale; do not let a stale position satisfy validation. Preserve the actual exchange/product oversize behavior rather than inventing a new clamp or universal size rule. Missing fee/rate/slippage values are not evidence of zero.

## Coin-scoped actions and Chase

An order or position row may refer to a different coin from the active chart. Use the intended coin/oid and account when resolving metadata, precision and current position/order. Revalidate after asynchronous guards or dialogs if the selection can change.

`chaseOrder` resolves the existing order, checks its eligible amendment kind, and requests `amendOrderPriceByOid` with `alwaysPlace`. `buildHyperliquidModifyRequest` maps that option to action-level `a: true`; it is distinct from nested `order.a` (assetId). The working SDK patch and parsed request must retain the field. Check cloid, reduce-only, trigger kind and returned order status when altering this flow.

`useChasingOrderTask` in the order panel tracks pending work per oid. Other entry points have their own submit/confirmation guards; preserve protection against duplicate actions and recheck the current target rather than adding a blanket global lock.

## Price purpose and readiness

- `packages/kit/src/views/Perp/hooks/useTradingPrice.ts` and `usePerpsMidPrice.ts` select live/display sources. Display snapshots, formatted prices and chart priceScale are not interchangeable with payload precision or a fresh execution reference.
- `packages/kit/src/views/Perp/hooks/useOrderPrice.ts` and `packages/kit/src/views/Perp/utils/tradingReferencePrice.ts` resolve order/sizing prices. For standard BBO limit sizing, the hidden static form price can be stale; use the resolved order price. Do not substitute mid for mark/oracle calculations without tracing the contract.
- `ServiceHyperliquid.getMarketOrderReferencePrice` uses `packages/kit-bg/src/services/ServiceHyperLiquid/utils/marketOrderReferencePrice.ts`: validate the cached allMids entry or load the requested coin's dex. `ClosePositionModal.tsx` has UI readiness/submit checks; main displaying a price does not establish BG readiness on split-runtime targets.
- The `addPosition.ts` helper listed above ties sizing to the scoped position and margin data. Keep string/BigNumber precision where preserved upstream; formatted display values should not silently become order inputs.

For book/BBO click eligibility, use [market data](state-subscriptions.md); for account/position identity, use [account state](positions-account-state.md).

## Select validation for the changed contract

Existing tests include:

- `packages/kit-bg/src/services/ServiceHyperLiquid/utils/coinScopedOrder.test.ts`, `packages/kit-bg/src/services/ServiceHyperLiquid/utils/orderAmend.test.ts`, `packages/kit-bg/src/services/ServiceHyperLiquid/utils/marketOrderReferencePrice.test.ts`.
- `packages/kit/src/views/Perp/utils/timeInForce.test.ts`, `packages/kit/src/views/Perp/utils/minimumOrderGuard.test.ts`, `packages/kit/src/views/Perp/utils/tradingReferencePrice.test.ts`, `packages/kit/src/views/Perp/hooks/useOrderPrice.test.ts`.
- `packages/shared/src/utils/hyperliquidScaleOrderUtils.test.ts`, `packages/kit/src/views/Perp/utils/scaleOrderValidation.test.ts`.
- `packages/kit/src/views/Perp/components/OrderInfoPanel/utils/addPosition.test.ts`, `packages/kit/src/views/Perp/components/OrderInfoPanel/utils/positionTpslSnapshot.test.ts`, `packages/kit/src/views/Perp/components/OrderInfoPanel/hooks/useChasingOrderTask.test.ts`.

Choose applicable cases: TIF availability and modify/cancel; TWAP duration/randomization/reduce-only/cancel/history; scale small/large leg counts, distributions, direction, per-leg precision/notional and mixed failure; target switch while a dialog is open; stale/missing price at cold start; repeated submission. For external effects, follow existing authorization boundaries and the [validation guide](validation-recipes.md).
