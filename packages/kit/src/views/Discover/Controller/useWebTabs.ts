import { useMemo } from 'react';

import {
  atomWebTabs,
  getCurrentTabId,
  useAtomWebTabs,
  webTabsStore,
} from '../Explorer/Context/contextWebTabs';

export const useWebTabs = (id?: string) => {
  const [webTabs] = useAtomWebTabs(atomWebTabs);
  const { tabs } = webTabs;
  const currentTabId = getCurrentTabId();
  const curId = id || currentTabId;
  return useMemo(
    () => ({
      tabs,
      tab: tabs.find((tab) => tab?.id === curId) ?? tabs[0],
      currentTabId,
    }),
    [curId, currentTabId, tabs],
  );
};

// not a hook, won't refresh
export const getWebTabs = (id?: string) => {
  const { tabs } = webTabsStore.get(atomWebTabs);
  const currentTabId = getCurrentTabId();
  const curId = id || currentTabId;
  return {
    tabs,
    tab: tabs.find((tab) => tab?.id === curId) ?? tabs[0],
    currentTabId,
  };
};
