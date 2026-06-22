# TradingView and K-line Bridge

Open this for Perps chart, K-line, TradingView iframe, chart lines, offline recovery, or symbol switching.

## Code anchors

- `packages/kit/src/views/Perp/components/PerpCandles.tsx` - Perps chart surface.
- `packages/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2.tsx` - Perps TradingView bridge; `SYMBOL_CHANGE` and chart-line messages live here.
- `packages/kit/src/components/TradingView/TradingViewPerpsV2/constants/messageTypes.ts` - message type constants (`tradingview_perpsReady`, `tradingview_chartReady`).
- `packages/shared/src/utils/perpsUtils.ts` - price scale and display helpers.
- Use `/1k-tradingview-communication` for shared TradingView message contracts.

## Readiness states

- `chartReady` is not enough for Perps iframe readiness.
- `tradingview_perpsReady` / chart-lines readiness represent deeper iframe readiness.
- Already-ready chart should recover without unnecessary reload.
- Not-ready chart after network recovery may need local reload/remount.
- Native WebView initial offline failure can need key remount; plain `reload()` may not recover.

## Symbol switching

- Symbol-only changes should go through `SYMBOL_CHANGE` when the bridge supports it.
- Do not rebuild the whole chart for every symbol change if a bridge message is sufficient.
- Asset switch must align chart symbol, orderbook target, ticker data, and active order form asset.
- Old chart lines for the previous symbol must not survive into the next symbol.

## Chart lines

- Position/order/TWAP/trigger lines must be scoped by account, dex, symbol, and order type.
- Drag-to-modify must use the owning order contract; do not reuse normal limit modify behavior for TWAP.
- Line recovery should wait for chart-lines readiness, not just WebView load.
- Missing chart lines after reload are not fixed by ticker/orderbook recovery; inspect bridge messages.

## Offline and recovery

- K-line recovery must not be coupled to global Hyperliquid websocket recovery.
- Global WS recovery can restore ticker/orderbook while the iframe remains dead.
- Recovery path should distinguish initial offline load, reconnect after ready, and reconnect before ready.
- Avoid reload loops: guard by readiness, network state, and last attempted recovery.

## Validation focus

- Symbol switch: BTC -> ETH -> BTC; no stale lines, no old candle data, order form matches symbol.
- Offline before chart ready: reconnect should recover K-line.
- Offline after chart ready: reconnect should not force destructive reload unless needed.
- Native WebView: verify reload/remount behavior on iOS/Android if changed.
- Drag/edit lines: verify payload and visible result for limit/trigger/position line types separately.
