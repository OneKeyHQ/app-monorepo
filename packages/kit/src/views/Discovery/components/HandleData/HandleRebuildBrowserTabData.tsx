import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  // useBrowserBookmarkAction,
  // useBrowserHistoryAction,
  useBrowserTabActions,
  useDiscoveryContextData,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { getJotaiContextStoreDebugId } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

function getLogErrorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

export function HandleRebuildBrowserData() {
  const { buildWebTabs, setBrowserDataReady } = useBrowserTabActions().current;
  const { store } = useDiscoveryContextData();
  const storeIdentity = getJotaiContextStoreDebugId(store);
  // const { buildBookmarkData } = useBrowserBookmarkAction().current;
  // const { buildHistoryData } = useBrowserHistoryAction().current;

  usePromiseResult(async () => {
    defaultLogger.discovery.browser.browserTabsLifecycle({
      step: 'rebuildBrowserDataStart',
      source: 'HandleRebuildBrowserData',
      storeIdentity,
    });
    try {
      // Tabs
      const [tabsData] = await Promise.all([
        backgroundApiProxy.simpleDb.browserTabs.getRawData(),
        // backgroundApiProxy.simpleDb.browserBookmarks.getRawData(),
        // backgroundApiProxy.simpleDb.browserHistory.getRawData(),
        // backgroundApiProxy.simpleDb.browserClosedTabs.getRawData(),
      ]);
      const tabs = tabsData?.tabs ?? [];
      defaultLogger.discovery.browser.browserTabsLifecycle({
        step: 'rebuildBrowserDataReadSuccess',
        source: 'HandleRebuildBrowserData',
        storeIdentity,
        tabsCount: tabs.length,
      });
      defaultLogger.discovery.browser.setTabsDataFunctionName(
        'setTabsInitializeLock-> true',
      );
      defaultLogger.discovery.browser.browserTabsLifecycle({
        step: 'rebuildBrowserDataApply',
        source: 'HandleRebuildBrowserData',
        storeIdentity,
        tabsCount: tabs.length,
        isInitFromStorage: true,
      });
      buildWebTabs({ data: tabs, options: { isInitFromStorage: true } });

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
      defaultLogger.discovery.browser.browserTabsLifecycle({
        step: 'rebuildBrowserDataReady',
        source: 'HandleRebuildBrowserData',
        storeIdentity,
        tabsCount: tabs.length,
      });

      // // closed Tabs
      // const closedTabs = closedTabData?.tabs || [];
      // if (closedTabs && Array.isArray(closedTabs) && histories.length > 0) {
      //   buildHistoryData({
      //     data: histories,
      //     options: { isInitFromStorage: true },
      //   });
      // }
    } catch (error) {
      defaultLogger.discovery.browser.browserTabsLifecycle({
        step: 'rebuildBrowserDataReadError',
        source: 'HandleRebuildBrowserData',
        storeIdentity,
        result: 'error',
        errorName: getLogErrorName(error),
      });
      throw error;
    }
  }, [buildWebTabs, setBrowserDataReady, storeIdentity]);

  return null;
}
