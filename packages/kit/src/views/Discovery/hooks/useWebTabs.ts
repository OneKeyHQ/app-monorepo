import { useMemo } from 'react';

import {
  activeTabIdAtom,
  displayHomePageAtom,
  getActiveTabId,
  getTabs,
  getTabsMap,
  useAtomWebTabs,
  webTabsAtom,
  webTabsMapAtom,
} from '../store/contextWebTabs';

export const useWebTabs = () => {
  const [webTabs] = useAtomWebTabs(webTabsAtom);
  return useMemo(
    () => ({
      tabs: webTabs.tabs,
    }),
    [webTabs],
  );
};

export const useWebTabData = (id?: string) => {
  const [map] = useAtomWebTabs(webTabsMapAtom);
  return useMemo(
    () => ({
      tab: map[id ?? ''],
    }),
    [map, id],
  );
};

export const useActiveTabId = () => {
  const [activeTabId] = useAtomWebTabs(activeTabIdAtom as any);
  return useMemo(
    () => ({
      activeTabId: activeTabId as string | null,
    }),
    [activeTabId],
  );
};

export const useDisplayHomePageFlag = () => {
  const [value] = useAtomWebTabs(displayHomePageAtom);
  return {
    displayHomePage: value,
  };
};

// not a hook, won't refresh
export const getWebTabs = (id?: string) => {
  const webTabs = getTabs();
  const map = getTabsMap();
  const activeTabId = getActiveTabId();
  const curId = id || activeTabId;
  return {
    tabs: webTabs?.tabs ?? [],
    tab: map?.[curId || ''],
    activeTabId,
  };
};
