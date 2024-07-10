import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useBrowserBookmarkAction,
  useBrowserHistoryAction,
  useBrowserTabActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

function HandleRebuildTabData() {
  const { buildWebTabs, setTabsDataReady } = useBrowserTabActions().current;

  usePromiseResult(async () => {
    const data = await backgroundApiProxy.simpleDb.browserTabs.getRawData();
    const tabs = data?.tabs ?? [];
    defaultLogger.discovery.browser.setTabsDataFunctionName(
      'setTabsInitializeLock-> true',
    );
    setTabsDataReady(true);
    buildWebTabs({ data: tabs });
  }, [buildWebTabs, setTabsDataReady]);

  return null;
}

function HandleRebuildBookmarksData() {
  const { buildBookmarkData, setBookmarksDataReady } =
    useBrowserBookmarkAction().current;

  usePromiseResult(async () => {
    const data =
      await backgroundApiProxy.simpleDb.browserBookmarks.getRawData();
    const bookmarks = data?.data || [];
    setBookmarksDataReady(true);
    if (bookmarks && Array.isArray(bookmarks) && bookmarks.length > 0) {
      buildBookmarkData(bookmarks);
    }
  }, [buildBookmarkData, setBookmarksDataReady]);

  return null;
}

function HandleRebuildHistoryData() {
  const { buildHistoryData, setHistoryDataReady } =
    useBrowserHistoryAction().current;

  usePromiseResult(async () => {
    const data = await backgroundApiProxy.simpleDb.browserHistory.getRawData();
    const histories = data?.data || [];
    setHistoryDataReady(true);
    if (histories && Array.isArray(histories) && histories.length > 0) {
      buildHistoryData(histories);
    }
  }, [buildHistoryData, setHistoryDataReady]);

  return null;
}

export function HandleRebuildBrowserData() {
  return (
    <>
      <HandleRebuildTabData />
      <HandleRebuildBookmarksData />
      <HandleRebuildHistoryData />
    </>
  );
}
