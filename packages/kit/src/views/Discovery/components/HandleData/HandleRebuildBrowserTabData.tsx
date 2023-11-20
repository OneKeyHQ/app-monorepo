import { useEffect } from 'react';

import { useBrowserTabDataFromSimpleDb } from '../../hooks/useBrowserDataFromSimpleDb';
import useWebTabAction from '../../hooks/useWebTabAction';

export function HandleRebuildTabData() {
  const result = useBrowserTabDataFromSimpleDb();
  const { setWebTabs, addBlankWebTab } = useWebTabAction();

  useEffect(() => {
    if (!result.result) return;
    const data = result.result;
    if (data && Array.isArray(data) && data.length > 0) {
      void setWebTabs({ data });
    }
  }, [result.result, addBlankWebTab, setWebTabs]);

  return null;
}
