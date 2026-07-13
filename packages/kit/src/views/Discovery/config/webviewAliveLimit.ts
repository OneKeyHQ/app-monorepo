// Maximum number of DApp WebViews kept alive (mounted) at once.
//
// We cap live WebView instances with a recency LRU so memory stays bounded
// regardless of how many tabs are open. Tabs beyond this limit are unmounted by
// least-recently-active; re-activating an evicted tab remounts and reloads it
// (the DApp connection restores by origin, so there is no re-approval prompt).
//
// Desktop/web/extension have large memory budgets, so we keep more alive.
// Native (.native.ts) tiers the limit by device RAM.
export const MAX_ALIVE_WEBVIEW_COUNT = 8;
