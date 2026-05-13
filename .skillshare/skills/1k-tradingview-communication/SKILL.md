---
name: 1k-tradingview-communication
description: OneKey TradingView app bridge guide. Use when changing or debugging TradingView/WebView/iframe communication, chart URL params, kline/history/realtime messages, marks, Hyperliquid price scale, Perps SYMBOL_CHANGE, chart lines, order draft/cancel/drag-amend messages, FORCE_RECOVER_WS, or tradingview_* methods between the app repo and the chart repo. 适用于 TradingView 通信、图表 WebView 通信、K 线、perps 线、marks、消息桥排查。
allowed-tools: Read, Grep, Glob
---

# TradingView Communication

Use this to avoid re-discovering the bridge between the OneKey app repository and the separate TradingView chart repository. Do not assume fixed local filesystem paths; locate files by symbol names with `rg`.

## Mental Model

The app loads the chart app inside WebView/iframe and both sides exchange plain message objects.

- Chart -> app: `$private` payloads with `scope`, `origin`, `method`, and `data`.
- App -> chart: `webRef.current.sendMessageViaInjectedScript(message)`, which lands in the chart as `window.postMessage(message)`.
- Web/extension uses iframe `postMessage`; native/desktop injects a script that calls `window.postMessage(...)`.
- Market mode data normally comes from the OneKey app/background service. Perps/Hyperliquid candles are fetched by the chart app directly, while marks, price scale, symbol sync, and chart lines still use the app bridge.

## Search Anchors

Start with `rg` instead of assuming local paths.

App repo anchors:

- URL builder: `useTradingViewUrl`
- Market wrapper: `TradingViewV2`
- Market receive handler: `useTradingViewMessageHandler`
- Market kline/marks handler: `handleKLineDataRequest`, `fetchAccountTransactionMarks`
- Market realtime push: `useAutoKLineUpdate`, `useTradingViewV2WebSocket`
- Perps wrapper: `TradingViewPerpsV2`
- Perps receive handler: `usePerpsTradingViewMessageHandler`
- Perps line sender: `useChartLines`, `buildAllLinesForSymbol`
- WebView bridge: `sendMessageViaInjectedScript`, `createMessageInjectedScript`, `InpageProviderWebView`, `NativeWebView`, `DesktopWebView`
- Background services: `fetchMarketTokenKline`, `fetchMarketAccountTokenTransactions`, `subscribeOHLCV`, `getTradingviewMidPrice`, `setTradingviewDisplayPriceScale`
- Base URLs: `TRADING_VIEW_URL`, `TRADING_VIEW_URL_TEST`

Chart repo anchors:

- Entry and mode switch: `getBusinessTypeFromUrl`, `shouldUseFastBootstrapFromUrl`
- Widget and manager setup: `TradingViewWidget`, `ChartManager`
- Outbound bridge: `sendMessage`, `createDefaultPayload`, `requestHistoryData`, `getHyperliquidPriceScale`, `getMarksData`
- Symbol sync: `setupSymbolChangeListener`, `publishActiveSymbol`, `symbolDisplayState`
- Market datafeed: `OnekeyDatafeed`
- Hyperliquid datafeed: `HyperliquidDatafeed`, `HyperliquidWebSocket`
- Marks listener: `marksListener`, `MarksManager`
- Perps lines listener: `setupPerpsLinesListener`, `PerpsLinesManager`
- Message constants/types: `METHOD_TYPES`, `PERPS_TV_MESSAGE_TYPES`, `ITVLine`

Treat the TradingView library static asset directory in the chart repo as vendor assets. Do not edit it for bridge changes.

## URL Parameters

App URL generation is centralized in `useTradingViewUrl`.

Common params:

- Always: `timezone`, `locale`, `platform`, `theme`, optional `appVersion`.
- Market: `decimal`, `networkId`, `address`, `symbol`, `type=market`, `storageNamespace=market`.
- Market using Hyperliquid candles: `scene=market-hyperliquid`, `storageNamespace=market-hyperliquid`.
- Perps: `symbol`, `type=perps`, `storageNamespace=perps`, `enablePerpsTradingUi`.

Perps freezes the initial URL symbol and sends later changes via `SYMBOL_CHANGE` to avoid WebView reloads.

## Message Contracts

### Market Kline

Chart requests history with:

```ts
{
  scope: '$private',
  method: 'tradingview_getKLineData',
  data: {
    method: 'tradingview_getHistoryData',
    resolution,
    from,
    to,
    firstDataRequest,
  },
}
```

App handles it in `useTradingViewMessageHandler` -> `handleKLineDataRequest()` and fetches `serviceMarketV2.fetchMarketTokenKline()`.

App replies:

```ts
{
  type: 'kLineData',
  payload: {
    type: 'history',
    kLineData,
    requestData,
  },
}
```

Realtime market updates are app-pushed with `type: 'autoKLineUpdate'` and `payload.type: 'realtime'`.

### Marks

Request/response:

- Chart -> app: `method: 'tradingview_getMarks'` with `requestId`, `symbol`, `from`, `to`, `resolution`.
- App -> chart: `type: 'MARKS_RESPONSE'`, `payload: { marks, requestId }`.

Push updates:

- App -> chart: `type: 'MARKS_UPDATE'`, `payload: { symbol, operation, marks }`.
- `operation` is `incremental`, `replace`, or `clear`.

Market marks come from account token transactions. Perps marks come from Hyperliquid fills.

### Hyperliquid Price Scale

Chart requests:

```ts
{
  scope: '$private',
  method: 'tradingview_getHyperliquidPriceScale',
  data: { symbol, requestId },
}
```

App responds:

```ts
{
  type: 'HYPERLIQUID_PRICESCALE_RESPONSE',
  payload: { priceScale, minmov: 1, requestId },
}
```

The app calculates from current mid price with `calculateDisplayPriceScale()` and caches the result through `serviceHyperliquid.setTradingviewDisplayPriceScale()`.

### Perps Symbol Sync

App sends:

```ts
{
  type: 'SYMBOL_CHANGE',
  payload: {
    symbol,
    displayPair,
    displayCoin,
    force,
  },
}
```

Chart handles it in `setupSymbolChangeListener()`. Display labels are cached by raw symbol in `symbolDisplayState`; do not key Hyperliquid API calls off display labels.

### Perps Lines

App -> chart:

- `PERPS_TV_LINES_SYNC`: full state `{ symbol, revision, lines }`.
- `PERPS_TV_LINES_PATCH`: diff `{ symbol, revision, add, update, remove }`.
- `PERPS_TV_LINES_CLEAR`: `{ symbol }`.
- `PERPS_TV_ORDER_PRICE_UPDATE_REJECTED`: rollback for failed drag amend.

Chart -> app:

- `tradingview_perpsReady`: chart lines can be sent.
- `tradingview_perpsOrderCancel`: user clicked order-line cancel.
- `tradingview_perpsOrderDraftCreate`: plus/context menu placed a draft order.
- `tradingview_perpsOrderPriceUpdate`: user dragged a limit order line.
- `tradingview_chartExpand`: chart expand/collapse state.

The chart serializes sync/patch processing because TradingView line creation is async.

Current app default: `PerpCandles` sets `enablePerpsTradingUi = false`, so order draft/cancel/drag UI paths may exist but are not enabled in normal perps candles.

### Recovery And Touch Scroll

- App sends `type: 'FORCE_RECOVER_WS'` after Hyperliquid WebSocket recovery. Chart validates origin before reconnecting subscriptions.
- Chart sends `method: 'tradingview_touchScroll'` with `{ deltaY }` so app layouts can scroll around the embedded chart.

## Change Checklist

When adding or changing a message:

1. Update constants/types on both sides, not just one repo.
2. Preserve `requestId` for async request/response flows.
3. Keep the payload shape stable for older app/chart builds where possible.
4. For app -> chart messages, add or update a chart-side `window.message` listener.
5. For chart -> app messages, route through `sendMessage()` and handle in the relevant app message handler.
6. For perps lines, respect `revision` ordering and symbol normalization.
7. For Hyperliquid symbols, use the raw coin id for API/cache keys. Display labels are UI-only.
8. Do not bypass `$private` bridge routing, trading enablement checks, order reject rollback, or origin checks.
9. Test both web iframe and native/desktop injected-script behavior when bridge mechanics change.

## Verification

- App-only bridge change: run the relevant TypeScript/lint command for touched files; before commit use `yarn lint:staged` and `yarn tsc:staged`.
- Chart repo change: run `npm run build` or `yarn build` from the chart repo root; run `npm run lint` or `yarn lint` when touching lint-sensitive code.
- For local manual testing, enable "use local TradingView URL" in dev settings and run chart dev server on `localhost:5173` (`10.0.2.2:5173` for Android emulator).
