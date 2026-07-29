import { useMemo, useRef } from 'react';

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
  // Key on the id list, not on the atom value. webTabsAtom is now written on
  // any tab field change (title/loading/favicon) so later reads cannot go
  // stale; keying on the whole value would hand every consumer a fresh `tabs`
  // array on each of those writes. Consumers here only iterate ids to render
  // per-tab shells — they read fields through useWebTabDataById — so the array
  // only needs a new identity when the set or order of tabs changes.
  const idsKey = webTabs.tabs.map((t) => t.id).join(',');
  const cache = useRef({ idsKey, tabs: webTabs.tabs });
  if (cache.current.idsKey !== idsKey) {
    cache.current = { idsKey, tabs: webTabs.tabs };
  }
  const { tabs } = cache.current;
  return useMemo(() => ({ tabs }), [tabs]);
};

export const useWebTabDataById = (id?: string) => {
  const [map] = useWebTabsMapAtom();
  const tab = map[id ?? ''] as IWebTab | undefined;
  // Memoize on the tab, not on the map. buildWebTabs hands out a new map
  // object whenever any tab changes, so keying the result on `map` produced a
  // fresh `{ tab }` for every mounted tab shell on every write — with 26 open
  // tabs one title change re-rendered all 26 subtrees. Tabs whose own entry is
  // untouched now keep a stable reference and their children bail out.
  return useMemo(() => ({ tab }), [tab]);
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
