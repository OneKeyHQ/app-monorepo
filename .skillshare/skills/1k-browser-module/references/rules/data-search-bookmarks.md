# Data, Search, Bookmarks, and History

## ServiceDiscovery APIs

- Homepage: `fetchDiscoveryHomePageData()` calls `/utility/v1/discover/dapp/homepage`, memoized for 30 seconds.
- DApp search: `searchDApp(keyword)` calls `/utility/v1/discover/dapp/search`.
- Categories use `/utility/v1/discover/category/list` and `/utility/v1/discover/dapp/list`.
- Icon URLs are generated through `/utility/v1/discover/icon?hostname=...&size=...`.
- URL risk checks use `/utility/v1/discover/check-host`, memoized for 5 minutes.

## Bookmark Storage

- Bookmark type: `IBrowserBookmark` in `packages/kit/src/views/Discovery/types.ts`.
- SimpleDB entity: `SimpleDbEntityBrowserBookmarks`.
- `ServiceDiscovery.setBrowserBookmarks` fills sort indexes, sync items unless skipped, SimpleDB writes, `RefreshBookmarkList`, and rename history.
- UI actions should use `useBrowserBookmarkAction`, which syncs `isBookmark` into open tabs and logs add/remove.
- Bookmark sorting should use `sortUtils.buildNewSortIndex`; do not hand-roll numeric ordering.

## History Storage

- History type: `IBrowserHistory`.
- SimpleDB entity: `SimpleDbEntityBrowserHistory`.
- Closing tabs adds non-home URLs to history.
- `addBrowserHistory` de-duplicates by URL and skips `data:` favicons to avoid storage bloat.
- Search/list reads can request generated icons and local Fuse matches.

## Search Modal

- Main hook: `packages/kit/src/views/Discovery/hooks/useSearchModalData.ts`.
- Ranking utilities: `packages/kit/src/views/Discovery/utils/searchResultRanking.ts`.
- Search combines local bookmarks/history, trending data, and remote DApp search.
- Keep candidate limits high enough for local re-ranking before slicing.
- Short queries can skip remote search while still showing local/trending matches.
- Preserve match metadata (`titleMatch`, `urlMatch`) for highlighted search results.

## Dashboard Data

- Dashboard UI lives in `pages/Dashboard/`.
- DApp/domain cards should pass through `handleOpenWebSite` so platform tab switching, URL processing, tab limits, and analytics stay consistent.
- `processWebSiteUrl` contains targeted partner URL adjustments; add new cases there only when product behavior requires it.

## Risk and Whitelist

- Risk whitelist persistence lives in `SimpleDbEntityBrowserRiskWhiteList`.
- `ServiceDiscovery.addBrowserUrlToRiskWhiteList` updates SimpleDB and invalidates the memoized whitelist lookup.
- Browser runtime cache for allowed phishing URLs lives in `phishingLruCacheAtom`; desktop also syncs to `desktopApiProxy.webview.setAllowedPhishingUrls`.

## Cloud Sync and Change History

- Bookmarks participate in Prime cloud sync through `servicePrimeCloudSync.syncManagers.browserBookmark`.
- If writing bookmark data from sync replay or migration, use `skipSaveLocalSyncItem` or `skipEventEmit` deliberately.
- Bookmark title changes should continue recording `EChangeHistoryEntityType.BrowserBookmark`.
