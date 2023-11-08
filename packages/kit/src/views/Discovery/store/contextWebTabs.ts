import { isEqual } from 'lodash';

import {
  atom,
  createJotaiContext,
} from '@onekeyhq/kit/src/store/jotai/createJotaiContext';
import { simpleDb } from '@onekeyhq/kit/src/views/Discovery/components/WebView/mock';

import { webviewRefs } from '../utils/explorerUtils';

import type { IWebTab } from '../types';

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

function buildWebTabData(tabs: IWebTab[]) {
  const map: Record<string, IWebTab> = {};
  const keys: string[] = [];
  tabs.forEach((tab) => {
    keys.push(tab.id);
    map[tab.id] = tab;
  });
  return {
    data: tabs,
    keys,
    map,
  };
}

const {
  withProvider: withProviderWebTabs,
  useContextAtom: useAtomWebTabs,
  store: webTabsStore,
} = createJotaiContext({ isSingletonStore: true });

interface IWebTabsAtom {
  tabs: IWebTab[];
  keys: string[];
}

export const activeTabIdAtom = atom<string | null>(null);
export const webTabsAtom = atom<IWebTabsAtom>({ tabs: [], keys: [] });
export const webTabsMapAtom = atom<Record<string, IWebTab>>({});
export const setWebTabsAtom = atom(null, (get, set, payload: IWebTab[]) => {
  let newTabs = payload;
  if (!Array.isArray(payload)) {
    throw new Error('setWebTabsWriteAtom: payload must be an array');
  }
  if (!newTabs || !newTabs.length) {
    newTabs = [];
  }
  const result = buildWebTabData(newTabs);
  if (!isEqual(result.keys, get(webTabsAtom).keys)) {
    console.log(
      'setWebTabsAtom: payload: ',
      payload,
      ' keys: ',
      result.keys,
      ' data: ',
      result.data,
    );
    set(webTabsAtom, { keys: result.keys, tabs: result.data });
  }

  set(webTabsMapAtom, () => result.map);
  simpleDb.discoverWebTabs.setRawData({
    tabs: newTabs,
  });
});
export const addWebTabAtom = atom(
  null,
  (get, set, payload: Partial<IWebTab>) => {
    const { tabs } = get(webTabsAtom);
    if (!payload.id || payload.id === homeTab.id) {
      // TODO: nanoid will crash on native
      // payload.id = nanoid();
      // tabs.length + random(10 - 100)
      payload.id = `${
        tabs.length + Math.floor(Math.random() * (100 - 10 + 1)) + 10
      }`;
    }
    payload.timestamp = Date.now();
    set(setWebTabsAtom, [...tabs, payload as IWebTab]);
    set(activeTabIdAtom, payload.id);
  },
);
export const addBlankWebTabAtom = atom(null, (_, set) => {
  set(addWebTabAtom, { ...homeTab });
});
export const setWebTabDataAtom = atom(
  null,
  (get, set, payload: Partial<IWebTab>) => {
    const { tabs } = get(webTabsAtom);
    const tabIndex = tabs.findIndex((t) => t.id === payload.id);
    if (tabIndex > -1) {
      const tabToModify = tabs[tabIndex];
      Object.keys(payload).forEach((k) => {
        const key = k as keyof IWebTab;
        const value = payload[key];
        if (value !== undefined && value !== tabToModify[key]) {
          if (key === 'title') {
            if (!value) {
              return;
            }
          }
          // @ts-expect-error
          tabToModify[key] = value;
          if (key === 'url') {
            tabToModify.timestamp = Date.now();
            if (value === homeTab.url && payload.id) {
              homeResettingFlags[payload.id] = tabToModify.timestamp;
            }
            if (!payload.favicon) {
              try {
                tabToModify.favicon = `${
                  new URL(tabToModify.url ?? '').origin
                }/favicon.ico`;
              } catch {
                // ignore
              }
            }
          }
        }
      });
      tabs[tabIndex] = tabToModify;
      set(setWebTabsAtom, tabs);
    }
  },
);
export const closeWebTabAtom = atom(null, (get, set, tabId: string) => {
  delete webviewRefs[tabId];
  const { tabs } = get(webTabsAtom);
  const targetIndex = tabs.findIndex((t) => t.id === tabId);
  if (targetIndex !== -1) {
    if (tabs[targetIndex].id === get(activeTabIdAtom)) {
      const prev = tabs[targetIndex - 1];
      set(activeTabIdAtom, prev ? prev.id : null);
    }
    tabs.splice(targetIndex, 1);
    set(setWebTabsAtom, [...tabs]);
  }
});
export const closeAllWebTabsAtom = atom(null, (_, set) => {
  for (const id of Object.getOwnPropertyNames(webviewRefs)) {
    delete webviewRefs[id];
  }
  set(setWebTabsAtom, []);
  set(activeTabIdAtom, null);
});
export const setCurrentWebTabAtom = atom(null, (get, set, tabId: string) => {
  const currentTabId = get(activeTabIdAtom);
  if (currentTabId !== tabId) {
    set(activeTabIdAtom, tabId);
  }
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

export { useAtomWebTabs, withProviderWebTabs };
