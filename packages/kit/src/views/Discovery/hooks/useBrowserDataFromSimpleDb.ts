import simpleDb from '@onekeyhq/kit-bg/src/dbs/simple/simpleDb';

import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { IWebTab } from '../types';

export function useBrowserTabDataFromSimpleDb() {
  const result = usePromiseResult(async () => {
    const data = await simpleDb.browserTabs.getRawData();
    return (data?.tabs as IWebTab[]) || [];
  }, []);

  return result;
}
