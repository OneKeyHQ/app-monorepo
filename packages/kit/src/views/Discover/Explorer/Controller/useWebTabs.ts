import { useMemo } from 'react';

import { useAppSelector } from '../../../../hooks';

export const useWebTabs = () => useAppSelector((s) => s.webTabs.tabs);

export const useCurrentTabId = () =>
  useAppSelector((s) => s.webTabs.currentTabId);

export const useWebTab = (id?: string) => {
  const { tabs, currentTabId } = useAppSelector((s) => s.webTabs);
  const curId = id || currentTabId;
  return useMemo(() => tabs.find((tab) => tab.id === curId), [curId, tabs]);
};
