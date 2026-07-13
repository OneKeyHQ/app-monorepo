# Perps Order Contracts

Open this before changing order submission, cancel, validation, display, history, or order-mode UI.

## Source of truth (verify, do not trust memory)

These contracts are **SDK-typed and volatile**. Confirm against source before relying on a field/value:

- SDK action types (type-enforced, in repo): `node_modules/@nktkas/hyperliquid/src/api/exchange/_methods/` — `order.ts`, `twapOrder.ts`, `twapCancel.ts`, `modify.ts`, `batchModify.ts`, `cancel.ts`.
- OneKey re-exports: `packages/shared/types/hyperliquid/sdk.ts` (`import * as HL from '@nktkas/hyperliquid'`).
- Official exchange docs: <https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint>.
- Recheck on every SDK bump; let the SDK type be the arbiter.

## Shared invariants

- Asset type matters: `perp` and `spot` can share UI but not every order contract.
- Keep price/size precision in shared utilities and service validation; do not reimplement formatting in a component.
- Validate reduce-only against current position side/size before submit.
- Treat mixed child-order outcomes as possible for batched orders; inspect returned statuses and thrown SDK/service errors instead of assuming all-or-nothing.
- Do not assume missing fee/rate/slippage fields mean zero.

## TIF

- `tif` exists only on the `limit` order variant; `trigger` and `twapOrder` have no `tif`.
- Read `order.ts` / `modify.ts` / `batchModify.ts` `t.limit.tif` for the raw SDK list; OneKey user-facing TIF is narrower and must not expose internal market TIF such as `FrontendMarket`.
- Scale child limit orders carry TIF; spot scale currently uses `Gtc`, perp may use normalized user limit TIF.

Key anchors:
- `node_modules/@nktkas/hyperliquid/src/api/exchange/_methods/order.ts`, `modify.ts`, `batchModify.ts` (`t.limit.tif` picklist — raw SDK source of truth).
- `packages/shared/types/hyperliquid/sdk.ts` (`ITIF`).
- `packages/kit/src/views/Perp/utils/timeInForce.ts`.
- `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidExchange.ts` (`normalizeUserLimitTif`, order placement methods).

## TWAP

- TWAP is Hyperliquid native `twapOrder` / `twapCancel`.
- TWAP is not a limit order: no price, no tif; read `twapOrder.ts` for exact fields/duration.
- It is not a normal open order and must not use ordinary oid cancel.
- Active TWAP state comes from `twapStates` / `webData2.twapStates`.
- History/details come from `userTwapHistory` and `userTwapSliceFills`.
- Cancel by `{ a: assetId, t: twapId }`.
- Do not show limit price, TP/SL, or TIF controls for TWAP unless product/API contracts change.
- TWAP can underfill; slice fills must be labeled so users do not confuse them with one manual order.
- Recheck builder-fee behavior before promising it.

Key anchors:
- `node_modules/@nktkas/hyperliquid/src/api/exchange/_methods/twapOrder.ts`, `twapCancel.ts` (SDK payload source of truth).
- `ServiceHyperliquidExchange.ts` (`twapOrder`, `twapCancel`).
- `contexts/hyperliquid/actions.ts` (`twapStates`, TWAP maps, cancel filtering).
- `packages/shared/types/hyperliquid/types.ts` (`TWAP_STATES`, `USER_TWAP_HISTORY`, `USER_TWAP_SLICE_FILLS`).

## Scale orders

- Scale is not a native Hyperliquid order group — the SDK has no scale action/primitive (check the `_methods/` directory if unsure). It is built client-side.
- OneKey builds multiple child limit orders locally and submits them through ordinary batch `order`.
- Validate every child leg: price, size, precision, min notional, and reduce-only constraints.
- Mixed child statuses or thrown child errors are possible; UI/toast must not collapse every scale submission into one guaranteed-success result.
- Do not fake a native group or rely on group metadata surviving across devices.
- Handle rounding remainder intentionally, usually on the last leg; map product distributions through shared scale utilities.

Key anchors:
- `packages/shared/src/utils/hyperliquidScaleOrderUtils.ts` (`buildScaleOrderLegs`, `validateScaleOrderLegs`, `assertValidScaleOrderLegs`).
- `ServiceHyperliquidExchange.ts` (`placeScaleOrder`).
- `contexts/hyperliquid/actions.ts` (`placeScaleOrder`, order mode routing).
- `packages/shared/types/hyperliquid/types.ts` (`IPlaceScaleOrderParams`, scale types).

## Trigger / TP-SL

- Trigger and TP/SL share some visual concepts with limit orders but not all execution semantics.
- Trigger has no tif field. TP/SL is driven by `order` action `grouping`; read `order.ts` for exact trigger fields/grouping.
- Trigger state/list display must be checked separately from open-order display.
- Position TP/SL modal changes must validate selected position, side, asset, and account scope.

## Reduce-only

- Reduce-only order side must oppose an existing position.
- Reduce-only size must not exceed the current position unless the current contract handles it safely.
- For scale reduce-only, validate aggregate and per-leg implications before submit.
- Do not allow stale position state to pass reduce-only validation after account/asset switch.

## Precision and display

- Use `perpsUtils.ts` and scale utilities for precision/formatting.
- Price scale for TradingView display is not necessarily the same as order payload precision.
- Avoid `Number` conversions in hot trading paths if string/BN precision is already preserved upstream.
- Do not use `JSON.stringify()` for cryptographic/hash/signature paths; use stable serialization where required by repo rules.
