import { isEqual } from 'lodash';

import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';
import type {
  IBrowserBookmark,
  IBrowserHistory,
  IGotoSiteFnParams,
  IMatchDAppItemType,
  IOnWebviewNavigationFnParams,
  IWebTab,
} from '@onekeyhq/kit/src/views/Discovery/types';
import {
  browserTypeHandler,
  crossWebviewLoadUrl,
  validateUrl,
  webviewRefs,
} from '@onekeyhq/kit/src/views/Discovery/utils/explorerUtils';
import simpleDb from '@onekeyhq/kit-bg/src/dbs/simple/simpleDb';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import {
  activeTabIdAtom,
  browserBookmarkAtom,
  browserHistoryAtom,
  contextAtomMethod,
  displayHomePageAtom,
  webTabsAtom,
  webTabsMapAtom,
} from './atoms';

export const homeResettingFlags: Record<string, number> = {};

function buildWebTabData(tabs: IWebTab[]) {
  const map: Record<string, IWebTab> = {};
  const keys: string[] = [];
  tabs.sort((a, b) => {
    if (a.timestamp && b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return 0;
  });
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

class ContextJotaiActionsDiscovery extends ContextJotaiActionsBase {
  /**
   * Browser web tab action
   */
  setDisplayHomePage = contextAtomMethod((get, set, payload: boolean) => {
    const v = get(displayHomePageAtom());
    console.log('displayHomePageAtom: ', v);
    set(displayHomePageAtom(), payload);
  });

  buildWebTabs = contextAtomMethod(
    (
      get,
      set,
      payload: { data: IWebTab[]; options?: { forceUpdate?: boolean } },
    ) => {
      const webTabs = get(webTabsAtom());
      const { data, options } = payload;
      let newTabs = data;
      if (!Array.isArray(data)) {
        throw new Error('setWebTabsWriteAtom: payload must be an array');
      }
      if (!newTabs || !newTabs.length) {
        newTabs = [];
      }
      const result = buildWebTabData(newTabs);
      // Should update tabs
      if (!isEqual(result.keys, webTabs.keys) || options?.forceUpdate) {
        set(webTabsAtom(), { keys: result.keys, tabs: result.data });
      }

      set(webTabsMapAtom(), () => result.map);
      void simpleDb.browserTabs.setRawData({
        tabs: result.data,
      });
    },
  );

  refreshTabs = contextAtomMethod((get, set) => {
    const { tabs } = get(webTabsAtom());
    const newTabs = [...tabs];
    this.buildWebTabs.call(set, {
      data: newTabs,
      options: { forceUpdate: true },
    });
  });

  setCurrentWebTab = contextAtomMethod((get, set, tabId: string | null) => {
    const currentTabId = get(activeTabIdAtom());
    if (currentTabId !== tabId) {
      // set isActive to true
      const { tabs } = get(webTabsAtom());
      const targetIndex = tabs.findIndex((t) => t.id === tabId);
      tabs.forEach((t) => {
        t.isActive = false;
      });
      this.buildWebTabs.call(set, { data: [...tabs] });
      if (targetIndex !== -1) {
        tabs[targetIndex].isActive = true;
        set(activeTabIdAtom(), tabId);
      } else {
        set(activeTabIdAtom(), '');
      }
    }
    const displayHomePage = get(displayHomePageAtom());
    if (tabId && displayHomePage) {
      this.setDisplayHomePage.call(set, false);
    }
    if (!tabId && !displayHomePage) {
      this.setDisplayHomePage.call(set, true);
    }
  });

  addWebTab = contextAtomMethod((get, set, payload: Partial<IWebTab>) => {
    // 记录函数执行时间
    const startTime = performance.now();
    const { tabs } = get(webTabsAtom());
    if (!payload.id || payload.id === homeTab.id) {
      // TODO: nanoid will crash on native, replace by nanoid
      payload.id = generateUUID();
    }
    payload.timestamp = Date.now();
    this.buildWebTabs.call(set, { data: [...tabs, payload as IWebTab] });
    this.setCurrentWebTab.call(set, payload.id ?? '');
    const endTime = performance.now();
    console.log(`addBlankWebTab took ${endTime - startTime} milliseconds.`);
  });

  addBlankWebTab = contextAtomMethod((_, set) => {
    this.addWebTab.call(set, { ...homeTab, isActive: true });
  });

  setWebTabData = contextAtomMethod((get, set, payload: Partial<IWebTab>) => {
    const { tabs: previousTabs } = get(webTabsAtom());
    const tabs = previousTabs;
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
            if (value === 'about:blank' && payload.id) {
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
      this.buildWebTabs.call(set, { data: tabs });
    }
  });

  closeWebTab = contextAtomMethod((get, set, tabId: string) => {
    delete webviewRefs[tabId];
    const { tabs } = get(webTabsAtom());
    const activeTabId = get(activeTabIdAtom());
    const targetIndex = tabs.findIndex((t) => t.id === tabId);
    if (targetIndex !== -1) {
      if (tabs[targetIndex].id === activeTabId) {
        const prev = tabs[targetIndex - 1];
        if (prev) {
          prev.isActive = true;
          this.setCurrentWebTab.call(set, prev.id);
        }
      }
      tabs.splice(targetIndex, 1);
    }
    this.buildWebTabs.call(set, { data: [...tabs] });
  });

  closeAllWebTabs = contextAtomMethod((get, set) => {
    const { tabs } = get(webTabsAtom());
    const activeTabId = get(activeTabIdAtom());
    const pinnedTabs = tabs.filter((tab) => tab.isPinned); // close all tabs exclude pinned tab
    // should update active tab, if active tab is not in pinnedTabs
    if (pinnedTabs.every((tab) => tab.id !== activeTabId)) {
      if (pinnedTabs.length) {
        pinnedTabs[pinnedTabs.length - 1].isActive = true;
        this.setCurrentWebTab.call(set, pinnedTabs[pinnedTabs.length - 1].id);
      }
    }
    for (const id of Object.getOwnPropertyNames(webviewRefs)) {
      if (!pinnedTabs.find((tab) => tab.id === id)) {
        delete webviewRefs[id];
      }
    }
    this.buildWebTabs.call(set, { data: pinnedTabs });
  });

  setPinnedTab = contextAtomMethod(
    (_, set, payload: { id: string; pinned: boolean }) => {
      this.setWebTabData.call(set, {
        id: payload.id,
        isPinned: payload.pinned,
        timestamp: Date.now(),
      });
      this.refreshTabs.call(set);
    },
  );

  /**
   * Bookmark actions
   */
  syncBookmark = contextAtomMethod(
    (get, set, payload: { url: string; isBookmark: boolean }) => {
      const tabMap = get(webTabsMapAtom());
      if (!tabMap) return;
      Object.entries(tabMap).forEach(([, value]) => {
        if (value.url === payload.url) {
          this.setWebTabData.call(set, {
            id: value.id,
            isBookmark: payload.isBookmark,
          });
        }
      });
    },
  );

  buildBookmarkData = contextAtomMethod(
    (_, set, payload: IBrowserBookmark[]) => {
      if (!Array.isArray(payload)) {
        throw new Error('buildBookmarkData: payload must be an array');
      }
      set(browserBookmarkAtom(), payload);
      void simpleDb.browserBookmarks.setRawData({
        data: payload,
      });
    },
  );

  addBrowserBookmark = contextAtomMethod(
    (get, set, payload: IBrowserBookmark) => {
      if (!payload.url || payload.url === homeTab.url) {
        return;
      }
      const bookmark = get(browserBookmarkAtom());
      const index = bookmark.findIndex((item) => item.url === payload.url);
      if (index !== -1) {
        bookmark.splice(index, 1);
      }
      bookmark.push({ url: payload.url, title: payload.title });
      this.buildBookmarkData.call(set, bookmark);
      console.log('===>set browserBookmarkAtom: ', bookmark);
      this.syncBookmark.call(set, { url: payload.url, isBookmark: true });
    },
  );

  removeBrowserBookmark = contextAtomMethod((get, set, payload: string) => {
    const bookmark = get(browserBookmarkAtom());
    const index = bookmark.findIndex((item) => item.url === payload);
    if (index !== -1) {
      bookmark.splice(index, 1);
    }
    this.buildBookmarkData.call(set, bookmark);
    this.syncBookmark.call(set, { url: payload, isBookmark: false });
  });

  /**
   * History actions
   */
  buildHistoryData = contextAtomMethod((_, set, payload: IBrowserHistory[]) => {
    if (!Array.isArray(payload)) {
      throw new Error('buildHistoryData: payload must be an array');
    }
    set(browserHistoryAtom(), payload);
    void simpleDb.browserHistory.setRawData({
      data: payload,
    });
  });

  addBrowserHistory = contextAtomMethod(
    (get, set, payload: IBrowserHistory) => {
      if (!payload.url || payload.url === homeTab.url) {
        return;
      }
      const history = get(browserHistoryAtom());
      const index = history.findIndex((item) => item.url === payload.url);
      if (index !== -1) {
        history.splice(index, 1);
      }
      history.unshift({ url: payload.url, title: payload.title });
      this.buildHistoryData.call(set, history);
      console.log('===>set browserHistoryAtom: ', history);
    },
  );

  removeBrowserHistory = contextAtomMethod((get, set, payload: string) => {
    const history = get(browserHistoryAtom());
    const index = history.findIndex((item) => item.url === payload);
    if (index !== -1) {
      history.splice(index, 1);
    }
    this.buildHistoryData.call(set, history);
  });

  /**
   * Browser Logic
   */
  getWebTabById = contextAtomMethod((get, _, tabId: string) => {
    const tabMaps = get(webTabsMapAtom());
    return tabMaps?.[tabId || ''];
  });

  gotoSite = contextAtomMethod(
    (
      get,
      set,
      {
        id,
        url,
        title,
        favicon,
        isNewWindow,
        isInPlace,
        userTriggered,
      }: IGotoSiteFnParams,
    ) => {
      const tab = this.getWebTabById.call(set, id ?? '');
      if (url) {
        const validatedUrl = validateUrl(url);
        if (!validatedUrl) {
          return;
        }

        if (userTriggered) {
          this.addBrowserHistory.call(set, { url, title: title ?? '' });
        }

        if (browserTypeHandler === 'StandardBrowser') {
          return openUrl(validatedUrl);
        }

        const tabId = tab?.id;
        const maybeDeepLink =
          !validatedUrl.startsWith('http') && validatedUrl !== 'about:blank';

        const isNewTab =
          (isNewWindow || !tabId || tabId === 'home' || maybeDeepLink) &&
          browserTypeHandler === 'MultiTabBrowser';

        const bookmarks = get(browserBookmarkAtom());
        const isBookmark = bookmarks?.some((item) =>
          item.url.includes(validatedUrl),
        );
        if (isNewTab) {
          this.addWebTab.call(set, {
            title,
            url: validatedUrl,
            favicon,
            isBookmark,
          });
        } else {
          this.setWebTabData.call(set, {
            id: tabId,
            url: validatedUrl,
            title,
            favicon,
            isBookmark,
          });
        }

        if (!isNewTab && !isInPlace) {
          crossWebviewLoadUrl({
            url: validatedUrl,
            tabId,
          });
        }

        // close deep link tab after 1s
        if (maybeDeepLink) {
          if (browserTypeHandler === 'MultiTabBrowser' && tabId) {
            setTimeout(() => {
              this.closeWebTab.call(set, tabId);
            }, 1000);
          }
        }
        return true;
      }
      return false;
    },
  );

  openMatchDApp = contextAtomMethod(
    (_, set, { dapp, webSite, isNewWindow }: IMatchDAppItemType) => {
      if (webSite) {
        return this.gotoSite.call(set, {
          url: webSite.url,
          title: webSite.title,
          // TODO: get favicon from url
          // @ts-expect-error
          favicon: webSite.favicon,
          isNewWindow,
          userTriggered: true,
        });
      }
      if (dapp) {
        return this.gotoSite.call(set, {
          url: dapp.url,
          title: dapp.name,
          dAppId: dapp._id,
          favicon: dapp.logoURL,
          userTriggered: true,
          isNewWindow,
        });
      }
    },
  );

  onNavigation = contextAtomMethod(
    (
      get,
      set,
      {
        url,
        isNewWindow,
        isInPlace,
        title,
        favicon,
        canGoBack,
        canGoForward,
        loading,
        id,
        handlePhishingUrl,
      }: IOnWebviewNavigationFnParams,
    ) => {
      const now = Date.now();
      const tab = this.getWebTabById.call(set, id ?? '');
      if (!tab) {
        return;
      }
      const isValidNewUrl = typeof url === 'string' && url !== tab.url;

      if (url) {
        const { action } = uriUtils.parseDappRedirect(url);
        if (action === uriUtils.EDAppOpenActionEnum.DENY) {
          handlePhishingUrl?.(url);
          return;
        }
      }

      if (isValidNewUrl) {
        if (tab.timestamp && now - tab.timestamp < 500) {
          // ignore url change if it's too fast to avoid back & forth loop
          return;
        }
        if (
          homeResettingFlags[tab.id] &&
          url !== homeTab.url &&
          now - homeResettingFlags[tab.id] < 1000
        ) {
          return;
        }

        this.gotoSite.call(set, {
          url,
          title,
          favicon,
          isNewWindow,
          isInPlace,
          id: tab.id,
        });
      }

      this.setWebTabData.call(set, {
        id: tab.id,
        title,
        favicon,
        canGoBack,
        canGoForward,
        loading,
      });
    },
  );
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsDiscovery()', Date.now());
  return new ContextJotaiActionsDiscovery();
});

export function useBrowserTabActions() {
  const actions = createActions();
  const addWebTab = actions.addWebTab.use();
  const addBlankWebTab = actions.addBlankWebTab.use();
  const buildWebTabs = actions.buildWebTabs.use();
  const refreshTabs = actions.refreshTabs.use();
  const setWebTabData = actions.setWebTabData.use();
  const closeWebTab = actions.closeWebTab.use();
  const closeAllWebTabs = actions.closeAllWebTabs.use();
  const setCurrentWebTab = actions.setCurrentWebTab.use();
  const setPinnedTab = actions.setPinnedTab.use();
  const setDisplayHomePage = actions.setDisplayHomePage.use();

  return {
    addWebTab,
    addBlankWebTab,
    buildWebTabs,
    refreshTabs,
    setWebTabData,
    closeWebTab,
    closeAllWebTabs,
    setCurrentWebTab,
    setPinnedTab,
    setDisplayHomePage,
  };
}

export function useBrowserBookmarkAction() {
  const actions = createActions();
  const buildBookmarkData = actions.buildBookmarkData.use();
  const addBrowserBookmark = actions.addBrowserBookmark.use();
  const removeBrowserBookmark = actions.removeBrowserBookmark.use();

  return {
    buildBookmarkData,
    addBrowserBookmark,
    removeBrowserBookmark,
  };
}

export function useBrowserHistoryAction() {
  const actions = createActions();
  const buildHistoryData = actions.buildHistoryData.use();
  const addBrowserHistory = actions.addBrowserHistory.use();
  const removeBrowserHistory = actions.removeBrowserHistory.use();

  return {
    buildHistoryData,
    addBrowserHistory,
    removeBrowserHistory,
  };
}

export function useBrowserAction() {
  const actions = createActions();
  const gotoSite = actions.gotoSite.use();
  const openMatchDApp = actions.openMatchDApp.use();
  const onNavigation = actions.onNavigation.use();

  return {
    gotoSite,
    openMatchDApp,
    onNavigation,
  };
}
