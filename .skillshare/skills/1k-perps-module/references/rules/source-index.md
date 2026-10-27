# Perps Source Index

Use when changing SDK/API contracts or when a fact depends on the branch, provider, server configuration or installed package. Ordinary presentation edits do not require external API research.

## Establish the working contract

1. Check the working revision and dependency declaration in `package.json` / `yarn.lock`.
2. Inspect matching `patches/@nktkas+hyperliquid+*.patch` and `patches/@nktkas+rews+*.patch` files. A package version alone does not describe OneKey's patched behavior.
3. If dependencies are available, inspect the installed version and source. Follow package exports to the runtime/type entry affected by the task; compare it with the patch when relevant.
4. Follow OneKey's narrowed types and adapter to the consumer and relevant tests. Consult official docs for external semantics not established by the local implementation.

```bash
node -p "require('./node_modules/@nktkas/hyperliquid/package.json').version"
rg --files patches | rg '@nktkas\+(hyperliquid|rews)\+'
```

SDK action sources are under `node_modules/@nktkas/hyperliquid/src/api/exchange/_methods/`; inspect `order.ts`, `modify.ts`, `batchModify.ts`, `twapOrder.ts`, `twapCancel.ts` or `cancel.ts` as relevant. The currently patched `modify` supports `alwaysPlace` through its adapter; confirm the active branch rather than assuming upstream and local behavior are identical.

If dependencies are absent, package/lock/patches still provide a starting point. State that installed behavior was not checked instead of silently treating a different checkout's installation as authoritative.

## Repository sources

- Re-exports/narrowed types: `packages/shared/types/hyperliquid/sdk.ts`, `packages/shared/types/hyperliquid/types.ts`.
- Exchange adapters: `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidExchange.ts` and its `utils/` helpers.
- WS client/config: `packages/kit-bg/src/services/ServiceHyperLiquid/hyperLiquidApiClients.ts`, `packages/kit-bg/src/services/ServiceHyperLiquid/utils/SubscriptionConfig.ts`.
- Deposit provider selection: `packages/kit/src/views/Perp/hooks/useShowDepositWithdrawModal.ts`.
- Relay quote/status: `packages/kit-bg/src/services/ServiceSwap.ts`.
- Unifold contract/parsing: `packages/shared/types/unifoldDeposit.ts`, `packages/kit-bg/src/services/ServiceUnifoldDeposit.ts`.
- Withdrawal route: `packages/kit-bg/src/services/ServiceHyperLiquid/usdcWithdrawRoute.ts`.

## External facts

- [Hyperliquid Exchange endpoint](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint)
- [Hyperliquid Info endpoint](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint)
- [Hyperliquid WebSocket subscriptions](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions)

For Relay/Unifold fields, start from the app's backend adapter and the API/schema for that deployment. Provider docs do not prove that the app backend exposes the same fields. Recheck fees, routing, eligibility, duration/status extensions and refund behavior when changing them; do not encode Jira/PR state, personal notes or unverified business assumptions as permanent rules.

On SDK upgrades, include local patch compatibility and affected transport/runtime behavior in the relevant checks. Use `$1k-patch-package-workflow` if modifying a third-party patch; this guide does not require an SDK upgrade.
