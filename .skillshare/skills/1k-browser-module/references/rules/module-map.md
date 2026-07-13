# Browser Module Map

## Enabled Surfaces

- Mobile app: `Browser.native.tsx` hosts Market, Earn, dashboard, and browser webviews inside Discovery.
- Desktop app: `Browser.desktop.tsx` is the MultiTabBrowser tab with desktop header, find-in-page, and per-tab webviews.
- The browser module is only product-enabled on mobile and desktop.

## Fallback/Shared Paths

- `Browser.ext.tsx` and unsuffixed `Browser.tsx` are fallback/shared, not enabled WebView browser surfaces.
- Non-native/non-desktop uses `StandardBrowser`, opening URLs via `openUrlInApp`.

## Route Entry Points

- Native Discovery tab route: `packages/kit/src/routes/Tab/Discovery/router.ts`
  - Native uses `Browser`; desktop/web use `DashboardContainer`.
  - Native embeds Market detail routes under Discovery.
- Desktop browser tab route: `packages/kit/src/routes/Tab/MultiTabBrowser/router.ts`
  - Loads the same browser page as `MultiTabBrowser`.
- Tab router registers `MultiTabBrowser` as extra config; product navigation targets it only on desktop.
- Discovery modal routes: `packages/kit/src/views/Discovery/router/index.tsx`
  - Search modal, mobile tab list, bookmark list, history list.
- Shared route types: `packages/shared/src/routes/discovery.ts`, `tabDiscovery.ts`, `tabMultiTabBrowser.ts`.

## State and Provider Boundaries

- Root provider: `DiscoveryBrowserRootProvider` creates the `discoveryBrowser` Jotai context store.
- Mirror provider: `DiscoveryBrowserProviderMirror` reuses the root store in modals/pages that need browser actions.
- HOC: `withBrowserProvider` wraps browser pages/modals and also runs pending URL + desktop memory-pressure handlers.
- Actions/atoms live in `packages/kit/src/states/jotai/contexts/discovery/`.

## Service Boundaries

- `ServiceDiscovery` owns discovery APIs, URL risk checks, bookmarks/history, risk whitelist, and cache clearing.
- `ServiceDApp` owns DApp sessions, request modals, provider notifications, WalletConnect/injected updates, and disconnects.
- SimpleDB browser persistence lives under `packages/kit-bg/src/dbs/simple/entity/SimpleDbEntityBrowser*.ts`.

## UI Areas

- Shell/dashboard: `pages/Browser/`, `pages/Dashboard/`
- Toolbars/bottom bar/WebView/modals: `components/Header*`, `components/MobileBrowser/`, `components/WebContent/`, `pages/*Modal/`

## When Adding Features

- Prefer adding UI to the platform-specific shell if behavior differs by platform.
- Prefer shared hooks/actions when behavior is identical across native and desktop.
- Keep service logic in `kit-bg`; do not import `kit` UI or `components` into `kit-bg`.
- Use shared types in `packages/shared/types/discovery.ts` or `packages/shared/types/dappConnection.ts` when both UI and services need a contract.
