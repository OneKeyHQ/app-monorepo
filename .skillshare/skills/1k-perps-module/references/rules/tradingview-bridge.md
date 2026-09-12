# Perps TradingView Bridge

Use for Perps candles, readiness, chart lines, order intents and recovery. Generic bridge protocols also use `$1k-tradingview-communication`; layout/scroll work can start with [layout and interaction](layout-interactions.md).

## Current owners

- Entry: `packages/kit/src/views/Perp/components/PerpCandles.tsx`.
- Wrapper: `packages/kit/src/components/TradingView/TradingViewPerpsV2/TradingViewPerpsV2.tsx`.
- Messages: `packages/kit/src/components/TradingView/TradingViewPerpsV2/messageHandlers/usePerpsTradingViewMessageHandler.ts` and `packages/kit/src/components/TradingView/TradingViewPerpsV2/constants/messageTypes.ts`.
- App order UI: `packages/kit/src/views/Perp/components/OrderInfoPanel/` and `packages/kit/src/states/jotai/contexts/hyperliquid/actions.ts`.
- Parent scroll/overlay: `packages/kit/src/views/Perp/pages/MobilePerpMarket.tsx` and `packages/kit/src/views/Perp/utils/mobilePerpMarketScrollState.ts`.

Follow the component actually mounted by Perps. The existence of `TradingViewNative` does not mean this entry uses it. Do not confuse chart messages with the separate Hyperliquid signing WebView protocol.

## Readiness and recovery

WebView load, chart readiness, Perps readiness and line synchronization are different states. A new WebView instance needs its own readiness transition. A visible container or `onLoadEnd` does not prove that candles for the target symbol are rendered.

Select the relevant phase: offline at first load, disconnect before readiness, disconnect after readiness, or native WebView remount. Trace message delivery and readiness before changing reload behavior. Bound retries and preserve the existing native recovery fallback when modifying that flow. Global market-data WS recovery is not proof that the chart is ready.

## Symbol and platform behavior

The shared bridge supports `SYMBOL_CHANGE` with a stable URL. Current `PerpCandles` explicitly passes `reloadOnSymbolChange={platformEnv.isNativeAndroid}`; Android therefore follows a symbol-specific remount/reload path. Inspect the key, URL, background, loading mask and ready messages before applying a generic message-only switching recommendation.

Current desktop trading-UI mode is captured on mount. Treat it as current behavior to consider when changing resize/remount logic, not a permanent ban on a supported design change. If changing either platform strategy, establish the intended behavior and verify its rendering, recovery and intent consequences.

## Lines and order intents

Keep account, dex/coin, order identity and order type aligned when syncing lines. After switching or receiving a delayed message, reject stale intent/line data rather than applying it to the new form. [Order contracts](order-contracts.md) cover quantity, precision and execution semantics when those paths change.

`onChartOrderIntent` routes to the app's order dialogs and actions. The legacy draft callback is intentionally non-submitting; do not turn it into an exchange submission just because its name resembles a trading action. Preserve confirmation/guard behavior used by the actual intent route.

The `trv_interactionOverlay` message updates parent interaction state. Follow its handling and `MobilePerpMarket` scroll state through overlay release, symbol change and unmount when investigating a stuck page. Fixing an overlay lifecycle should not require unrelated subscription changes.

## Select validation

Read `packages/kit/src/components/TradingView/TradingViewPerpsV2/messageHandlers/usePerpsTradingViewMessageHandler.test.ts` and `packages/kit/src/views/Perp/utils/mobilePerpMarketScrollState.test.ts` when their behavior changes.

Choose scenarios that match the diff: actual target candles/lines ready, symbol switch, relevant offline recovery phase, stale account/order intent, overlay scroll release, or Android transition background/mask. Verify real WebView content and bridge state on the affected platform. Extend to desktop, native or extension variants when the shared behavior changes; this is not an all-device checklist for every chart edit.
