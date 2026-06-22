# Perps Validation Recipes

Prefer the smallest validation that proves the changed owner. Add runtime proof for user-visible trading behavior.

## Targeted tests to look for first

- `packages/kit/src/views/Perp/utils/timeInForce.test.ts`
- `packages/kit/src/views/Perp/utils/minimumOrderGuard.test.ts`
- `packages/kit/src/views/Perp/utils/subscriptionPlanner.test.ts`
- `packages/kit/src/views/Perp/utils/l2BookFreshness.test.ts`
- `packages/kit/src/views/Perp/utils/perpsMarketDataFreshness.test.ts`
- `packages/kit/src/views/Perp/utils/accountScopedData.test.ts`
- `packages/kit/src/views/Perp/components/PerpsGlobalEffects.utils.test.ts`
- `packages/kit/src/views/Perp/components/OrderBook/tickSizeUtils.test.ts`
- `packages/kit/src/states/jotai/contexts/hyperliquid/utils/l2BookUtils.test.ts`
- `packages/kit-bg/src/services/ServiceHyperLiquid/utils/SubscriptionConfig.test.ts`
- `packages/kit-bg/src/services/ServiceHyperLiquid/userAbstractionCache.test.ts`
- `packages/shared/src/utils/hyperliquidScaleOrderUtils.test.ts`
- `packages/kit/src/views/Perp/utils/scaleOrderValidation.test.ts`

## Command pattern

Use repo-standard targeted commands where possible, then staged checks before commit:

```bash
yarn jest <changed-test-file>
yarn tsc:staged
yarn lint:staged
```

If touching broad Perps/shared/kit-bg code, consider the relevant package typecheck/test command from `/1k-dev-commands`.

## Runtime scenarios

### Scale

- 2, 20, and high-count legs.
- Fixed and increasing distributions.
- Long and short price ordering.
- Per-leg min notional and precision failure.
- Partial child-order failure display/toast.
- Spot vs perp TIF behavior.
- Reduce-only with opposite position, no position, and oversize.

### TWAP

- Duration lower/upper bounds currently supported by product/API.
- Randomize on/off.
- Reduce-only protection.
- Active TWAP appears from TWAP state, not ordinary open orders.
- Cancel by twapId.
- Slice fills/history labeling.

### TIF and ordinary orders

- Limit `Gtc`, `Ioc`, `Alo` availability.
- Market submit does not expose user TIF.
- Trigger/TP-SL flow unaffected by limit TIF changes.
- Existing limit modify/cancel still works.

### Orderbook/subscriptions

- Perp -> Perp rapid switch.
- Spot -> Spot rapid switch if spot Perps surface is enabled.
- Spot -> Perp and Perp -> Spot switch.
- Account switch while L2 updates are arriving.
- Disconnect/reconnect and app foreground/background.
- No old L2/BBO flash after switch.

### TradingView/K-line

- Initial offline load then reconnect.
- Reconnect before iframe ready.
- Reconnect after iframe ready.
- Symbol switch with chart lines visible.
- Drag/edit chart lines for supported order types.
- Native iOS/Android WebView if recovery code changes.

### Relay deposit

- Amount/source-chain change after quote.
- Copy address after quote refresh.
- Close modal with pending deposit.
- Same depositAddress with a new requestId.
- Completed/refund/failure terminal states.

## Evidence standard

When reporting completion, include:

- The owner validated: shared utility, action, background service, subscription, chart bridge, or visible UI.
- The exact command/test run.
- Runtime path verified or why it could not be verified.
- Remaining volatile facts that were rechecked or still need product/backend confirmation.
