import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Maximum number of DApp WebViews kept alive (mounted) at once.
//
// We cap live WebView instances with a recency LRU so memory stays bounded
// regardless of how many tabs are open. Tabs beyond this limit are unmounted by
// least-recently-active; re-activating an evicted tab remounts and reloads it
// (the DApp connection restores by origin, so there is no re-approval prompt).
//
// Desktop/web/extension have large memory budgets, so we keep more alive.
// Native (.native.ts) tiers the limit by device RAM.
//
// Desktop gets a higher cap than web/extension. Before eviction actually
// worked (it could not commit through a frozen react-freeze boundary), the
// organic working set of heavy multi-tab desktop sessions measured 10-17 live
// WebViews — a cap of 8 turns everyday tab switching into constant reloads
// for those users. 16 covers the observed working set while keeping guest
// renderers bounded (~200-330MB each); the window renderer's React tree cost
// stays bounded by the now-real unmount path.
export const MAX_ALIVE_WEBVIEW_COUNT = platformEnv.isDesktop ? 16 : 8;
