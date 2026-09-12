# Perps Ownership Map

Use this for cross-layer work or when the task's owner is unclear. Topic references contain the detailed anchors and tests; this map is not a prerequisite for a local UI change.

## App layers

| Layer | Starting anchors | Responsibility |
| --- | --- | --- |
| Entry and layout | `packages/kit/src/views/Perp/pages/`, `packages/kit/src/views/Perp/layouts/`, `packages/kit/src/views/Perp/PerpsProvider.tsx` | Platform layout, navigation, provider lifetime |
| UI context | `packages/kit/src/states/jotai/contexts/hyperliquid/atoms.ts`, `packages/kit/src/states/jotai/contexts/hyperliquid/actions.ts` | Selected instrument, scoped UI data, action orchestration |
| UI effects | `packages/kit/src/views/Perp/components/PerpsGlobalEffects.tsx` | Subscription intent, initialization, UI event synchronization |
| BG/global state | `packages/kit-bg/src/states/jotai/atoms/perps.ts` | Account readiness, live/display data, persisted settings and tracking |
| Info/cache | `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquid.ts`, `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidCache.ts` | Account/info queries, market metadata, recovery caches |
| Exchange/subscriptions | `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidExchange.ts`, `packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidSubscription.ts` | SDK actions and realtime lifecycle |
| Shared contracts | `packages/shared/types/hyperliquid/`, `packages/shared/src/utils/perpsUtils.ts` | Types, precision, identifiers and domain calculations |

Trading intent commonly travels UI -> context action -> background service -> SDK, with results returning through scoped state. Deposit providers and signing have additional owners described in their topic references. UI projections, formatters and interaction state remain legitimate local responsibilities.

## Runtime scope

Apply the repo's runtime topology to the path being investigated:

- **Desktop/Web:** app main and bg code share one JS runtime. A call through the background API does not by itself imply serialization, a second heap or parallel JS execution.
- **iOS/Android/Extension:** app main and bg have independent JS heaps and initialization. State/messages crossing the boundary can become separate JS copies; one side being ready does not establish the other side's readiness.
- **Chart content:** iframe/WebView content has its own execution context and readiness, separately from the app main/bg distinction.
- **Native resources:** for storage/startup/memory work, trace the underlying DB/MMKV/file/WebView owner separately. JS runtime separation alone does not establish whether a native resource is shared or per runtime.

## Identity and lifetime

Choose identity dimensions from the data contract. Account positions and orders require account/address scope; public market data uses instrument/dex and aggregation options where relevant. A single account/dex/asset key recipe is not appropriate for every cache.

Distinguish durable preferences, scoped recovery snapshots, current live data and temporary UI state. The repo already has intentional recovery caches; preserve their validity and interaction gates when changing persistence.

If navigation changes a BG active asset but the mounted UI stays on the previous instrument, inspect `PerpsGlobalEffects` and `switchTradeInstrument` event/action paths. Updating one owner does not necessarily complete the UI transition on every entry route.
