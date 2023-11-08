import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { simpleDb } from '../components/WebView/mock';

import type { IWebTab } from '../types';

export function useTabDataFromSimpleDb() {
  const result = usePromiseResult(async () => {
    const r = await simpleDb.discoverWebTabs.getRawData();
    return (r?.tabs as IWebTab[]) || [];
  }, []);

  return result;
}
