import { useMemo } from 'react';

import {
  atomWebTabs,
  atomWebTabsMap,
  getCurrentTabId,
  useAtomWebTabs,
  webTabsStore,
} from '../Explorer/Context/contextWebTabs';

export const useWebTabs = (id?: string) => {
  const [webTabs] = useAtomWebTabs(atomWebTabs);
  const [map] = useAtomWebTabs(atomWebTabsMap);
  const { tabs } = webTabs;
  const currentTabId = getCurrentTabId();
  const curId = id || currentTabId;
  return useMemo(
    () => ({
      tabs,
      tab: map[curId || ''] ?? tabs[0],
      currentTabId,
    }),
    [curId, currentTabId, tabs, map],
  );
};

// not a hook, won't refresh
export const getWebTabs = (id?: string) => {
  const { tabs } = webTabsStore.get(atomWebTabs);
  const map = webTabsStore.get(atomWebTabsMap);
  const currentTabId = getCurrentTabId();
  const curId = id || currentTabId;
  return {
    tabs,
    tab: map[curId || ''] ?? tabs[0],
    currentTabId,
  };
};
