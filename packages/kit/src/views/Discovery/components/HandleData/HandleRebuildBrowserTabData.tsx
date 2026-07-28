import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  // useBrowserBookmarkAction,
  // useBrowserHistoryAction,
  useBrowserDataReadyAtom,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

export function HandleRebuildBrowserData() {
  const [browserDataReady] = useBrowserDataReadyAtom();
  // const { buildBookmarkData } = useBrowserBookmarkAction().current;
  // const { buildHistoryData } = useBrowserHistoryAction().current;
  const { buildWebTabs, isBrowserDataReady, setBrowserDataReady } =
    useBrowserTabActions().current;

  usePromiseResult(async () => {
    if (browserDataReady) {
      return;
    }
    // Tabs
    const [tabsData] = await Promise.all([
      backgroundApiProxy.simpleDb.browserTabs.getRawData(),
      // backgroundApiProxy.simpleDb.browserBookmarks.getRawData(),
      // backgroundApiProxy.simpleDb.browserHistory.getRawData(),
      // backgroundApiProxy.simpleDb.browserClosedTabs.getRawData(),
    ]);
    if (isBrowserDataReady()) {
      return;
    }
    const tabs = tabsData?.tabs ?? [];
    defaultLogger.discovery.browser.setTabsDataFunctionName(
      'setTabsInitializeLock-> true',
    );
    buildWebTabs({
      data: tabs,
      options: { isInitFromStorage: true, persist: false },
    });

    // // Bookmarks
    // const bookmarks = bookmarksData?.data || [];
    // if (bookmarks && Array.isArray(bookmarks) && bookmarks.length > 0) {
    //   buildBookmarkData({
    //     data: bookmarks,
    //     options: { isInitFromStorage: true },
    //   });
    // }

    // History
    // const histories = historyData?.data || [];
    // if (histories && Array.isArray(histories) && histories.length > 0) {
    //   buildHistoryData({
    //     data: histories,
    //     options: { isInitFromStorage: true },
    //   });
    // }

    setBrowserDataReady();
    // // closed Tabs
    // const closedTabs = closedTabData?.tabs || [];
    // if (closedTabs && Array.isArray(closedTabs) && histories.length > 0) {
    //   buildHistoryData({
    //     data: histories,
    //     options: { isInitFromStorage: true },
    //   });
    // }
  }, [browserDataReady, buildWebTabs, isBrowserDataReady, setBrowserDataReady]);

  return null;
}
