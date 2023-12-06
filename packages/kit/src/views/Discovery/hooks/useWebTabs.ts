import { useMemo } from 'react';

import {
  useActiveTabIdAtom,
  useDisabledAddedNewTabAtom,
  useDisplayHomePageAtom,
  useWebTabsAtom,
  useWebTabsMapAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

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
      tab: map[id ?? ''],
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
