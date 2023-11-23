import {
  atom,
  createJotaiContext,
} from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import simpleDb from '@onekeyhq/kit-bg/src/dbs/simple/simpleDb';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { webviewRefs } from '../utils/explorerUtils';

import type { IWebTab, IWebTabsAtom } from '../types';

const { serviceDiscovery } = backgroundApiProxy;
const BLANK_PAGE_URL = 'about:blank';
export const homeTab: IWebTab = {
  id: 'home',
  // current url in webview
  url: BLANK_PAGE_URL,
  title: 'OneKey',
  canGoBack: false,
  loading: false,
  favicon: '',
};

export const homeResettingFlags: Record<string, number> = {};

const {
  withProvider: withProviderWebTabs,
  useContextAtom: useAtomWebTabs,
  store: webTabsStore,
} = createJotaiContext({ isSingletonStore: true });

export const displayHomePageAtom = atom(true);
export const setDisplayHomePageAtom = atom(
  null,
  (get, set, payload: boolean) => {
    const v = get(displayHomePageAtom);
    console.log('v => : ', v);
    set(displayHomePageAtom, payload);
  },
);

export const webTabsAtom = atom<IWebTabsAtom>({ tabs: [], keys: [] });
export const webTabsMapAtom = atom<Record<string, IWebTab>>({});

export const activeTabIdAtom = atom<string | null>(null);

export const setWebTabsAtom = atom(
  null,
  async (
    get,
    set,
    payload: { data: IWebTab[]; options?: { forceUpdate?: boolean } },
  ) => {
    const webTabs = get(webTabsAtom);
    const { keys, data, map, shouldUpdateTabs } =
      await serviceDiscovery.setWebTabs(webTabs, payload);
    if (shouldUpdateTabs) {
      set(webTabsAtom, { keys, tabs: data });
    }

    set(webTabsMapAtom, () => map);
    void simpleDb.browserTabs.setRawData({
      tabs: data,
    });
  },
);

export const refreshTabsAtom = atom(null, async (get, set) => {
  const { tabs } = get(webTabsAtom);
  const newTabs = [...tabs];
  void set(setWebTabsAtom, { data: newTabs, options: { forceUpdate: true } });
});

export const setCurrentWebTabAtom = atom(null, (get, set, tabId: string) => {
  const currentTabId = get(activeTabIdAtom);
  if (currentTabId !== tabId) {
    // set isActive to true
    const { tabs } = get(webTabsAtom);
    const targetIndex = tabs.findIndex((t) => t.id === tabId);
    tabs.forEach((t) => {
      t.isActive = false;
    });
    void set(setWebTabsAtom, { data: [...tabs] });
    if (targetIndex !== -1) {
      tabs[targetIndex].isActive = true;
      set(activeTabIdAtom, tabId);
    } else {
      set(activeTabIdAtom, '');
    }
  }
  if (get(displayHomePageAtom)) {
    set(setDisplayHomePageAtom, false);
  }
});

export const addWebTabAtom = atom(
  null,
  (get, set, payload: Partial<IWebTab>) => {
    // 记录函数执行时间
    const startTime = performance.now();
    const { tabs } = get(webTabsAtom);
    if (!payload.id || payload.id === homeTab.id) {
      // TODO: nanoid will crash on native, replace by nanoid
      payload.id = generateUUID();
    }
    payload.timestamp = Date.now();
    set(setWebTabsAtom, { data: [...tabs, payload as IWebTab] })
      .then(() => {
        set(setCurrentWebTabAtom, payload.id ?? '');
        const endTime = performance.now();
        console.log(`addBlankWebTab took ${endTime - startTime} milliseconds.`);
      })
      .catch((e) => {
        console.log('====> addWebTabAtom error: ', e);
      });
  },
);
export const addBlankWebTabAtom = atom(null, (_, set) => {
  set(addWebTabAtom, { ...homeTab, isActive: true });
});
export const setWebTabDataAtom = atom(
  null,
  async (get, set, payload: Partial<IWebTab>) => {
    const { tabs } = get(webTabsAtom);
    const { tabs: newTabs, resetFlag } = await serviceDiscovery.setWebTabData(
      tabs,
      payload,
    );
    if (resetFlag) {
      Object.entries(resetFlag).forEach(([id, timestamp]) => {
        homeResettingFlags[id] = timestamp;
      });
    }
    void set(setWebTabsAtom, { data: newTabs });
  },
);
export const closeWebTabAtom = atom(null, async (get, set, tabId: string) => {
  delete webviewRefs[tabId];
  const { tabs } = get(webTabsAtom);
  const activeTabId = get(activeTabIdAtom);
  const { tabs: newTabs, newActiveTabId } = await serviceDiscovery.closeWebTab(
    tabs,
    activeTabId,
    tabId,
  );
  if (newActiveTabId) {
    set(setCurrentWebTabAtom, newActiveTabId);
  }
  void set(setWebTabsAtom, { data: [...newTabs] });
});

export const closeAllWebTabsAtom = atom(null, async (get, set) => {
  const { tabs } = get(webTabsAtom);
  const activeTabId = get(activeTabIdAtom);
  const { pinnedTabs, newActiveTabId } =
    await serviceDiscovery.closeAllWebTabsAtom(tabs, activeTabId);
  for (const id of Object.getOwnPropertyNames(webviewRefs)) {
    if (!pinnedTabs.find((tab) => tab.id === id)) {
      delete webviewRefs[id];
    }
  }
  if (newActiveTabId) {
    set(setCurrentWebTabAtom, newActiveTabId);
  }
  void set(setWebTabsAtom, { data: pinnedTabs });
});

export const setPinnedTabAtom = atom(
  null,
  async (_, set, payload: { id: string; pinned: boolean }) => {
    void set(setWebTabDataAtom, {
      id: payload.id,
      isPinned: payload.pinned,
      timestamp: Date.now(),
    });
    void set(refreshTabsAtom);
  },
);

export const disabledAddedNewTabAtom = atom((get) => {
  const { tabs } = get(webTabsAtom);
  return tabs.length >= 20;
});

export const incomingUrlAtom = atom('');
export const getActiveTabId = () => webTabsStore?.get(activeTabIdAtom);
export const getTabs = () => webTabsStore?.get(webTabsAtom);
export const getTabsMap = () => webTabsStore?.get(webTabsMapAtom);
export const addWebTab = (payload: Partial<IWebTab>) =>
  webTabsStore?.set(addWebTabAtom, payload);
export const addBlankWebTab = () => webTabsStore?.set(addBlankWebTabAtom);
export const closeWebTab = (tabId: string) =>
  webTabsStore?.set(closeWebTabAtom, tabId);
export const setWebTabData = (payload: Partial<IWebTab>) =>
  webTabsStore?.set(setWebTabDataAtom, payload);

export const syncBookmark = (url: string, isBookmark: boolean) => {
  const tabMap = getTabsMap();
  if (!tabMap) return;
  Object.entries(tabMap).forEach(([, value]) => {
    if (value.url === url) {
      void setWebTabData({ id: value.id, isBookmark });
    }
  });
};

export { useAtomWebTabs, withProviderWebTabs };
