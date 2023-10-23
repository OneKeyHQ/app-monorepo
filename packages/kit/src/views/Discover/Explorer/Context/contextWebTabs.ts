import { isEqual } from 'lodash';
import { nanoid } from 'nanoid';

import { simpleDb } from '@onekeyhq/kit/src/components/WebView/mock';
import {
  atom,
  createJotaiContext,
} from '@onekeyhq/kit/src/store/jotai/createJotaiContext';

import { webviewRefs } from '../../explorerUtils';

export interface WebTab {
  id: string;
  url: string;
  title?: string;
  favicon?: string;
  thumbnail?: string;
  isCurrent: boolean;
  isBookmarked?: boolean;
  canGoBack?: boolean;
  canGoForward?: boolean;
  loading?: boolean;
  refReady?: boolean;
  timestamp?: number;
}

export const homeTab: WebTab = {
  id: 'home',
  // current url in webview
  url: 'about:blank',
  title: 'OneKey',
  isCurrent: true,
  canGoBack: false,
  loading: false,
};

export const homeResettingFlags: Record<string, number> = {};
// eslint-disable-next-line @typescript-eslint/naming-convention
let _currentTabId = '';

export function buildWebTabData(tabs: WebTab[]) {
  const map: Record<string, WebTab> = {};
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
} = createJotaiContext();

interface IWebTabsAtom {
  tabs: WebTab[];
  keys: string[];
}

export const atomWebTabs = atom<IWebTabsAtom>({ tabs: [], keys: [] });
export const atomWebTabsMap = atom<Record<string, WebTab>>({
  [homeTab.id]: homeTab,
});
export const setWebTabsWriteAtom = atom(null, (get, set, payload: WebTab[]) => {
  let newTabs = payload;
  if (!Array.isArray(payload)) {
    throw new Error('setWebTabsWriteAtom: payload must be an array');
  }
  if (!newTabs || !newTabs.length) {
    newTabs = [{ ...homeTab }];
  }
  const result = buildWebTabData(newTabs);
  if (!isEqual(result.keys, get(atomWebTabs).keys)) {
    console.log('===>refresh new data: ', result);
    set(atomWebTabs, { keys: result.keys, tabs: result.data });
  }

  set(atomWebTabsMap, () => result.map);
  simpleDb.discoverWebTabs.setRawData({
    tabs: newTabs,
  });
});
export const addWebTabAtomWithWriteOnly = atom(
  null,
  (get, set, payload: Partial<WebTab>) => {
    const { tabs } = get(atomWebTabs);
    // TODO: Add limit for native

    if (!payload.id || payload.id === homeTab.id) {
      payload.id = nanoid();
    }

    if (payload.isCurrent) {
      for (const tab of tabs) {
        tab.isCurrent = false;
      }
      _currentTabId = payload.id;
    }
    payload.timestamp = Date.now();
    set(setWebTabsWriteAtom, [...tabs, payload as WebTab]);
  },
);
export const addBlankWebTabAtomWithWriteOnly = atom(null, (_, set) => {
  set(addWebTabAtomWithWriteOnly, { ...homeTab });
});
export const setWebTabDataAtomWithWriteOnly = atom(
  null,
  (get, set, payload: Partial<WebTab>) => {
    const { tabs } = get(atomWebTabs);
    const tabIndex = tabs.findIndex((t) => t.id === payload.id);
    if (tabIndex > -1) {
      const tabToModify = tabs[tabIndex];
      Object.keys(payload).forEach((k) => {
        const key = k as keyof WebTab;
        let value = payload[key];
        if (value !== undefined && value !== tabToModify[key]) {
          if (key === 'title') {
            if (!value) {
              return;
            }
            if (value === 'about:blank') {
              value = 'OneKey';
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
      set(setWebTabsWriteAtom, tabs);
    }
  },
);
export const closeWebTabAtomWithWriteOnly = atom(
  null,
  (get, set, tabId: string) => {
    delete webviewRefs[tabId];
    const { tabs } = get(atomWebTabs);
    const targetIndex = tabs.findIndex((t) => t.id === tabId);
    if (targetIndex !== -1) {
      if (tabs[targetIndex].isCurrent) {
        const prev = tabs[targetIndex - 1];
        if (prev) {
          prev.isCurrent = true;
          _currentTabId = prev.id;
        }
      }
      tabs.splice(targetIndex, 1);
      set(setWebTabsWriteAtom, [...tabs]);
    }
  },
);
export const closeAllWebTabsAtomWithWriteOnly = atom(null, (_, set) => {
  for (const id of Object.getOwnPropertyNames(webviewRefs)) {
    delete webviewRefs[id];
  }
  set(setWebTabsWriteAtom, [{ ...homeTab }]);
  _currentTabId = homeTab.id;
});
export const setCurrentWebTabAtomWithWriteOnly = atom(
  null,
  (get, set, tabId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const currentTabId = getCurrentTabId();
    if (currentTabId !== tabId) {
      // pauseDappInteraction(currentTabId);
      const { tabs } = get(atomWebTabs);
      let previousTabUpdated = false;
      let nextTabUpdated = false;

      for (let i = 0; i < tabs.length; i += 1) {
        const tab = tabs[i];
        if (tab.isCurrent) {
          tabs[i] = {
            ...tab,
            isCurrent: false,
          };
          previousTabUpdated = true;
        } else if (tab.id === tabId) {
          tabs[i] = {
            ...tab,
            isCurrent: true,
          };
          nextTabUpdated = true;
        }
        if (previousTabUpdated && nextTabUpdated) {
          break;
        }
      }
      set(setWebTabsWriteAtom, tabs);
      // resumeDappInteraction(tabId);
      _currentTabId = tabId;
    }
  },
);

export const incomingUrlAtom = atom('');

export const getCurrentTabId = () => {
  if (!_currentTabId) {
    const { tabs } = webTabsStore.get(atomWebTabs);
    _currentTabId = tabs.find((t) => t.isCurrent)?.id || '';
  }
  return _currentTabId;
};

const webTabsActions = {
  getTabs: () => webTabsStore.get(atomWebTabs),
  getTabsMap: () => webTabsStore.get(atomWebTabsMap),
  addWebTab: (payload: Partial<WebTab>) => {
    webTabsStore.set(addWebTabAtomWithWriteOnly, payload);
  },
  addBlankWebTab: () => {
    webTabsStore.set(addBlankWebTabAtomWithWriteOnly);
  },
  setWebTabData: (payload: Partial<Omit<WebTab, 'isCurrent'>>) => {
    webTabsStore.set(setWebTabDataAtomWithWriteOnly, payload);
  },
  closeWebTab: (tabId: string) => {
    webTabsStore.set(closeWebTabAtomWithWriteOnly, tabId);
  },
  closeAllWebTabs: () => {
    webTabsStore.set(closeAllWebTabsAtomWithWriteOnly);
  },
  setCurrentWebTab: (tabId: string) => {
    webTabsStore.set(setCurrentWebTabAtomWithWriteOnly, tabId);
  },
  setIncomingUrl: (url: string) => {
    webTabsStore.set(incomingUrlAtom, url);
  },
};

export { withProviderWebTabs, useAtomWebTabs, webTabsActions };
