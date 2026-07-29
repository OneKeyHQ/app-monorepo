import { useMemo } from 'react';

import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';

import {
  useActiveTabIdAtom,
  useAliveWebViewIdsAtom,
  useDisabledAddedNewTabAtom,
  useDiscoveryContextStoreData,
  useDisplayHomePageAtom,
  useWebTabsAtom,
  webTabsAtom,
  webTabsMapAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

import type { IWebTab, IWebTabsAtom } from '../types';

// Fresh snapshot of the full tab array. Always tracks the atom, so consumers
// that read fields off the array (isPinned grouping in the tab bars, the
// pinned-tab guard in useShortcuts.desktop, MobileTabListModal) can never see
// stale values. Shell containers that only need to key child components by id
// should use useWebTabIds instead, which stays referentially stable across
// field-only writes.
export const useWebTabs = () => {
  const [webTabs] = useWebTabsAtom();
  return useMemo(
    () => ({
      tabs: webTabs.tabs,
    }),
    [webTabs],
  );
};

// Module-level select/equality so the derived atom is created once (the same
// discipline as useTokenFiatField). Emits a new value only when the id list
// (set or order) changes — field-only writes keep the previous array identity,
// so shell containers mapping ids to memoized children skip re-rendering.
const selectWebTabIds = (value: IWebTabsAtom) => value.tabs.map((t) => t.id);
const areIdListsEqual = (a: string[], b: string[]) =>
  a === b || (a.length === b.length && a.every((id, i) => id === b[i]));
const webTabIdsAtom = selectAtom(
  webTabsAtom(),
  selectWebTabIds,
  areIdListsEqual,
);

export const useWebTabIds = () => {
  const { store } = useDiscoveryContextStoreData();
  const ids = useAtomValue(webTabIdsAtom, { store });
  return useMemo(() => ({ ids }), [ids]);
};

// Per-tab subscription. Subscribing to the whole map atom meant every tab
// shell and navigation bar re-rendered on every map replacement no matter
// whose tab changed — memoizing the returned object cannot stop a re-render
// that the component's own atom subscription triggers. selectAtom narrows the
// subscription to this tab's entry: buildWebTabData reuses untouched tab
// objects (setWebTabData is copy-on-write for the changed one only), so the
// Object.is equality holds and only the changed tab's subscribers run.
export const useWebTabDataById = (id?: string) => {
  const { store } = useDiscoveryContextStoreData();
  const tabAtom = useMemo(
    () =>
      selectAtom(
        webTabsMapAtom(),
        (map) => map[id ?? ''] as IWebTab | undefined,
      ),
    [id],
  );
  const tab = useAtomValue(tabAtom, { store });
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
