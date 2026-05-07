# Tabs and Navigation

## Core Data Types

- `IWebTab` is the persisted model: `id`, `url`, display/title/favicon, active/pinned/loading flags, navigation flags, `timestamp`, `siteMode`, and `type`.
- `homeTab` is the blank page sentinel with id `home` and url `about:blank`.
- `type: 'home'` is a browser start tab; `type: 'normal'` is an actual site tab.
- `MaximumNumberOfTabs` applies on native through `disabledAddedNewTabAtom`.

## State Flow

- `webTabsAtom` / `webTabsMapAtom`: ordered list and id map.
- `activeTabIdAtom`: active webview tab.
- `displayHomePageAtom`: native dashboard vs browser content.
- `browserDataReadyAtom`: blocks writes until initial rebuild.

Use the exported hooks instead of direct atom writes:

- `useBrowserTabActions()`: add/close/switch/pin/site-mode/tab-data.
- `useBrowserAction()`: `gotoSite`, `handleOpenWebSite`, `onNavigation`, validation, pause/resume DApp interaction.
- `useBrowserBookmarkAction()` and `useBrowserHistoryAction()` for user data.

## Persistence Rules

- `buildWebTabs` updates list keys, map, and `simpleDb.browserTabs`.
- `setWebTabData` changes one tab, updates timestamp on URL changes, and then rebuilds.
- `HandleRebuildBrowserData` loads stored tabs and calls `setBrowserDataReady`.
- Bookmark/history actions guard on `browserDataReadyAtom`; initialization can pass `options.isInitFromStorage`.

## Opening URLs

- Use `handleOpenWebSite` for UI flows from search/dashboard/bookmark/history.
- Use `gotoSite` for lower-level tab loading after the destination and tab behavior are known.
- `gotoSite` validates through `uriUtils.validateUrl`.
- `browserTypeHandler === 'StandardBrowser'` opens externally/in-app via `openUrlInApp`; MultiTabBrowser creates or updates web tabs.
- Native must emit `SwitchDiscoveryTabInNative` when opening a browser URL from outside the browser sub-tab.
- Desktop should target `ETabRoutes.MultiTabBrowser`; native should target `ETabRoutes.Discovery`.

## Closing and Switching

- `closeWebTab` removes `webviewRefs[tabId]`, writes history for non-home URLs, activates an adjacent tab, saves last-closed tabs, and logs `closeTab`.
- `closeAllWebTabs` preserves pinned tabs and clears refs for closed tabs.
- `setCurrentWebTab` pauses the previous DApp interaction and resumes the new one.
- `reOpenLastClosedTab` restores from `lastClosedTabAtom`.

## Ordering and Pinning

- Tab order is timestamp-based.
- Desktop "new tab position top" freezes tab order on navigation; navigation time is tracked separately in `lastNavigationFlags`.
- When placing a tab above another tab, keep a timestamp gap large enough to avoid drag-reorder midpoint collisions.
- `setPinnedTab` updates timestamp, rebuilds, and logs pin/unpin analytics.

## Navigation Edge Cases

- `onNavigation` rejects phishing/unsupported redirects through `parseDappRedirect`.
- Valid deep links are passed to `handleDeepLinkUrl` instead of being loaded in the webview.
- Fast URL changes inside 500ms are debounced to avoid redirect loops.
- Resetting to `about:blank` has a short guard window through `homeResettingFlags`.
