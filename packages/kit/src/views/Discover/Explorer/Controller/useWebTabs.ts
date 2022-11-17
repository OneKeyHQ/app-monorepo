import { useMemo } from 'react';

import { useAppSelector } from '../../../../hooks';
import { appSelector } from '../../../../store';

export const useWebTabs = (id?: string) => {
  const { tabs, currentTabId } = useAppSelector((s) => s.webTabs);
  const curId = id || currentTabId;
  return useMemo(
    () => ({
      tabs,
      tab: tabs.find((tab) => tab.id === curId),
      currentTabId,
    }),
    [curId, currentTabId, tabs],
  );
};

// not a hook, won't refresh
export const getWebTabs = (id?: string) => {
  const { tabs, currentTabId } = appSelector((s) => s.webTabs);
  const curId = id || currentTabId;
  return {
    tabs,
    tab: tabs.find((tab) => tab.id === curId),
    currentTabId,
  };
};
