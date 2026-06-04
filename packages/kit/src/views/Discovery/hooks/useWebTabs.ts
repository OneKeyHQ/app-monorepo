import { useMemo } from 'react';

import {
  useActiveTabIdAtom,
  useAliveWebViewIdsAtom,
  useDisabledAddedNewTabAtom,
  useDisplayHomePageAtom,
  useWebTabsAtom,
  useWebTabsMapAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

import type { IWebTab } from '../types';

export const useWebTabs = () => {
  const [webTabs] = useWebTabsAtom();
  return useMemo(
    () => ({
      tabs: webTabs.tabs,
    }),
    [webTabs],
  );
};

export const useWebTabDataById = (id?: string) => {
  const [map] = useWebTabsMapAtom();
  return useMemo(
    () => ({
      tab: map[id ?? ''] as IWebTab | undefined,
    }),
    [map, id],
  );
};

export const useActiveTabId = () => {
  const [activeTabId] = useActiveTabIdAtom();
  return useMemo(
    () => ({
      activeTabId,
    }),
    [activeTabId],
  );
};

/**
 * Whether the given tab should keep its WebView mounted. Tabs outside the
 * keep-alive LRU window return false and unmount their WebView to free memory;
 * re-activating such a tab remounts and reloads it.
 */
export const useShouldKeepWebViewAlive = (id?: string) => {
  const [aliveIds] = useAliveWebViewIdsAtom();
  return useMemo(() => (id ? aliveIds.has(id) : false), [aliveIds, id]);
};

export const useDisplayHomePageFlag = () => {
  const [value] = useDisplayHomePageAtom();
  return {
    displayHomePage: value,
  };
};

export const useDisabledAddedNewTab = () => {
  const [disabledAddedNewTab] = useDisabledAddedNewTabAtom();
  return useMemo(
    () => ({
      disabledAddedNewTab,
    }),
    [disabledAddedNewTab],
  );
};
