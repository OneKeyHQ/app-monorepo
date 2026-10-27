# Perps Deposits and Withdrawals

Use for Perps funding flows. Check `packages/kit/src/views/Perp/hooks/useShowDepositWithdrawModal.ts` first: provider selection depends on the current configuration, recipient and account. Relay and Unifold coexist; older branches may only have Relay. Generic Swap pending work belongs to `$1k-trade-swap-market`.

## Locate the active path

| Path | Starting owners | Relevant identity |
| --- | --- | --- |
| Relay quote, submit, pending | `packages/kit/src/views/Perp/hooks/usePerpDeposit.ts`; `packages/kit-bg/src/services/ServiceSwap.ts` (`fetchPerpDepositQuote`, `fetchPerpDepositOrderStatus`, `perpDepositOrderFetchLoop`) | Active account, `fromTxId`, and request scope when exposed by the API |
| Unifold recipient and deposit session | `packages/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession.ts`; `packages/kit-bg/src/services/ServiceUnifoldDeposit.ts` | Recipient/destination, session and execution scopes with different lifetimes |
| Modal presentation | `packages/kit/src/views/Perp/components/TradingPanel/modals/DepositWithdrawModal.tsx` | Current account, provider and form selection |
| Withdrawal route | `packages/kit-bg/src/services/ServiceHyperLiquid/usdcWithdrawRoute.ts` | Destination configuration and live submission route |

State lives in `packages/kit-bg/src/states/jotai/atoms/perps.ts`, including `perpsDepositOrderAtom` and `perpsUnifoldDepositTrackingAtom`. Provider types are in `packages/shared/types/unifoldDeposit.ts`; configuration is consumed through the Perps services. Trading enablement/deposit fallback is covered by [session and signing](session-signing.md).

## Relay

Preserve the quote's explicit `depositAddress` meaning; do not treat a generic `to` field as equivalent or infer the source chain from the first candidate. Use the provider quote/status path for deposit discovery rather than indexing all chains client-side. Recheck amount, token, source chain and destination when selections change. Reject late quote/status results belonging to another active scope.

Trace pending through `ServiceSwap`'s Perps methods and the deposit atom. Use `fromTxId` and any request identity actually exposed by that path; do not require an invented `requestId` on every provider response. Closing the modal is not proof that a submitted deposit finished. Preserve the applicable completion/refund display and non-EVM address handling. When enabling additional non-EVM origin chains, check the applicable refund path and user-facing recovery before offering them. Provider error text is not a stable contract.

## Unifold

Start with the session hook and the recipient, destination and execution helpers under `packages/kit/src/views/Perp/utils/`. Check recipient/account binding on both sides of an asynchronous request; the background service's active-account validation and returned identity matter when the UI changes accounts mid-request.

Distinguish the live modal session from durable background tracking. Follow session claiming/finalization and recipient discovery when a deposit executes after the modal closes. An empty poll does not prove completion, and a late execution may need discovery after the original session has ended. Inspect the actual scope of each event instead of assuming every event carries a live session ID.

Terminal notification ownership is `packages/kit/src/provider/Container/PerpsUnifoldDepositTerminalDeliveryContainer.tsx`, including claim, delivery and acknowledgment. Startup recovery lives in `packages/kit-bg/src/services/ServiceUnifoldDeposit/resumeUnifoldDepositTracking.ts`, called from `packages/kit-bg/src/services/ServiceBootstrap.ts`. A modal-only success handler will miss background completion. Preserve the service/container claim and acknowledgment lifecycle so a remount does not lose or duplicate a delivery.

Keep polling, expiry and discovery policy in its existing owner. Read current constants when needed instead of copying timing values into this guide.

## Withdrawal

`getUsdcWithdrawRoute` can serve cached display state. In `ServiceHyperliquidExchange.withdraw`, destinations configured for CCTP re-read `getLiveUsdcWithdrawRoute` and check the expected route/fee before submission; other transfer types follow their own path. Destination and fee helpers live in `packages/kit-bg/src/services/ServiceHyperLiquid/cctpWithdraw.ts`. Account mode separately affects the withdrawal source balance/dex. Trace those callers before changing routing or eligibility: an earlier display quote does not establish the live submission contract.

## Select validation for the affected lifecycle

Use the applicable existing tests, not this whole list:

- Relay/form: `packages/kit/src/views/Perp/hooks/usePerpDeposit.test.ts` and `packages/kit/src/views/Perp/components/TradingPanel/modals/DepositWithdrawModal.test.ts`.
- Unifold session/service: `packages/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession.test.ts` and `packages/kit-bg/src/services/ServiceUnifoldDeposit.test.ts`; recipient/destination/execution tests next to those UI helpers.
- Post-close delivery/restart: `packages/kit/src/provider/Container/PerpsUnifoldDepositTerminalDeliveryContainer.test.tsx` and `packages/kit-bg/src/services/ServiceUnifoldDeposit/resumeUnifoldDepositTracking.test.ts`.
- Withdrawal routing: `packages/kit-bg/src/services/ServiceHyperLiquid/usdcWithdrawRoute.test.ts`.

Choose relevant cases such as account A→B during a request, provider change, stale quote/status, closing before execution, reload before acknowledgment, restart discovery, or an unreadable live withdrawal route. Parsing and lifecycle checks can use fixtures/mocks. Real funding is unnecessary unless the task explicitly calls for it; reuse existing authorization when it does.
