import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import simpleDb from '@onekeyhq/kit-bg/src/dbs/simple/simpleDb';

import type { IBrowserBookmark, IBrowserHistory, IWebTab } from '../types';

export function useBrowserTabDataFromSimpleDb() {
  const result = usePromiseResult(async () => {
    const data = await simpleDb.browserTabs.getRawData();
    return (data?.tabs as IWebTab[]) || [];
  }, []);

  return result;
}

export function useBrowserBookmarksDataFromSimpleDb() {
  const result = usePromiseResult(async () => {
    const data = await simpleDb.browserBookmarks.getRawData();
    return (data?.data as IBrowserBookmark[]) || [];
  }, []);

  return result;
}

export function useBrowserHistoryDataFromSimpleDb() {
  const result = usePromiseResult(async () => {
    const data = await simpleDb.browserHistory.getRawData();
    return (data?.data as IBrowserHistory[]) || [];
  }, []);

  return result;
}
