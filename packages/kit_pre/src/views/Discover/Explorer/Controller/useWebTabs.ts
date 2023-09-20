import { useMemo } from 'react';

import { useSelector } from '@legendapp/state/react';

import {
  getCurrentTabId,
  webTabsObs,
} from '../../../../store/observable/webTabs';

import type { WebTab } from '../../../../store/observable/webTabs';

export const useWebTabs = (id?: string) => {
  const tabs = useSelector(webTabsObs) as WebTab[];
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
  const tabs = webTabsObs.peek();
  const currentTabId = getCurrentTabId();
  const curId = id || currentTabId;
  return {
    tabs,
    tab: tabs.find((tab) => tab.id === curId),
    currentTabId,
  };
};
